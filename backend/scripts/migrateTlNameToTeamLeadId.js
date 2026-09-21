/**
 * Migration Script: Migrate Employee.tlName (string) → Employee.teamLeadId (ObjectId)
 *
 * Background:
 * Employees currently carry a `tlName` string (e.g. "Priya") that informally links
 * them to a Team Lead by name. Phase 2 introduces `teamLeadId` as a stable ObjectId
 * reference. This script optionally back-fills `teamLeadId` for employees where
 * the name mapping is unambiguous.
 *
 * Matching rules:
 * - Finds all employees with `teamLeadId == null` AND `tlName` populated.
 * - For each unique tlName, looks up ALL users with role: 'tl' whose name
 *   matches exactly (case-insensitive).
 * - If exactly ONE TL matches → sets `teamLeadId` to that TL's _id.
 * - If ZERO TLs match → logs a warning and SKIPS.
 * - If MULTIPLE TLs match (ambiguous) → logs a warning and SKIPS.
 * - Employees already having `teamLeadId` set are NOT touched.
 * - `tlName` is NEVER removed or modified by this script.
 *
 * Safety Guarantees:
 * - Does NOT delete any users.
 * - Does NOT modify tlName, passwords, or any other field.
 * - Idempotent — can be run multiple times safely.
 * - Supports --dry-run mode (no writes).
 *
 * Usage:
 * Dry run (preview only, no DB writes):
 *   node scripts/migrateTlNameToTeamLeadId.js --dry-run
 *
 * Execute migration:
 *   node scripts/migrateTlNameToTeamLeadId.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const isDryRun = process.argv.includes('--dry-run');

async function migrateTeamLeadIds() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('Error: MONGO_URI environment variable is not defined.');
    process.exit(1);
  }

  console.log('------------------------------------------------------------------');
  console.log(`tlName → teamLeadId Migration ${isDryRun ? '[DRY RUN — NO WRITES]' : '[LIVE EXECUTION]'}`);
  console.log('------------------------------------------------------------------');

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.\n');

  try {
    // 1. Find all employees needing migration: no teamLeadId, but have tlName
    const candidates = await User
      .find({ role: 'employee', teamLeadId: null, tlName: { $nin: ['', null] } })
      .select('_id name email tlName teamLeadId')
      .lean();

    if (candidates.length === 0) {
      console.log('No employees found needing migration. All done.');
      return;
    }

    console.log(`Found ${candidates.length} employee(s) with tlName set but no teamLeadId.\n`);

    // 2. Fetch all TL users indexed by lower-case name for lookup
    const allTLs = await User.find({ role: 'tl' }).select('_id name isActive').lean();

    // Build a map: normalised-name → array of TL records (to detect ambiguity)
    const tlByName = {};
    for (const tl of allTLs) {
      const key = tl.name.trim().toLowerCase();
      if (!tlByName[key]) tlByName[key] = [];
      tlByName[key].push(tl);
    }

    // 3. Attempt migration
    let migrated = 0;
    let skippedMissing = 0;
    let skippedAmbiguous = 0;

    for (const emp of candidates) {
      const key = emp.tlName.trim().toLowerCase();
      const matches = tlByName[key] || [];

      if (matches.length === 0) {
        console.warn(`  [SKIP — no match]    Employee: "${emp.name}" (${emp._id}) | tlName: "${emp.tlName}" — no TL with this name found.`);
        skippedMissing++;
        continue;
      }
      if (matches.length > 1) {
        const ids = matches.map((t) => `${t.name} (${t._id})`).join(', ');
        console.warn(`  [SKIP — ambiguous]   Employee: "${emp.name}" (${emp._id}) | tlName: "${emp.tlName}" — ${matches.length} TL matches: ${ids}`);
        skippedAmbiguous++;
        continue;
      }

      const tl = matches[0];
      console.log(`  [${isDryRun ? 'DRY-RUN' : 'MIGRATING'}]  Employee: "${emp.name}" (${emp._id}) | tlName: "${emp.tlName}" → TL: "${tl.name}" (${tl._id})`);

      if (!isDryRun) {
        await User.findByIdAndUpdate(emp._id, { $set: { teamLeadId: tl._id } });
      }
      migrated++;
    }

    console.log('\n------------------------------------------------------------------');
    if (isDryRun) {
      console.log(`[DRY RUN SUMMARY] Would migrate: ${migrated} | Skipped (no match): ${skippedMissing} | Skipped (ambiguous): ${skippedAmbiguous}`);
      console.log('No changes were made to the database.');
    } else {
      console.log(`[MIGRATION COMPLETE] Migrated: ${migrated} | Skipped (no match): ${skippedMissing} | Skipped (ambiguous): ${skippedAmbiguous}`);
    }
  } catch (err) {
    console.error('Migration failed:', err.message);
    throw err;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    console.log('------------------------------------------------------------------');
  }
}

migrateTeamLeadIds().catch((err) => {
  console.error(err);
  process.exit(1);
});
