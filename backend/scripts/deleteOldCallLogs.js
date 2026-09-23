require('dotenv').config();
const mongoose = require('mongoose');
const CallLog = require('../models/CallLog');
const Lead = require('../models/Lead');

const APPLY = process.argv.includes('--apply');
const beforeArg = (process.argv.find((a) => a.startsWith('--before=')) || '').split('=')[1] || '2026-07-01';
if (!/^\d{4}-\d{2}-\d{2}$/.test(beforeArg)) {
  console.error(`Invalid --before date "${beforeArg}", expected YYYY-MM-DD`);
  process.exit(1);
}
const CUTOFF = new Date(`${beforeArg}T00:00:00+05:30`);
const BATCH = 5000;

(async () => {
  await mongoose.connect('mongodb://clinicryanofficial_db_user:dashzer1503@ac-snwnffv-shard-00-00.b0wrbjy.mongodb.net:27017,ac-snwnffv-shard-00-01.b0wrbjy.mongodb.net:27017,ac-snwnffv-shard-00-02.b0wrbjy.mongodb.net:27017/?ssl=true&replicaSet=atlas-4x5es1-shard-0&authSource=admin&appName=Cluster0', { serverSelectionTimeoutMS: 20000 });
  const filter = { timestamp: { $lt: CUTOFF } };
  const total = await CallLog.countDocuments(filter);
  console.log(`db: ${mongoose.connection.name} | mode: ${APPLY ? 'APPLY' : 'DRY RUN'} | before ${CUTOFF.toISOString()}`);
  console.log(`call logs matching: ${total}`);

  if (APPLY && total) {
    // Deletes first: Atlas blocks updates while over quota but still allows deletes, so the
    // lead cleanup can only run once the deletes have freed space.
    let deleted = 0;
    const allIds = [];
    for (;;) {
      const ids = (await CallLog.find(filter, { _id: 1 }).limit(BATCH).lean()).map((d) => d._id);
      if (!ids.length) break;
      deleted += (await CallLog.deleteMany({ _id: { $in: ids } })).deletedCount;
      allIds.push(...ids);
      console.log(`  deleted ${deleted}/${total}`);
    }
    console.log(`done: ${deleted} call logs deleted`);

    let leadsCleaned = 0;
    for (let i = 0; i < allIds.length; i += BATCH) {
      const ids = allIds.slice(i, i + BATCH);
      leadsCleaned += (await Lead.updateMany({ callLogs: { $in: ids } }, { $pull: { callLogs: { $in: ids } } })).modifiedCount;
    }
    console.log(`removed deleted call ids from ${leadsCleaned} lead updates`);
  } else if (!APPLY) {
    console.log('dry run — re-run with --apply to delete');
  }

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
