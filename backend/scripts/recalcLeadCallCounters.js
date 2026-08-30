require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const CallLog = require('../models/CallLog');

// Recomputes Lead.attempts and Lead.connectedCallCount from the CallLog rows actually linked to
// each lead, repairing counters that drifted before the double-count guards landed in
// routes/leads.js (POST /from-call incrementing with no real call behind it, and
// PATCH /:id/link-call incrementing again on a call that was already counted once).
//
// Ground truth is the linked CallLog set: every legitimate increment in this system happens at
// the moment a call is linked to a lead, so counting those rows back is the same arithmetic
// without the paths that could run twice.
//
// DRY RUN BY DEFAULT — reports what it would change and writes nothing.
//   node scripts/recalcLeadCallCounters.js            # report only
//   node scripts/recalcLeadCallCounters.js --apply    # actually write
const APPLY = process.argv.includes('--apply');
const BATCH = 1000;

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  console.log(`db: ${mongoose.connection.name} | mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}`);

  // Real per-lead call counts, straight from the call log.
  const truth = new Map();
  const cursor = CallLog.aggregate([
    { $match: { leadId: { $ne: null } } },
    {
      $group: {
        _id: '$leadId',
        attempts:  { $sum: 1 },
        connected: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$duration', 0] }, 0] }, 1, 0] } },
      },
    },
  ]).cursor();
  for await (const row of cursor) truth.set(String(row._id), row);
  console.log(`leads with at least one linked call: ${truth.size}`);

  let scanned = 0, wrong = 0, wouldZero = 0;
  let attemptsDelta = 0, connectedDelta = 0;
  let ops = [];
  const samples = [];

  const leadCursor = Lead.find({
    $or: [{ attempts: { $gt: 0 } }, { connectedCallCount: { $gt: 0 } }],
  }).select('attempts connectedCallCount phone').lean().cursor();

  async function flush() {
    if (!ops.length) return;
    if (APPLY) await Lead.bulkWrite(ops, { ordered: false });
    ops = [];
  }

  for await (const lead of leadCursor) {
    scanned++;
    const real = truth.get(String(lead._id)) || { attempts: 0, connected: 0 };
    const curA = lead.attempts || 0;
    const curC = lead.connectedCallCount || 0;
    if (curA === real.attempts && curC === real.connected) continue;

    wrong++;
    attemptsDelta  += real.attempts - curA;
    connectedDelta += real.connected - curC;
    // A lead whose calls were never linked (they predate the lead, or were logged against a
    // different record) would be reset to 0 here. Counted separately and NOT written, because
    // zeroing a lead that genuinely was called reads as data loss to whoever opens it.
    if (real.attempts === 0) { wouldZero++; continue; }

    if (samples.length < 10) {
      samples.push({ phone: lead.phone, attempts: `${curA}->${real.attempts}`, connected: `${curC}->${real.connected}` });
    }
    ops.push({
      updateOne: {
        filter: { _id: lead._id },
        update: { $set: { attempts: real.attempts, connectedCallCount: real.connected } },
      },
    });
    if (ops.length >= BATCH) await flush();
  }
  await flush();

  console.log(`\nscanned leads with counters: ${scanned}`);
  console.log(`counters disagreeing with the call log: ${wrong}`);
  console.log(`  - of those, skipped (would reset to 0, no linked calls): ${wouldZero}`);
  console.log(`  - ${APPLY ? 'corrected' : 'would correct'}: ${wrong - wouldZero}`);
  console.log(`net attempts change: ${attemptsDelta} | net connectedCallCount change: ${connectedDelta}`);
  console.log('\nsample corrections:');
  samples.forEach((s) => console.log('  ', JSON.stringify(s)));
  if (!APPLY) console.log('\nDRY RUN — nothing was written. Re-run with --apply to commit.');

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => { console.error('FAILED:', err); process.exit(1); });
