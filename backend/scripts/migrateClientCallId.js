// One-off migration, run manually after deploying the CallLog.js index change:
//   node backend/scripts/migrateClientCallId.js
//
// Two things need doing together:
// 1. The old unique index on (employeeId, contactNumber, timestamp) was unconditional.
//    Resyncing a pre-existing call (clientCallId: null) now upserts on
//    {employeeId, clientCallId}, which doesn't match that null row, so it's treated as an
//    insert — and that insert's (contactNumber, timestamp) collides with the old row under
//    the old index, silently dropping the update. A schema-level index change alone does not
//    retroactively alter an index MongoDB already built, so it has to be dropped and
//    recreated here as partial (scoped to clientCallId: null only).
// 2. Backfill clientCallId onto every existing null row, using the same deterministic
//    algorithm the native Android side uses (UUID v3 / MD5, RFC 4122), so a backfilled id
//    matches whatever the app computes when it resyncs that same call. This is what actually
//    stops the collision from recurring — without it, every legacy row stays null and every
//    resync of it keeps hitting the same insert-vs-existing-row conflict (now on the *new*
//    partial index instead of the old one, but still a silent loss).
require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const CallLog = require('../models/CallLog');

const LEGACY_INDEX_KEY = { employeeId: 1, contactNumber: 1, timestamp: 1 };

function clientCallId(number, timestampMs) {
  const name = `${number}|${timestampMs}`;
  const md5 = crypto.createHash('md5').update(name, 'utf8').digest();
  md5[6] = (md5[6] & 0x0f) | 0x30; // version 3 (name-based, MD5)
  md5[8] = (md5[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = md5.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sameKey(a, b) {
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => a[k] === b[k]);
}

async function fixLegacyIndex() {
  const indexes = await CallLog.collection.indexes();
  const match = indexes.find((ix) => sameKey(ix.key, LEGACY_INDEX_KEY));

  if (!match) {
    console.log('Legacy (employeeId, contactNumber, timestamp) index not found — creating it partial directly.');
  } else if (match.partialFilterExpression && match.partialFilterExpression.clientCallId === null) {
    console.log(`Index "${match.name}" is already partial as expected — skipping drop/recreate.`);
    return;
  } else {
    console.log(`Dropping unconditional index "${match.name}"...`);
    await CallLog.collection.dropIndex(match.name);
  }

  console.log('Creating partial index (employeeId, contactNumber, timestamp)...');
  await CallLog.collection.createIndex(LEGACY_INDEX_KEY, {
    unique: true,
    partialFilterExpression: { clientCallId: null },
  });
  console.log('Done.');
}

async function backfillClientCallId() {
  const cursor = CallLog.find({ clientCallId: null }).select('_id contactNumber timestamp').lean().cursor();
  const BATCH_SIZE = 500;
  let batch = [];
  let updated = 0, skipped = 0, total = 0;

  async function flush() {
    if (!batch.length) return;
    try {
      const result = await CallLog.bulkWrite(batch, { ordered: false });
      updated += result.modifiedCount || 0;
    } catch (err) {
      // Unordered bulkWrite throws if any op in the batch hits the (employeeId,
      // clientCallId) unique index — a genuine duplicate (two legacy rows that really do
      // hash to the same id: an actual duplicate call, or a raw-number formatting
      // difference from the same physical call). The rest of the batch still committed;
      // count what we can confirm and flag the batch rather than crash the whole run.
      const writeErrors = err.writeErrors || err.result?.writeErrors || [];
      updated += (err.result?.modifiedCount) || Math.max(0, batch.length - writeErrors.length);
      skipped += writeErrors.length || batch.length;
      console.error(`[migrateClientCallId] batch had ${writeErrors.length || 'unknown count of'} failure(s): ${err.message}`);
    }
    batch = [];
  }

  for await (const doc of cursor) {
    total++;
    const ts = new Date(doc.timestamp).getTime();
    const cid = clientCallId(doc.contactNumber, ts);
    batch.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { clientCallId: cid } } } });
    if (batch.length >= BATCH_SIZE) {
      await flush();
      console.log(`  ...${total} rows processed (${updated} updated, ${skipped} skipped so far)`);
    }
  }
  await flush();

  console.log(`Backfill: ${updated} updated, ${skipped} skipped, ${total} total null rows seen.`);
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    await fixLegacyIndex();
  } catch (err) {
    // The legacy (employeeId, contactNumber, timestamp) index turned out to never have
    // existed in this database at all (it failed to build the first time, silently, long
    // before this migration) — so it isn't actually blocking anything today. Building it
    // now (even partial) still fails because ~694 pre-existing (employeeId, contactNumber,
    // timestamp) groups already have genuine duplicate rows, unrelated to clientCallId.
    // That's a separate, older data-quality issue needing its own deliberate cleanup
    // decision (which duplicate to keep/merge) — not something to resolve silently here.
    // The clientCallId backfill below doesn't depend on this index existing, so continue.
    console.error('[migrateClientCallId] skipping legacy index fix (see investigation notes):', err.message);
  }
  await backfillClientCallId();
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
