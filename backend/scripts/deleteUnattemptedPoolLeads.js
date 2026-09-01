// One-off cleanup: permanently delete every unassigned lead (assignedTo: null) that has never
// been attempted (attempts: 0, no lastCallAt). This is a subset of what's visually on the pool
// page right now: a released-back lead that already has call history stays untouched here even
// though it's still unassigned, since "unattempted" is the second half of the ask.
//
// NOTE: this filter is deliberately NOT lib/poolFilter.js's POOL_FILTER. The pool now also
// requires a poolable status, but an unattempted lead is 'new' by definition, so the two agree
// on every document this can match — and staying on the looser filter means a never-called lead
// that somehow carries a decided status still gets cleaned up rather than being stranded.
//
// Dry run by default — only counts and previews what would go:
//   node backend/scripts/deleteUnattemptedPoolLeads.js
// Add --confirm to actually delete:
//   node backend/scripts/deleteUnattemptedPoolLeads.js --confirm
// Resolved relative to this file, not process.cwd() — so `node backend/scripts/...` works
// the same whether it's run from the repo root or from inside backend/.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Lead = require('../models/Lead');

const FILTER = { assignedTo: null, attempts: 0, lastCallAt: null };

async function run() {
  const confirm = process.argv.includes('--confirm');

  await mongoose.connect(process.env.MONGO_URI);

  const count = await Lead.countDocuments(FILTER);

  if (!confirm) {
    console.log(`[dry run] ${count} unassigned, unattempted pool lead(s) would be deleted.`);
    if (count) {
      const sample = await Lead.find(FILTER)
        .select('name phone source pooledAt createdAt')
        .sort({ pooledAt: -1, createdAt: -1 })
        .limit(10)
        .lean();
      console.log('Sample (up to 10, newest first):');
      sample.forEach((l) => {
        const added = (l.pooledAt || l.createdAt);
        console.log(`  ${l.name} — ${l.phone} — ${l.source || 'Unknown'} — added ${added ? added.toISOString() : 'unknown'}`);
      });
    }
    console.log('Re-run with --confirm to actually delete.');
    await mongoose.disconnect();
    return;
  }

  const result = await Lead.deleteMany(FILTER);
  console.log(`Deleted ${result.deletedCount} unassigned, unattempted pool lead(s).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
