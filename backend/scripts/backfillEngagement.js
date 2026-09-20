require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const CallLog = require('../models/CallLog');
const { deriveEngagement, bandByScore } = require('../lib/engagement');

// One-time backfill for the engagement feature (see lib/engagement.js): every CallLog synced
// before this feature shipped has engagement: null, and every Lead's engagement/engagementScore/
// lastCallEngagement need seeding from the calls it already has.
//
// Two phases:
//   1. Walk CallLog rows with engagement: null in batches, derive the band from the stored
//      duration/callType, bulkWrite it back.
//   2. Per lead, take the MAX engagementScore across its calls (ground truth, same rule as the
//      monotonic $max in POST /api/calls/sync) and the callType/duration of its most recent call
//      by timestamp for lastCallEngagement.
//
// DRY RUN BY DEFAULT — reports what it would change and writes nothing. Matches the convention
// in scripts/recalcLeadCallCounters.js.
//   node scripts/backfillEngagement.js            # report only
//   node scripts/backfillEngagement.js --apply    # actually write
// `--dry-run` is also accepted as an explicit no-op alias for the default.
const APPLY = process.argv.includes('--apply') && !process.argv.includes('--dry-run');
const BATCH = 1000;

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  console.log(`db: ${mongoose.connection.name} | mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}`);

  // ── Phase 1: CallLog rows ──────────────────────────────────────────────────
  console.log('\n[phase 1] CallLog rows with engagement: null');
  let scannedCalls = 0, wouldWriteCalls = 0;
  let callOps = [];

  async function flushCalls() {
    if (!callOps.length) return;
    if (APPLY) await CallLog.bulkWrite(callOps, { ordered: false });
    callOps = [];
  }

  const callCursor = CallLog.find({ engagement: null })
    .select('callType duration')
    .lean()
    .cursor({ batchSize: BATCH });

  for await (const call of callCursor) {
    scannedCalls++;
    const band = deriveEngagement(call);
    wouldWriteCalls++;
    callOps.push({
      updateOne: {
        filter: { _id: call._id },
        update: { $set: { engagement: band.key, engagementScore: band.score } },
      },
    });
    if (callOps.length >= BATCH) await flushCalls();
  }
  await flushCalls();
  console.log(`  scanned: ${scannedCalls} | ${APPLY ? 'updated' : 'would update'}: ${wouldWriteCalls}`);

  // ── Phase 2: per-lead rollup ────────────────────────────────────────────────
  console.log('\n[phase 2] per-lead engagement rollup');

  // Ground truth: highest engagementScore ever recorded on a call linked to this lead.
  const maxByLead = new Map();
  const maxCursor = CallLog.aggregate([
    { $match: { leadId: { $ne: null }, engagementScore: { $ne: null } } },
    { $group: { _id: '$leadId', maxScore: { $max: '$engagementScore' } } },
  ]).cursor();
  for await (const row of maxCursor) maxByLead.set(String(row._id), row.maxScore);

  // Most recent call per lead (by timestamp), for lastCallEngagement.
  const lastByLead = new Map();
  const lastCursor = CallLog.aggregate([
    { $match: { leadId: { $ne: null }, engagementScore: { $ne: null } } },
    { $sort: { timestamp: -1 } },
    { $group: { _id: '$leadId', engagement: { $first: '$engagement' }, timestamp: { $first: '$timestamp' } } },
  ]).cursor();
  for await (const row of lastCursor) lastByLead.set(String(row._id), row);

  console.log(`  leads with at least one scored call: ${maxByLead.size}`);

  let scannedLeads = 0, wouldWriteLeads = 0;
  let leadOps = [];

  async function flushLeads() {
    if (!leadOps.length) return;
    if (APPLY) await Lead.bulkWrite(leadOps, { ordered: false });
    leadOps = [];
  }

  const leadCursor = Lead.find({ _id: { $in: [...maxByLead.keys()].map((id) => new mongoose.Types.ObjectId(id)) } })
    .select('engagement engagementScore lastCallEngagement engagementUpdatedAt')
    .lean()
    .cursor({ batchSize: BATCH });

  for await (const lead of leadCursor) {
    scannedLeads++;
    const id = String(lead._id);
    const maxScore = maxByLead.get(id) ?? 0;
    const band = bandByScore(maxScore);
    const last = lastByLead.get(id);
    const lastKey = last ? (last.engagement || bandByScore(0).key) : band.key;

    const needsWrite = (lead.engagementScore || 0) !== maxScore
      || lead.engagement !== band.key
      || (lead.lastCallEngagement || null) !== lastKey;
    if (!needsWrite) continue;

    wouldWriteLeads++;
    leadOps.push({
      updateOne: {
        filter: { _id: lead._id },
        update: {
          $set: {
            engagement: band.key,
            engagementScore: maxScore,
            lastCallEngagement: lastKey,
            engagementUpdatedAt: last ? last.timestamp : (lead.engagementUpdatedAt || new Date()),
          },
        },
      },
    });
    if (leadOps.length >= BATCH) await flushLeads();
  }
  await flushLeads();
  console.log(`  scanned: ${scannedLeads} | ${APPLY ? 'updated' : 'would update'}: ${wouldWriteLeads}`);

  if (!APPLY) console.log('\nDRY RUN — nothing was written. Re-run with --apply to commit.');

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => { console.error('FAILED:', err); process.exit(1); });
