// Ensures every User document (any role) actually has a `ryanEmployeeCode` field in
// the database (set to null), not just as a schema default that only appears when a
// document happens to be read/saved through Mongoose. Run this once after adding
// `ryanEmployeeCode` to models/User.js so the field shows up consistently everywhere
// (e.g. in Compass, raw aggregation pipelines, exports) before real values are
// filled in later via addEmployeeIdField.js.
//
// Named `ryanEmployeeCode` — not `employeeId` — because `employeeId` already means
// this app's own User._id elsewhere in this codebase (CallLog.employeeId,
// workforceSummary/agentDetail responses, the agent-detail/:employeeId route param).
//
//   node backend/scripts/initEmployeeIdField.js
//   node backend/scripts/initEmployeeIdField.js --confirm
//
// Dry run by default — prints how many docs are missing the field, writes nothing
// until --confirm.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  const confirm = process.argv.includes('--confirm');

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`db: ${mongoose.connection.name} | mode: ${confirm ? 'APPLY' : 'DRY RUN'}`);

  const missing = await User.find({ ryanEmployeeCode: { $exists: false } })
    .select('name email role')
    .lean();

  console.log(`\nusers missing ryanEmployeeCode field: ${missing.length}`);
  if (missing.length) {
    console.log('Sample (up to 15):');
    missing.slice(0, 15).forEach((u) => console.log(`  ${u.name} (${u._id}) <${u.email}> [${u.role}]`));
  }

  if (!confirm) {
    console.log('\nDRY RUN — nothing written. Re-run with --confirm to apply.');
    await mongoose.disconnect();
    return;
  }

  const result = await User.updateMany(
    { ryanEmployeeCode: { $exists: false } },
    { $set: { ryanEmployeeCode: null } }
  );
  console.log(`\nSet ryanEmployeeCode: null on ${result.modifiedCount} document(s).`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
