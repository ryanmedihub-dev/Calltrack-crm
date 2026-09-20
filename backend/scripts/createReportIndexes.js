require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const CallLog = require('../models/CallLog');

// Builds the indexes the rewritten report aggregations depend on, and drops the single-field
// shapes they supersede. Same reasoning as createWorkforceIndexes.js: a schema-level
// `.index(...)` does not retroactively build on an already-large collection in a way you can
// watch, and it NEVER drops an index whose declaration you changed — the old one keeps costing
// write throughput and disk until something removes it explicitly.
//
//   node scripts/createReportIndexes.js
//
// Safe to re-run: createIndex with the same key/options is a no-op, and a drop of an index that
// is already gone is skipped. Builds are backgrounded, so both collections stay readable and
// writable throughout.
const INDEXES = [
  {
    coll: Lead,
    name: 'status_1_createdAt_-1',
    key: { status: 1, createdAt: -1 },
    why: "lead report notConnected tab: status filter + createdAt sort, without a blocking sort",
  },
  {
    coll: Lead,
    name: 'assignedTo_1_createdAt_-1',
    key: { assignedTo: 1, createdAt: -1 },
    why: 'lead report leadList tab: per-assignee rows in createdAt order',
  },
  {
    coll: Lead,
    name: 'source_1_createdAt_-1',
    key: { source: 1, createdAt: -1 },
    why: 'source filter on both reports — index-key scan instead of a scan of every fat Lead doc',
  },
  {
    coll: CallLog,
    name: 'leadId_1_timestamp_-1',
    key: { leadId: 1, timestamp: -1 },
    why: "call report's source filter: lead-id list intersected with the date range, pre-sorted",
  },
];

// Each of these is now a strict prefix of one of the indexes above, so it can answer nothing
// the wider index cannot — it only costs writes.
//
// NOT dropped: Lead { createdAt: -1 } (still the only index for an unfiltered date range),
// Lead { assignedTo: 1, status: 1 } and { assignedTo: 1, pooledAt: -1 } (different second key,
// both still used by the pool and retry-queue), CallLog { contactNumber: 1 } (prefix of
// { contactNumber: 1, timestamp: 1 }, but dropping it is outside this change's scope).
const DROP = [
  { coll: Lead, name: 'status_1' },
  { coll: Lead, name: 'assignedTo_1' },
  { coll: CallLog, name: 'leadId_1' },
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

  // Drop only after every replacement is in place, so no query is ever left without an index.
  for (const d of DROP) {
    const collName = d.coll.collection.collectionName;
    const existing = await d.coll.collection.indexes();
    if (!existing.some((e) => e.name === d.name)) continue;
    try {
      await d.coll.collection.dropIndex(d.name);
      console.log(`- ${collName}.${d.name} dropped (now a prefix of a wider index)`);
    } catch (err) {
      console.error(`  FAILED to drop ${d.name}: ${err.message}`);
    }
  }

  console.log('\nfinal index list:');
  for (const coll of [Lead, CallLog]) {
    const ix = await coll.collection.indexes();
    console.log(` ${coll.collection.collectionName}:`);
    ix.forEach((i) => console.log('   ', i.name, JSON.stringify(i.key)));
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => { console.error('FAILED:', err); process.exit(1); });
