// Hands every unassigned lead dialled more than MAX_POOL_ATTEMPTS times to whoever called it
// last, which is also what removes it from the Live Leads / Live Data screens.
//
//   node backend/scripts/assignPoolLeadsToLastCaller.js                  # dry run, changes nothing
//   node backend/scripts/assignPoolLeadsToLastCaller.js --confirm        # apply
//   node backend/scripts/assignPoolLeadsToLastCaller.js --min-attempts=5 # different threshold
//
// The same rule also runs automatically every few minutes from server.js (see runAutoAssignSweep
// in routes/leadPool.js) — both call lib/assignToLastCaller.js, so there is one implementation.
// This script exists for the initial catch-up over the backlog and for previewing what the sweep
// will do before letting it loose.
//
// NO DELETE STEP: a lead is in the pool exactly while it is unassigned, so assigning it IS the
// removal. See lib/assignToLastCaller.js for the full reasoning.
//
// Resolved relative to this file, not process.cwd() — so `node backend/scripts/...` works the
// same whether it's run from the repo root or from inside backend/.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { assignOverAttemptedLeadsToLastCaller } = require('../lib/assignToLastCaller');
const { MAX_POOL_ATTEMPTS } = require('../lib/poolFilter');

async function run() {
  const confirm = process.argv.includes('--confirm');
  const arg = process.argv.find((a) => a.startsWith('--min-attempts='));
  const minAttempts = arg ? parseInt(arg.split('=')[1], 10) : MAX_POOL_ATTEMPTS;
  if (!Number.isFinite(minAttempts) || minAttempts < 0) {
    console.error(`Invalid --min-attempts value: ${arg}`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`db: ${mongoose.connection.name} | mode: ${confirm ? 'APPLY' : 'DRY RUN'} | assigning leads with MORE THAN ${minAttempts} call(s)`);

  const result = await assignOverAttemptedLeadsToLastCaller({
    minAttempts,
    dryRun: !confirm,
    onProgress: (done, total) => process.stdout.write(`\r  scanned ${done}/${total} number variants`),
  });
  console.log('');

  console.log(`\nunassigned leads with attempts > ${minAttempts}: ${result.examined}`);
  console.log(`  call log disagrees, actually at or below the limit — left alone: ${result.belowThreshold}`);
  console.log(`  last caller unresolvable — left alone: ${result.unresolvable.length}`);
  console.log(`  ${confirm ? 'assigned' : 'would assign'} to last caller: ${result.assignable.length}`);

  const inactive = result.assignable.filter((a) => !a.user.isActive).length;
  if (inactive) console.log(`    (${inactive} of those go to an INACTIVE user — they called the number most recently)`);

  if (result.assignable.length) {
    console.log('\nSample (up to 15, most calls first):');
    [...result.assignable].sort((a, b) => b.stats.total - a.stats.total).slice(0, 15).forEach(({ lead, stats, user }) => {
      console.log(`  ${String(stats.total).padStart(3)} calls  ${lead.phone}  ${String(lead.name).slice(0, 24).padEnd(24)} status=${String(lead.status).padEnd(14)} -> ${user.name}${user.isActive ? '' : ' [INACTIVE]'}`);
    });
  }

  if (!confirm) {
    console.log('\nDRY RUN — nothing written. Re-run with --confirm to apply.');
  } else {
    console.log(`\nAssigned ${result.assigned} lead(s); they are no longer in the open pool.`);
    if (result.assigned !== result.assignable.length) {
      console.log(`  (${result.assignable.length - result.assigned} were claimed between the scan and the write — left alone.)`);
    }
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
