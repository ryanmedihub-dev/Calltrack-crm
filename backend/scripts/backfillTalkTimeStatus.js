require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const { AUTO_STATUSES, STATUS_FROM_SCORE_EXPR } = require('../lib/engagement');

// Sets Lead.status from the talk-time band of each lead's best call, for every lead whose status
// is still call-driven (AUTO_STATUSES). Manual statuses are untouched. Leads never called
// (engagement: null) stay 'new'.
//
// RUN scripts/backfillEngagement.js --apply FIRST — this reads engagementScore, which that
// script seeds from existing call logs.
//
//   node scripts/backfillTalkTimeStatus.js           # dry run: counts only
//   node scripts/backfillTalkTimeStatus.js --apply   # write
const APPLY = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  const filter = { status: { $in: AUTO_STATUSES }, engagement: { $ne: null } };

  const preview = await Lead.aggregate([
    { $match: filter },
    { $project: { from: '$status', to: STATUS_FROM_SCORE_EXPR } },
    { $match: { $expr: { $ne: ['$from', '$to'] } } },
    { $group: { _id: { from: '$from', to: '$to' }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);
  const total = preview.reduce((s, r) => s + r.n, 0);
  console.log(`db: ${mongoose.connection.name} | mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  preview.forEach((r) => console.log(`  ${r._id.from.padEnd(16)} -> ${r._id.to.padEnd(16)} ${r.n}`));
  console.log(`leads to change: ${total}`);

  if (APPLY && total) {
    const res = await Lead.updateMany(filter, [{ $set: { status: STATUS_FROM_SCORE_EXPR } }]);
    console.log(`updated: ${res.modifiedCount}`);
  }
  await mongoose.disconnect();
})().catch((err) => { console.error(err); process.exit(1); });
