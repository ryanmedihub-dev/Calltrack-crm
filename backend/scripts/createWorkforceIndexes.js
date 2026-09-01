require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('../models/Lead');

// Builds the indexes the Owner-panel workforce endpoints depend on (retry-queue's priority
// tiers in particular). A schema-level `leadSchema.index(...)` does NOT retroactively build an
// index on an already-large collection in a way you can rely on or watch — Mongoose kicks off
// autoIndex in the background at model load and swallows the outcome — so this script creates
// them explicitly, one at a time, and reports what happened.
//
//   node scripts/createWorkforceIndexes.js
//
// Safe to re-run: createIndex on an index that already exists with the same key/options is a
// no-op. Builds are backgrounded, so the collection stays readable and writable throughout
// (on MongoDB 4.2+ every build is effectively background; the flag is accepted and ignored).
//
// DELIBERATELY NOT CREATED HERE — already covered by an existing index:
//   Lead   { createdAt: 1 }               -> { createdAt: -1 } already exists
//   CallLog{ employeeId: 1, timestamp: 1 }-> { employeeId: 1, timestamp: -1 } already exists
//   Lead   { assignedTo: 1, status: 1 }   -> already created by an earlier change
// Key direction only affects sort order. Both of the workforce queries filter these fields by
// range without sorting on them, and a range walks an index in either direction, so the
// ascending duplicates would add write cost and disk for no read benefit.
const INDEXES = [
  { coll: Lead, name: 'status_1_followUpDate_1', key: { status: 1, followUpDate: 1 }, why: 'retry-queue P0: interested + past follow-up' },
  { coll: Lead, name: 'status_1_lastCallAt_1',   key: { status: 1, lastCallAt: 1 },   why: 'retry-queue P1/P3: contacted / not_connected + lastCallAt cutoff' },
  { coll: Lead, name: 'pool_attempts_order', key: { assignedTo: 1, attempts: 1, pooledAt: -1, createdAt: -1, status: 1 }, why: 'pool listing sorted least-worked-first (polled every 12s per agent)' },
];

// Superseded shapes for the pool sort, dropped so they stop costing write throughput and disk.
// Both were attempts at the index above that put the $in on `status`, or an incomplete set of
// sort keys, ahead of the sort — neither lets Mongo provide the ordering, so both left a
// blocking in-memory sort in the plan while still being maintained on every write.
const DROP = [
  { coll: Lead, name: 'assignedTo_1_status_1_attempts_1_pooledAt_-1' },
  { coll: Lead, name: 'assignedTo_1_attempts_1_pooledAt_-1_status_1' },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  console.log(`db: ${mongoose.connection.name}`);

  for (const ix of INDEXES) {
    const collName = ix.coll.collection.collectionName;
    const existing = await ix.coll.collection.indexes();
    if (existing.some((e) => e.name === ix.name)) {
      console.log(`= ${collName}.${ix.name} already exists — skipping`);
      continue;
    }
    const started = Date.now();
    console.log(`+ ${collName}.${ix.name} building… (${ix.why})`);
    try {
      await ix.coll.collection.createIndex(ix.key, { name: ix.name, background: true });
      console.log(`  done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
    }
  }

  for (const d of DROP) {
    const collName = d.coll.collection.collectionName;
    const existing = await d.coll.collection.indexes();
    if (!existing.some((e) => e.name === d.name)) continue;
    try {
      await d.coll.collection.dropIndex(d.name);
      console.log(`- ${collName}.${d.name} dropped (superseded)`);
    } catch (err) {
      console.error(`  FAILED to drop ${d.name}: ${err.message}`);
    }
  }

  console.log('\nfinal index list:');
  for (const coll of [Lead]) {
    const ix = await coll.collection.indexes();
    console.log(` ${coll.collection.collectionName}:`);
    ix.forEach((i) => console.log('   ', i.name, JSON.stringify(i.key)));
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => { console.error('FAILED:', err); process.exit(1); });
