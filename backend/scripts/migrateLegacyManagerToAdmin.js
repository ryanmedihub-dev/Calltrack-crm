/**
 * Migration Script: Migrate Legacy Manager Users to Admin Role
 *
 * Background:
 * In CallTrack CRM (pre-RBAC), the 'manager' role was used for the CRM Administrator.
 * Under the new 4-role RBAC model ('admin', 'manager', 'tl', 'employee'):
 *   - 'admin' is the CRM Admin role
 *   - 'manager' is the new actual Manager role
 *   - 'tl' is the new Team Lead role
 *   - 'employee' is the existing Telecaller / Agent role
 *
 * This safe, non-destructive, idempotent migration script updates existing legacy
 * users having role: 'manager' to role: 'admin'.
 *
 * Safety Guarantees:
 * - Does NOT delete any users.
 * - Does NOT modify passwords or any other user fields.
 * - Supports --dry-run mode to preview changes without modifying the database.
 * - Idempotent: can be safely run multiple times.
 * - Explicitly lists affected users (ID, name, email, previous role -> new role).
 *
 * Usage:
 * Dry run (preview only, no DB writes):
 *   node scripts/migrateLegacyManagerToAdmin.js --dry-run
 *
 * Execute migration (apply DB updates):
 *   node scripts/migrateLegacyManagerToAdmin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const isDryRun = process.argv.includes('--dry-run');
const emailIdx = process.argv.indexOf('--email');
const targetEmail = emailIdx !== -1 && process.argv[emailIdx + 1] ? process.argv[emailIdx + 1].toLowerCase() : null;

async function migrateLegacyManagers() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('Error: MONGO_URI environment variable is not defined.');
    process.exit(1);
  }

  console.log('--------------------------------------------------');
  console.log(`Starting Legacy Manager -> Admin Migration ${isDryRun ? '[DRY RUN - NO CHANGES WILL BE WRITTEN]' : '[LIVE EXECUTION]'}`);
  if (targetEmail) {
    console.log(`Filtering by target email: ${targetEmail}`);
  }
  console.log('--------------------------------------------------');

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.\n');

  try {
    // 1. Find legacy admin users currently stored with role: 'manager'
    const filter = { role: 'manager' };
    if (targetEmail) {
      filter.email = targetEmail;
    }
    const legacyManagers = await User.find(filter).select('_id name email role createdAt isActive').lean();
    const count = legacyManagers.length;

    console.log(`Found ${count} user(s) with role: 'manager' matching filter.\n`);

    if (count === 0) {
      console.log('No legacy manager users found. No migration needed.');
      return;
    }

    console.log('Users identified for migration:');
    legacyManagers.forEach((u, i) => {
      console.log(`  [${i + 1}] ID: ${u._id} | Name: ${u.name} | Email: ${u.email} | Current Role: ${u.role} -> Target Role: admin | Active: ${u.isActive}`);
    });
    console.log('');

    if (isDryRun) {
      console.log(`[DRY RUN SUMMARY] ${count} user(s) would be updated from role: 'manager' to role: 'admin'.`);
      console.log('No changes were made to the database.');
    } else {
      // 2. Perform safe update only changing the role field
      const result = await User.updateMany(
        filter,
        { $set: { role: 'admin' } }
      );

      console.log(`[MIGRATION SUCCESS] Successfully updated ${result.modifiedCount} of ${count} user(s) to role: 'admin'.`);
    }
  } catch (err) {
    console.error('Migration failed with error:', err.message);
    throw err;
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
    console.log('--------------------------------------------------');
  }
}

migrateLegacyManagers().catch((err) => {
  console.error(err);
  process.exit(1);
});
