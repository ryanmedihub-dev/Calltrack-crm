// One-off migration: set every employee's dailyTarget to 100 calls/day
// (new schema default is also 100 — this backfills existing users).
// Run once manually: node backend/scripts/setDailyTarget100.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const result = await User.updateMany({ role: 'employee' }, { $set: { dailyTarget: 100 } });
  console.log(`Updated ${result.modifiedCount} employee(s) to dailyTarget=100`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
