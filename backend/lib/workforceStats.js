const mongoose = require('mongoose');
const CallLog = require('../models/CallLog');
const Lead = require('../models/Lead');
const { BANDS } = require('./engagement');

// Engagement counts ride along on the call-stats aggregation that already runs. Same $match,
// same index, so this costs one extra accumulator per band rather than a second round trip.
// Consumed by ryan-crm's Owner panel, which uses call duration (not Lead.status) as its
// interest signal — see the byEngagement note in emptyCallStats below.
const engagementAccumulators = Object.fromEntries(
  BANDS.map((b) => [`eng_${b.key}`, { $sum: { $cond: [{ $eq: ['$engagement', b.key] }, 1, 0] } }])
);

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
  return {
    total: 0, outgoing: 0, incoming: 0, missed: 0, rejected: 0, connected: 0,
    connectRate: 0, totalDurationSeconds: 0,
    // Every band key is always present and zeroed, never omitted — same contract the existing
    // emptyLeadStats().byStatus follows, so a consumer never has to guess whether a missing
    // key means zero or means "not implemented".
    byEngagement: Object.fromEntries(BANDS.map((b) => [b.key, 0])),
    engagementUnclassified: 0,
  };
}

function emptyLeadStats() {
  const byStatus = {};
  LEAD_STATUSES.forEach((s) => { byStatus[s] = 0; });
  return { assigned: 0, byStatus };
}

// How far back `calls` figures reach when the caller names no range at all. An unbounded
// default meant every no-param request re-aggregated the entire call history, which only ever
// gets slower — the cost of the default grew with the archive rather than with the question.
const DEFAULT_CALL_STATS_DAYS = 30;

// Resolves the effective window for call stats. Exported so the routes can report the range
// they ACTUALLY used rather than echoing back the (possibly absent) query params — a dashboard
// showing "last 30 days" numbers under a blank date range is how people misread a chart.
//
// A caller that supplies only one bound gets exactly that bound and no default on the other
// side: asking for "since March 1" means since March 1, not "the 30 days after March 1".
function resolveCallStatsRange(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) {
    const to = new Date();
    const from = new Date(to.getTime() - DEFAULT_CALL_STATS_DAYS * 24 * 60 * 60 * 1000);
    return { from, to, defaulted: true };
  }
  return {
    from: dateFrom ? new Date(dateFrom) : null,
    to:   dateTo   ? new Date(dateTo)   : null,
    defaulted: false,
  };
}

// Returns a Map (plain object keyed by employeeId string) of call-activity stats, scoped to
// `dateFrom`/`dateTo` on `timestamp` — this is the activity-in-period half of the picture.
//
// With NEITHER bound supplied this defaults to the last DEFAULT_CALL_STATS_DAYS days rather
// than all of history — see resolveCallStatsRange. Note this is the opposite choice from
// getLeadStatsByEmployee below, deliberately: call activity is a rate ("how much dialling
// happened"), which is meaningless without a window, while lead ownership is a standing
// balance that a window would distort.
//
// employeeIds: array of ObjectId|string to scope to. Required — callers always know which
// employees they're summarizing (the caller's own User query already picked the roster).
async function getCallStatsByEmployee({ employeeIds, dateFrom, dateTo }) {
  const match = { employeeId: { $in: employeeIds.map((id) => new mongoose.Types.ObjectId(id)) } };
  const range = resolveCallStatsRange(dateFrom, dateTo);
  if (range.from || range.to) {
    match.timestamp = {};
    if (range.from) match.timestamp.$gte = range.from;
    if (range.to)   match.timestamp.$lte = range.to;
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
        ...engagementAccumulators,
      },
    },
  ]);

  const map = {};
  rows.forEach((r) => {
    const total = r.total || 0;
    const connected = r.connected || 0;
    const byEngagement = Object.fromEntries(BANDS.map((b) => [b.key, r[`eng_${b.key}`] || 0]));
    map[r._id.toString()] = {
      total, outgoing: r.outgoing, incoming: r.incoming, missed: r.missed, rejected: r.rejected, connected,
      // Guarded so an agent with zero calls in range reads 0, never NaN.
      connectRate: total > 0 ? Math.round((connected / total) * 10000) / 10000 : 0,
      totalDurationSeconds: r.totalDurationSeconds || 0,
      byEngagement,
      // Rows synced before the engagement backfill ran have engagement: null and land in no
      // band, so these two will not always sum to `total`. Exposed so a consumer can tell
      // "zero such calls" apart from "not backfilled yet".
      engagementUnclassified: total - BANDS.reduce((s, b) => s + byEngagement[b.key], 0),
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

module.exports = {
  LEAD_STATUSES, DEFAULT_CALL_STATS_DAYS, resolveCallStatsRange,
  emptyCallStats, emptyLeadStats, getCallStatsByEmployee, getLeadStatsByEmployee,
};
