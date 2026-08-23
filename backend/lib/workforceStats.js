const mongoose = require('mongoose');
const CallLog = require('../models/CallLog');
const Lead = require('../models/Lead');

// Shared by workforce-summary and agent-detail (backend/routes/workforceSummary.js,
// backend/routes/agentDetail.js) so the same agent's numbers can never disagree between the two
// endpoints — both routes call these instead of each writing their own aggregation.

// Every lead status in the schema — always present in `byStatus` (zeroed, not omitted) so a
// consumer never has to guess whether a missing key means zero or means "not implemented yet".
const LEAD_STATUSES = [
  'new', 'contacted', 'not_connected', 'interested', 'not_interested',
  'follow_up', 'booking_done', 'converted', 'lost',
];

function emptyCallStats() {
  return { total: 0, outgoing: 0, incoming: 0, missed: 0, rejected: 0, connected: 0, connectRate: 0, totalDurationSeconds: 0 };
}

function emptyLeadStats() {
  const byStatus = {};
  LEAD_STATUSES.forEach((s) => { byStatus[s] = 0; });
  return { assigned: 0, byStatus };
}

// Returns a Map (plain object keyed by employeeId string) of call-activity stats, scoped to
// `dateFrom`/`dateTo` on `timestamp` — this is the activity-in-period half of the picture.
//
// employeeIds: array of ObjectId|string to scope to. Required — callers always know which
// employees they're summarizing (the caller's own User query already picked the roster).
async function getCallStatsByEmployee({ employeeIds, dateFrom, dateTo }) {
  const match = { employeeId: { $in: employeeIds.map((id) => new mongoose.Types.ObjectId(id)) } };
  if (dateFrom || dateTo) {
    match.timestamp = {};
    if (dateFrom) match.timestamp.$gte = new Date(dateFrom);
    if (dateTo) match.timestamp.$lte = new Date(dateTo);
  }

  const rows = await CallLog.aggregate([
    { $match: match },
    {
      $group: {
        _id:      '$employeeId',
        total:    { $sum: 1 },
        outgoing: { $sum: { $cond: [{ $eq: ['$callType', 'outgoing'] }, 1, 0] } },
        incoming: { $sum: { $cond: [{ $eq: ['$callType', 'incoming'] }, 1, 0] } },
        missed:   { $sum: { $cond: [{ $eq: ['$callType', 'missed'] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ['$callType', 'rejected'] }, 1, 0] } },
        // Connected = an outgoing/incoming call that actually lasted (duration > 0) — a missed
        // or rejected call, or a 0-second dial, never counts.
        connected: {
          $sum: {
            $cond: [
              { $and: [
                { $in: ['$callType', ['outgoing', 'incoming']] },
                { $gt: [{ $ifNull: ['$duration', 0] }, 0] },
              ] },
              1, 0,
            ],
          },
        },
        totalDurationSeconds: { $sum: { $ifNull: ['$duration', 0] } },
      },
    },
  ]);

  const map = {};
  rows.forEach((r) => {
    const total = r.total || 0;
    const connected = r.connected || 0;
    map[r._id.toString()] = {
      total, outgoing: r.outgoing, incoming: r.incoming, missed: r.missed, rejected: r.rejected, connected,
      // Guarded so an agent with zero calls in range reads 0, never NaN.
      connectRate: total > 0 ? Math.round((connected / total) * 10000) / 10000 : 0,
      totalDurationSeconds: r.totalDurationSeconds || 0,
    };
  });
  return map;
}

// Returns a Map of lead-ownership stats (current assignment snapshot).
//
// Deliberately NOT scoped by dateFrom/dateTo. Call stats (above) are activity-in-period — how
// much dialing happened in this window. Lead ownership is a different axis entirely: how big a
// book of business this agent is currently sitting on. Scoping that by `createdAt` would make an
// agent holding a large back-log of older, still-open leads look like they own zero leads for a
// "today" range, which *understates* their workload instead of describing it — the opposite of
// what a manager opening this dashboard wants. So this is always a present-moment snapshot,
// filtered only to the employee roster the caller already resolved.
async function getLeadStatsByEmployee({ employeeIds }) {
  const match = { assignedTo: { $in: employeeIds.map((id) => new mongoose.Types.ObjectId(id)) } };

  const rows = await Lead.aggregate([
    { $match: match },
    { $group: { _id: { employeeId: '$assignedTo', status: '$status' }, count: { $sum: 1 } } },
  ]);

  const map = {};
  rows.forEach((r) => {
    const id = r._id.employeeId.toString();
    if (!map[id]) map[id] = emptyLeadStats();
    map[id].assigned += r.count;
    if (map[id].byStatus[r._id.status] !== undefined) map[id].byStatus[r._id.status] += r.count;
  });
  return map;
}

module.exports = { LEAD_STATUSES, emptyCallStats, emptyLeadStats, getCallStatsByEmployee, getLeadStatsByEmployee };
