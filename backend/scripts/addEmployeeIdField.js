// Writes a ryan-crm `Employee.employeeId` string onto each matching callby `User`
// document's `ryanEmployeeCode` field, so callby carries the reverse link (ryan-crm
// already stores the forward link as `Employee.callbyUserId`, set by ryan-crm's
// link-employees-to-callby.mjs). Named `ryanEmployeeCode` on the User schema — not
// `employeeId` — because `employeeId` already means this app's own User._id
// elsewhere (CallLog.employeeId, workforceSummary/agentDetail).
//
// This does NOT do any name/phone matching itself — it takes a mapping you already
// have (from the ryan-crm reconciliation script's output: confirmed matches +
// anything paired manually at /owner/employees/links) and writes it in.
//
//   node backend/scripts/addEmployeeIdField.js --map=./employee-links.json
//   node backend/scripts/addEmployeeIdField.js --map=./employee-links.json --confirm
//
// Mapping file shape (array or object, either is accepted):
//   [ { "callbyUserId": "6710...", "employeeId": "RC-014" }, ... ]
//   or
//   { "6710...": "RC-014", "6711...": "RC-018", ... }
//
// Dry run by default — prints exactly what would change, writes nothing until --confirm.
//
// Resolved relative to this file, not process.cwd() — so `node backend/scripts/...`
// works the same whether run from the repo root or from inside backend/.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/User');

function loadMapping(mapArg) {
  if (!mapArg) {
    console.error('Missing --map=<path to mapping file>. See the comment at the top of this script for the expected shape.');
    process.exit(1);
  }
  const resolved = path.resolve(process.cwd(), mapArg);
  if (!fs.existsSync(resolved)) {
    console.error(`Mapping file not found: ${resolved}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const pairs = Array.isArray(raw)
    ? raw.map((r) => [r.callbyUserId, r.employeeId])
    : Object.entries(raw);

  const cleaned = [];
  const skipped = [];
  for (const [callbyUserId, employeeId] of pairs) {
    if (!callbyUserId || !employeeId) { skipped.push({ callbyUserId, employeeId }); continue; }
    if (!mongoose.Types.ObjectId.isValid(callbyUserId)) { skipped.push({ callbyUserId, employeeId, reason: 'not a valid ObjectId' }); continue; }
    cleaned.push({ callbyUserId, employeeId: String(employeeId).trim() });
  }
  return { cleaned, skipped };
}

async function run() {
  const confirm = process.argv.includes('--confirm');
  const mapArg = process.argv.find((a) => a.startsWith('--map='))?.split('=')[1];
  const { cleaned, skipped } = loadMapping(mapArg);

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`db: ${mongoose.connection.name} | mode: ${confirm ? 'APPLY' : 'DRY RUN'} | mapping entries: ${cleaned.length} (${skipped.length} skipped as malformed)`);

  if (skipped.length) {
    console.log('\nSkipped (malformed) entries:');
    skipped.forEach((s) => console.log(`  ${JSON.stringify(s)}`));
  }

  const results = { willSet: [], alreadyCorrect: [], willOverwrite: [], userNotFound: [] };

  for (const { callbyUserId, employeeId } of cleaned) {
    const user = await User.findById(callbyUserId).select('name ryanEmployeeCode').lean();
    if (!user) { results.userNotFound.push({ callbyUserId, employeeId }); continue; }
    if (user.ryanEmployeeCode === employeeId) { results.alreadyCorrect.push({ user, employeeId }); continue; }
    if (user.ryanEmployeeCode && user.ryanEmployeeCode !== employeeId) {
      results.willOverwrite.push({ user, from: user.ryanEmployeeCode, to: employeeId });
      continue;
    }
    results.willSet.push({ user, employeeId });
  }

  console.log(`\nalready correct, no change needed: ${results.alreadyCorrect.length}`);
  console.log(`new ryanEmployeeCode to set: ${results.willSet.length}`);
  console.log(`callbyUserId not found in User collection: ${results.userNotFound.length}`);
  console.log(`WOULD OVERWRITE an existing different ryanEmployeeCode: ${results.willOverwrite.length}`);

  if (results.userNotFound.length) {
    console.log('\nMissing callby users (check these IDs — typo, or the user was deleted since matching):');
    results.userNotFound.forEach((r) => console.log(`  ${r.callbyUserId} -> ${r.employeeId}`));
  }

  if (results.willOverwrite.length) {
    console.log('\nCONFLICTS — these already have a DIFFERENT ryanEmployeeCode set. Not touched automatically, review by hand:');
    results.willOverwrite.forEach((r) => console.log(`  ${r.user.name} (${r.user._id}): has "${r.from}", mapping says "${r.to}"`));
  }

  if (results.willSet.length) {
    console.log('\nSample of what will be set (up to 15):');
    results.willSet.slice(0, 15).forEach((r) => console.log(`  ${r.user.name} (${r.user._id}) -> ryanEmployeeCode "${r.employeeId}"`));
  }

  if (!confirm) {
    console.log('\nDRY RUN — nothing written. Re-run with --confirm to apply.');
    await mongoose.disconnect();
    return;
  }

  let written = 0;
  for (const { user, employeeId } of results.willSet) {
    await User.updateOne({ _id: user._id }, { $set: { ryanEmployeeCode: employeeId } });
    written += 1;
  }
  console.log(`\nWrote ryanEmployeeCode on ${written} user(s). Conflicts and not-found entries were left untouched — resolve those manually and re-run.`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
