// One-time migration: `employeeId` on User documents was a naming collision — this app's own
// route/schema code already uses `employeeId` to mean User._id (CallLog.employeeId,
// workforceSummary/agentDetail response fields, the agent-detail/:employeeId route param).
// The field was actually meant to hold ryan-crm's Employee.employeeId code (e.g. "RC-014"),
// which is now called `ryanEmployeeCode` in models/User.js.
//
// This copies any existing raw `employeeId` string value on a User doc into the new
// `ryanEmployeeCode` field, then unsets the old key — so no document is left with both.
//
//   node backend/scripts/renameEmployeeIdToRyanCode.js
//   node backend/scripts/renameEmployeeIdToRyanCode.js --confirm
//
// Dry run by default — prints what would move, writes nothing until --confirm.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  const confirm = process.argv.includes('--confirm');

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`db: ${mongoose.connection.name} | mode: ${confirm ? 'APPLY' : 'DRY RUN'}`);

  // Read the old field directly — it's no longer in the schema, so query via the raw collection
  // rather than the Mongoose model (which would silently ignore it).
  const coll = mongoose.connection.collection('users');
  const toMigrate = await coll.find({ employeeId: { $exists: true, $ne: null } })
    .project({ name: 1, email: 1, employeeId: 1, ryanEmployeeCode: 1 })
    .toArray();

  console.log(`\nusers with a legacy employeeId value: ${toMigrate.length}`);
  const conflicts = toMigrate.filter((u) => u.ryanEmployeeCode && u.ryanEmployeeCode !== u.employeeId);
  if (conflicts.length) {
    console.log(`\nCONFLICTS — already has a DIFFERENT ryanEmployeeCode set. Not touched automatically, review by hand:`);
    conflicts.forEach((u) => console.log(`  ${u.name} (${u._id}) <${u.email}>: legacy employeeId="${u.employeeId}", ryanEmployeeCode="${u.ryanEmployeeCode}"`));
  }
  const toApply = toMigrate.filter((u) => !u.ryanEmployeeCode || u.ryanEmployeeCode === u.employeeId);
  console.log(`\nwill migrate: ${toApply.length}`);
  toApply.slice(0, 15).forEach((u) => console.log(`  ${u.name} (${u._id}) <${u.email}>: employeeId "${u.employeeId}" -> ryanEmployeeCode`));

  // Every legacy-field document (including conflicts, which are skipped above but still carry
  // the stale key) needs the old field unset once its value is safely elsewhere or reviewed.
  const allWithLegacyField = await coll.countDocuments({ employeeId: { $exists: true } });
  console.log(`\ndocuments with the employeeId key present at all (incl. null): ${allWithLegacyField}`);

  if (!confirm) {
    console.log('\nDRY RUN — nothing written. Re-run with --confirm to apply.');
    await mongoose.disconnect();
    return;
  }

  let migrated = 0;
  for (const u of toApply) {
    await coll.updateOne({ _id: u._id }, { $set: { ryanEmployeeCode: u.employeeId }, $unset: { employeeId: '' } });
    migrated += 1;
  }
  console.log(`\nMigrated ${migrated} document(s).`);

  if (conflicts.length) {
    console.log(`${conflicts.length} conflicting document(s) left untouched — resolve by hand, then re-run to unset their stale employeeId key.`);
  } else {
    // No conflicts left — safe to drop the stale key from every remaining document that still
    // has it (e.g. ones where employeeId was null but the key existed).
    const result = await coll.updateMany({ employeeId: { $exists: true } }, { $unset: { employeeId: '' } });
    console.log(`Unset the stale employeeId key on ${result.modifiedCount} remaining document(s).`);
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
