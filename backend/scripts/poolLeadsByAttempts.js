// Lists the open pool (the Live Leads / Live Data screens) least-worked first: every lead with
// 0 attempts, then 1 attempt, then 2, and so on — the same order GET /api/lead-pool now serves,
// so this is a way to inspect and export that ordering without going through the UI.
//
//   node backend/scripts/poolLeadsByAttempts.js                 # distribution + first 50 rows
//   node backend/scripts/poolLeadsByAttempts.js --limit=200     # more rows
//   node backend/scripts/poolLeadsByAttempts.js --max-attempts=2  # only 0-, 1- and 2-attempt leads
//   node backend/scripts/poolLeadsByAttempts.js --csv > pool.csv  # CSV to stdout
//
// READ ONLY — this script never writes, so it needs no --confirm.
//
// `attempts` and the last-call columns come from the call log, not from anything Live Leads
// does: POST /api/calls/sync links every synced call to a matching lead BY PHONE regardless of
// whether that lead was ever claimed. A number an agent dialled straight from their handset is
// therefore already counted here.
//
// Resolved relative to this file, not process.cwd() — so `node backend/scripts/...` works the
// same whether it's run from the repo root or from inside backend/.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const { POOL_FILTER } = require('../lib/poolFilter');

const DEFAULT_LIMIT = 50;

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : null;
}

function csvEsc(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }

function waitingSince(ts) {
  if (!ts) return '—';
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}h` : `${Math.floor(hrs / 24)}d`;
}

async function run() {
  const asCsv = process.argv.includes('--csv');
  const limit = parseInt(arg('limit'), 10) || DEFAULT_LIMIT;
  const maxAttempts = arg('max-attempts') !== null ? parseInt(arg('max-attempts'), 10) : null;

  await mongoose.connect(process.env.MONGO_URI);

  const filter = { ...POOL_FILTER };
  if (maxAttempts !== null && Number.isFinite(maxAttempts)) {
    filter.attempts = { $lte: maxAttempts };
  }

  // Same sort key the pool listing uses, so this reflects exactly what an agent sees.
  const SORT = { attempts: 1, pooledAt: -1, createdAt: -1 };
  const SELECT = 'name phone source status attempts connectedCallCount lastCallAt lastCallType lastCallEmployee pooledAt createdAt';

  if (asCsv) {
    // Streamed rather than buffered — the pool runs to thousands of rows and this may be piped
    // straight to a file.
    process.stdout.write(['Attempts', 'Connected', 'Name', 'Phone', 'Source', 'Status', 'Last Call At', 'Last Call By', 'Waiting'].join(',') + '\n');
    const cursor = Lead.find(filter).sort(SORT).select(SELECT).lean().cursor();
    for await (const l of cursor) {
      process.stdout.write([
        l.attempts || 0,
        l.connectedCallCount || 0,
        csvEsc(l.name),
        l.phone || '',
        csvEsc(l.source),
        csvEsc(l.status),
        l.lastCallAt ? new Date(l.lastCallAt).toISOString() : '',
        csvEsc(l.lastCallEmployee),
        waitingSince(l.pooledAt || l.createdAt),
      ].join(',') + '\n');
    }
    await mongoose.disconnect();
    return;
  }

  // Distribution first — the shape of the pool is usually the actual question ("how many have
  // nobody touched?"), and it answers it without paging through thousands of rows.
  const dist = await Lead.aggregate([
    { $match: filter },
    { $group: { _id: { $ifNull: ['$attempts', 0] }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const total = dist.reduce((s, d) => s + d.count, 0);

  console.log(`db: ${mongoose.connection.name}`);
  console.log(`open-pool leads: ${total}${maxAttempts !== null ? ` (filtered to attempts <= ${maxAttempts})` : ''}\n`);
  console.log('attempts   leads   share');
  console.log('--------  ------  ------');
  dist.forEach((d) => {
    const pct = total ? ((d.count / total) * 100).toFixed(1) : '0.0';
    const bar = '#'.repeat(Math.round((d.count / (dist[0]?.count || 1)) * 30));
    console.log(`${String(d._id).padStart(8)}  ${String(d.count).padStart(6)}  ${pct.padStart(5)}%  ${bar}`);
  });

  const rows = await Lead.find(filter).sort(SORT).limit(limit).select(SELECT).lean();
  console.log(`\nfirst ${rows.length} lead(s), least-worked first:\n`);
  console.log('  # att conn  phone       name                      status          last call by       waiting');
  console.log('  - --- ----  ----------  ------------------------  --------------  -----------------  -------');
  rows.forEach((l, i) => {
    console.log(
      `  ${String(i + 1).padStart(3)} ${String(l.attempts || 0).padStart(3)} ${String(l.connectedCallCount || 0).padStart(4)}  ` +
      `${String(l.phone || '').padEnd(10)}  ${String(l.name || '').slice(0, 24).padEnd(24)}  ` +
      `${String(l.status || '').padEnd(14)}  ${String(l.lastCallEmployee || '—').slice(0, 17).padEnd(17)}  ${waitingSince(l.pooledAt || l.createdAt)}`
    );
  });

  if (total > rows.length) {
    console.log(`\n… ${total - rows.length} more. Use --limit=N for more rows, or --csv to export them all.`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
