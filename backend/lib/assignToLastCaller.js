const Lead = require('../models/Lead');
const CallLog = require('../models/CallLog');
const User = require('../models/User');
const { MAX_POOL_ATTEMPTS } = require('./poolFilter');

// Hands every unassigned lead that has been dialled more than MAX_POOL_ATTEMPTS times to
// whoever called it last.
//
// Shared by scripts/assignPoolLeadsToLastCaller.js (manual, dry-run-able) and by the timed
// sweep in routes/leadPool.js, so the rule has exactly one implementation. The two used to be
// the same code copied twice, which is how a threshold gets changed in one place only.
//
// WHY THERE IS NO DELETE
// "Remove it from live-leads" and "assign it to the last caller" are one write, not two: a lead
// is in the pool exactly while it is unassigned (see poolFilter.js), so setting assignedTo takes
// it off every pool query in the system. Deleting the Lead would destroy the record we just
// assigned, along with its call history, changelog and status.
//
// Targets `assignedTo: null` WITHOUT the status whitelist on purpose: a lead that was worked to
// 'interested' while nobody owned it is exactly the kind that should end up with its caller, and
// it is already invisible in the pool, so the status filter would only hide it from this fix.

// Phones per CallLog aggregation round trip.
const PHONE_BATCH = 500;

// Lead.phone is stored normalised to 10 digits and the call sync links on an exact match, but a
// number that arrived from a device in another shape was never linked and would otherwise be
// invisible to a count. Each variant is still an indexed equality on contactNumber_1.
function phoneVariants(phone) {
  return [phone, `91${phone}`, `+91${phone}`, `0${phone}`];
}

// Returns { examined, belowThreshold, assignable, unresolvable, assigned }.
// `assignable` entries are { lead, stats, user } so a caller can preview before writing.
// Pass dryRun: true to compute everything and write nothing.
async function assignOverAttemptedLeadsToLastCaller({
  minAttempts = MAX_POOL_ATTEMPTS,
  dryRun = false,
  onProgress,
} = {}) {
  // Only leads that could possibly qualify — `attempts` is maintained by the call sync, so this
  // is a cheap pre-filter that keeps the sweep off the whole unassigned set.
  const candidates = await Lead.find({ assignedTo: null, attempts: { $gt: minAttempts } })
    .select('name phone source status attempts pooledAt createdAt')
    .lean();

  if (!candidates.length) {
    return { examined: 0, belowThreshold: 0, assignable: [], unresolvable: [], assigned: 0 };
  }

  const leadByVariant = new Map();
  candidates.forEach((l) => phoneVariants(l.phone).forEach((v) => leadByVariant.set(v, l)));
  const allVariants = [...leadByVariant.keys()];

  // Per-number totals and the most recent caller, batched rather than one query per lead.
  const statsByLeadId = new Map();
  for (let i = 0; i < allVariants.length; i += PHONE_BATCH) {
    const batch = allVariants.slice(i, i + PHONE_BATCH);
    const rows = await CallLog.aggregate([
      { $match: { contactNumber: { $in: batch } } },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$contactNumber',
          total: { $sum: 1 },
          lastTimestamp:  { $first: '$timestamp' },
          lastEmployeeId: { $first: '$employeeId' },
          lastCallType:   { $first: '$callType' },
        },
      },
    ]);
    rows.forEach((r) => {
      const lead = leadByVariant.get(r._id);
      if (!lead) return;
      const key = String(lead._id);
      const prev = statsByLeadId.get(key) || { total: 0, lastTimestamp: null, lastEmployeeId: null, lastCallType: null };
      const next = { ...prev, total: prev.total + r.total };
      // Totals add across variants; "last caller" is the latest call across all of them.
      if (!prev.lastTimestamp || r.lastTimestamp > prev.lastTimestamp) {
        next.lastTimestamp  = r.lastTimestamp;
        next.lastEmployeeId = r.lastEmployeeId;
        next.lastCallType   = r.lastCallType;
      }
      statsByLeadId.set(key, next);
    });
    if (onProgress) onProgress(Math.min(i + PHONE_BATCH, allVariants.length), allVariants.length);
  }

  const overThreshold = [];
  const unresolvable = [];
  let belowThreshold = 0;
  const employeeIds = new Set();
  for (const lead of candidates) {
    // Trust the call log over the denormalised counter: Lead.attempts has drifted before (see
    // scripts/recalcLeadCallCounters.js), and acting on a stale count would move a lead nobody
    // has actually called three times.
    const st = statsByLeadId.get(String(lead._id));
    if (!st || st.total <= minAttempts) { belowThreshold++; continue; }
    if (!st.lastEmployeeId) { unresolvable.push({ lead, stats: st }); continue; }
    employeeIds.add(String(st.lastEmployeeId));
    overThreshold.push({ lead, stats: st });
  }

  const users = employeeIds.size
    ? await User.find({ _id: { $in: [...employeeIds] } }).select('name role isActive').lean()
    : [];
  const userById = new Map(users.map((u) => [String(u._id), u]));

  // A dangling employeeId would assign the lead to nobody reachable — worse than leaving it be.
  const assignable = [];
  for (const item of overThreshold) {
    const user = userById.get(String(item.stats.lastEmployeeId));
    if (!user) { unresolvable.push(item); continue; }
    assignable.push({ ...item, user });
  }

  if (dryRun || !assignable.length) {
    return { examined: candidates.length, belowThreshold, assignable, unresolvable, assigned: 0 };
  }

  // Mirrors POST /api/lead-pool/:id/claim, so a lead that leaves the pool this way is
  // indistinguishable from one an agent tapped "Attend" on.
  const now = new Date();
  const ops = assignable.map(({ lead, stats, user }) => ({
    updateOne: {
      // Re-assert `assignedTo: null` at write time: if an agent claimed this lead between the
      // read and the write, theirs wins and this op is a no-op.
      filter: { _id: lead._id, assignedTo: null },
      update: {
        $set: { assignedTo: stats.lastEmployeeId, claimedAt: now, claimedBy: stats.lastEmployeeId, pooledAt: null },
        $push: {
          changelog: {
            changedAt: now,
            changedByName: 'Auto-assign (last caller)',
            action: 'assigned',
            details: {
              source: 'pool_auto_assign_last_caller',
              reason: `${stats.total} calls on this number (limit is ${minAttempts})`,
              callCount: stats.total,
              lastCallAt: stats.lastTimestamp,
              lastCallType: stats.lastCallType,
              assignedToName: user.name,
            },
          },
        },
      },
    },
  }));

  let assigned = 0;
  for (let i = 0; i < ops.length; i += 500) {
    const res = await Lead.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    assigned += res.modifiedCount || 0;
  }

  return { examined: candidates.length, belowThreshold, assignable, unresolvable, assigned };
}

module.exports = { assignOverAttemptedLeadsToLastCaller, phoneVariants };
