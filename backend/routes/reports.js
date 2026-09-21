const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const CallLog = require('../models/CallLog');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { protect, isAdmin, requireManagement, isSystemAdmin } = require('../middleware/auth');
const { getScopedEmployeeIds, validateEmployeeInScope, resolveEmployeeFilter } = require('../lib/scope');
const { resolveEmployeeIdsForTL } = require('../lib/tlFilter');
const { createPendingDownloadJob, completeDownloadJob, failDownloadJob } = require('../lib/downloadJobs');
const fmtDuration = require('../lib/formatDuration');
const reportCache = require('../lib/reportCache');

// Parses a 'YYYY-MM-DD' IST calendar-date string (as sent by the dashboard's
// date-range filters) into the UTC instant of that day's IST start/end — using
// the server's local time here (as the old `new Date(str); setHours(...)` code
// did) would shift the boundary by up to 5.5h wherever the server isn't IST,
// causing report totals to disagree with the /calls/stats and /leads counts
// that deep-linked dashboard/overview cards promise to match.
function istDateStrStart(dateStr) {
  return new Date(`${dateStr}T00:00:00+05:30`);
}
function istDateStrEnd(dateStr) {
  return new Date(istDateStrStart(dateStr).getTime() + 24 * 60 * 60 * 1000 - 1);
}

function istDayStart(offsetDays = 0) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  nowIST.setUTCHours(0, 0, 0, 0);
  nowIST.setUTCDate(nowIST.getUTCDate() + offsetDays);
  return new Date(nowIST.getTime() - IST_OFFSET_MS);
}

// Helper: get employee display name from a populated call doc
function empName(c)  { return c.employeeId?.name  || 'Unknown'; }
function empPhone(c) { return c.employeeId?.phone || ''; }
function empTL(c)    { return c.employeeId?.tlName || ''; }

// IST-aware bucketing helpers (server runs in UTC on most hosts — never use
// Date#getHours()/#toLocaleDateString() without timeZone, it silently
// buckets calls into the wrong day/hour once deployed).
function istHourOf(ts) {
  return parseInt(
    new Date(ts).toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }),
    10
  );
}
function istDayKey(ts) {
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}
function istDayLabel(ts) {
  return new Date(ts).toLocaleDateString('en-GB', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: '2-digit', month: 'short', year: 'numeric'
  });
}
function hourSlotLabel(h) {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:00 – ${String(h12).padStart(2, '0')}:59 ${ampm}`;
}
// Mongo-level filters so callHistory's separate paginated query (which never
// loads the full call list into memory) stays consistent with the other tabs.
function applyDurationFilter(filter, duration) {
  if (duration === '0-60') filter.duration = { $gte: 0, $lt: 60 };
  else if (duration === '60-300') filter.duration = { $gte: 60, $lt: 300 };
  else if (duration === '300+') filter.duration = { $gte: 300 };
}
// Added for ryan-crm's Owner Panel call report (/owner/calls/report) — a
// simple "hide unanswered calls" toggle, additive alongside the bucketed
// `duration` filter above (a caller should pass one or the other, not both).
function applyConnectedOnlyFilter(filter, connectedOnly) {
  if (connectedOnly === 'true') filter.duration = { ...(filter.duration || {}), $gt: 0 };
}
function applyCallTimeFilter(filter, callTime) {
  const ranges = { morning: [6, 12], afternoon: [12, 18], evening: [18, 24] };
  const r = ranges[callTime];
  if (!r) return;
  const hourExpr = { $hour: { date: '$timestamp', timezone: 'Asia/Kolkata' } };
  filter.$expr = { $and: [{ $gte: [hourExpr, r[0]] }, { $lt: [hourExpr, r[1]] }] };
}


const IST_TZ = 'Asia/Kolkata';

const isConnected = { $gt: ['$duration', 0] };
const typeIs = (t) => ({ $eq: ['$callType', t] });
const countIf = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });
const anyIf = (cond) => ({ $max: { $cond: [cond, 1, 0] } });

/*
 * MEMORY BUDGET — read before adding an accumulator to any $group below.
 *
 * This deployment refuses `allowDiskUse` (an Atlas shared tier: the driver sends the option and
 * the server rejects it), so every $group and $sort is hard-capped at 100MB of in-memory state
 * with no spill. That is not a tuning knob — a pipeline that exceeds it fails the request with
 * "Exceeded memory limit for $group". A $facet sub-pipeline cannot even be offered the option.
 *
 * The binding number is bucket COUNT x bucket SIZE, and the counts here are large:
 *   ~474k calls  ->  ~136k distinct contact numbers  ->  ~272k distinct (employee, number)
 * Those barely move between a 90-day window and the whole collection, because the business
 * re-dials the same customers rather than adding new ones.
 *
 * The rule that follows: group at a high-cardinality key ONLY with the few small accumulators
 * that genuinely need that grain. A first attempt carried all fourteen per-employee counters at
 * (employee, number) grain and died at roughly 272k x ~350B.
 *
 * Two consequences shape everything below:
 *   - Bounded groups (call type: 4, hour: 24, employee: dozens, day: one per day in range) are
 *     cheap enough to share a single $facet, so they cost one pass between them.
 *   - The one unavoidable high-cardinality pass groups at (employee, number) carrying three 1/0
 *     flags, and then a $facet re-groups that *intermediate* — by employee for the per-employee
 *     set metrics, by number for the global ones. Both re-groups are small, so the whole
 *     report's set-shaped metrics cost one pass rather than one pass each.
 *
 * Anything needed only for the rows actually rendered — employee names, contact names — is
 * resolved AFTER paging by pageDetailsByNumber, never accumulated across the range.
 */

// --- bounded branches, safe to share one $facet -------------------------------------------

const BY_TYPE_BRANCH = [
  {
    $group: {
      _id: '$callType',
      calls: { $sum: 1 },
      duration: { $sum: '$duration' },
      connected: countIf(isConnected),
    },
  },
];

// Grand totals, and NOT the sum of BY_TYPE_BRANCH's four enum buckets — the live collection
// holds 634 calls with callType "unknown", written through a path that skipped schema
// validation. The old JS totalled `calls.length` and summed durations over every call it had
// loaded, so those rows count toward the total, the working-hours figure and the connected
// count even though they appear under no type. Summing the four buckets instead would quietly
// drop them and make every headline number disagree with the previous report.
const ALL_TOTALS_BRANCH = [
  {
    $group: {
      _id: null,
      calls: { $sum: 1 },
      duration: { $sum: '$duration' },
      connected: countIf(isConnected),
    },
  },
];

// One bucket per employee, so this side can afford every counter the table shows. Names are
// NOT looked up here: that would be a $lookup inside a $facet, and resolving a few dozen ids
// with one User.find afterwards is both cheaper and plainly legal.
const EMPLOYEE_COUNTER_BRANCH = [
  { $match: { employeeId: { $ne: null } } },
  {
    $group: {
      _id: '$employeeId',
      totalCalls: { $sum: 1 },
      totalDuration: { $sum: '$duration' },
      connectedCalls: countIf(isConnected),
      incoming: countIf(typeIs('incoming')),
      incomingDuration: { $sum: { $cond: [typeIs('incoming'), '$duration', 0] } },
      incomingConnected: countIf({ $and: [typeIs('incoming'), isConnected] }),
      outgoing: countIf(typeIs('outgoing')),
      outgoingDuration: { $sum: { $cond: [typeIs('outgoing'), '$duration', 0] } },
      outgoingConnected: countIf({ $and: [typeIs('outgoing'), isConnected] }),
      missed: countIf(typeIs('missed')),
      rejected: countIf(typeIs('rejected')),
      lastSyncTime: { $max: '$timestamp' },
    },
  },
];

const HOURLY_BRANCH = [
  {
    $group: {
      _id: { $hour: { date: '$timestamp', timezone: IST_TZ } },
      totalCalls: { $sum: 1 },
      connected: countIf(isConnected),
    },
  },
];

const DAY_COUNT_BRANCH = [
  { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: IST_TZ } } } },
  { $count: 'n' },
];

// --- the one high-cardinality pass ---------------------------------------------------------

// Collapses to one row per (employee, contact number) carrying only three 1/0 flags — the
// minimum needed to answer every "distinct" question the report asks. The two branches below
// re-group this intermediate rather than the call collection.
const PAIR_GROUP = {
  $group: {
    _id: { e: '$employeeId', n: '$contactNumber' },
    hadMissed: anyIf(typeIs('missed')),
    hadOutgoing: anyIf(typeIs('outgoing')),
    hadConnected: anyIf(isConnected),
  },
};

// Per employee: at (employee, number) grain `$sum: 1` *is* the distinct-client count, and a
// number this employee missed but never dialled back *is* a never-attended.
const PER_EMPLOYEE_BRANCH = [
  { $match: { '_id.e': { $ne: null } } },
  {
    $group: {
      _id: '$_id.e',
      uniqueClients: { $sum: 1 },
      neverAttended: countIf({ $and: [{ $eq: ['$hadMissed', 1] }, { $eq: ['$hadOutgoing', 0] }] }),
    },
  },
];

// Globally: fold the per-employee rows back down to one row per number first, so "missed by
// one agent, dialled by another" correctly counts as attended — then to a single total row.
const PER_NUMBER_BRANCH = [
  {
    $group: {
      _id: '$_id.n',
      hadMissed: { $max: '$hadMissed' },
      hadOutgoing: { $max: '$hadOutgoing' },
      hadConnected: { $max: '$hadConnected' },
    },
  },
  {
    $group: {
      _id: null,
      uniqueClients: { $sum: 1 },
      uniqueConnectedCalls: { $sum: '$hadConnected' },
      neverAttended: countIf({ $and: [{ $eq: ['$hadMissed', 1] }, { $eq: ['$hadOutgoing', 0] }] }),
    },
  },
];

// --- shaping ------------------------------------------------------------------------------

// Employee names for the handful of ids a rollup produced. One query, off the primary key.
async function employeeNameMap(counterRows) {
  const ids = counterRows.map((r) => r._id).filter(Boolean);
  if (!ids.length) return new Map();
  const users = await User.find({ _id: { $in: ids } }).select('name tlName').lean();
  return new Map(users.map((u) => [String(u._id), u]));
}

// `setRows` is optional: the analysis tab reads only the scalar counters, so it skips the
// (employee, number) pass entirely rather than computing set metrics it never renders.
async function shapeEmployeeRollup(counterRows, setRows) {
  const names = await employeeNameMap(counterRows);
  const sets = new Map((setRows || []).map((r) => [String(r._id), r]));
  return counterRows
    .map((c) => {
      const id = String(c._id);
      const u = names.get(id) || {};
      const s = sets.get(id) || {};
      return {
        employeeId: id,
        employeeName: u.name || 'Unknown',
        tlName: u.tlName || '',
        totalCalls: c.totalCalls,
        connectedCalls: c.connectedCalls,
        incoming: c.incoming,
        incomingConnected: c.incomingConnected,
        outgoing: c.outgoing,
        outgoingConnected: c.outgoingConnected,
        missed: c.missed,
        rejected: c.rejected,
        notPickupByClient: c.outgoing - c.outgoingConnected,
        uniqueClients: s.uniqueClients || 0,
        neverAttended: s.neverAttended || 0,
        lastSyncTime: c.lastSyncTime,
        totalDurationSec: c.totalDuration,
        totalDuration: fmtDuration(c.totalDuration),
        incomingDuration: fmtDuration(c.incomingDuration),
        outgoingDuration: fmtDuration(c.outgoingDuration),
      };
    })
    .sort((a, b) => b.totalCalls - a.totalCalls);
}

// Per-number detail for the rows of ONE page: who called the number, and the contact name as
// of its most recent call.
//
// Both were originally accumulated for every number in the range ($addToSet for the employees,
// and the name carried alongside a max timestamp) and then discarded for all but the ~50 rows
// rendered — the single largest term in those groups. Scoped to one page's numbers this is a
// short walk of { contactNumber: 1, timestamp: 1 }, and $sort + $first reproduce the old
// "name from the newest call" semantics exactly rather than approximating them.
async function pageDetailsByNumber(pre, numbers, extraMatch) {
  if (!numbers.length) return new Map();
  const rows = await CallLog.aggregate([
    ...pre,
    { $match: { contactNumber: { $in: numbers }, ...(extraMatch || {}) } },
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: '$contactNumber',
        contactName: { $first: '$contactName' },
        emps: { $addToSet: '$employeeId' },
      },
    },
    { $lookup: { from: 'users', localField: 'emps', foreignField: '_id', as: 'u' } },
    { $project: { contactName: 1, names: '$u.name' } },
  ]);
  return new Map(
    rows.map((r) => [r._id, { contactName: r.contactName, employees: r.names || [] }]),
  );
}

// GET /api/reports/periodic — full periodic report
router.get('/periodic', protect, requireManagement, async (req, res) => {
  try {
    const {
      startDate, endDate, employeeId, callType, duration, callTime, tlName, source, search,
      connectedOnly, tab = 'summary', page = 1, limit = 100,
    } = req.query;

    const { allowed, filter: scopeFilter, error } = await resolveEmployeeFilter(req.user, employeeId, 'employeeId');
    if (!allowed) {
      return res.status(403).json({ success: false, error });
    }

    // Helper used throughout this route to safely cast string ids coming from
    // resolveEmployeeFilter / resolveEmployeeIdsForTL to ObjectId for $in arrays.
    const toObjectId = (id) =>
      typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)
        ? new mongoose.Types.ObjectId(id)
        : id;

    const start = startDate ? istDateStrStart(startDate) : istDayStart(0);
    const end = endDate ? istDateStrEnd(endDate) : new Date();
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(1000, Math.max(1, parseInt(limit, 10) || 100));
    const skip = (pageNum - 1) * pageSize;

    // Start from the RBAC scope filter — this is the authoritative employee boundary.
    // scopeFilter already contains `employeeId: <value>` when resolveEmployeeFilter
    // validated (and accepted) the `employeeId` query param, or `employeeId: {$in: [...]}`
    // when the user is a manager/TL whose scope is restricted.
    const filter = { ...scopeFilter, timestamp: { $gte: start, $lte: end } };

    // Ensure the employeeId field in filter uses ObjectId values, not raw strings.
    if (filter.employeeId) {
      if (filter.employeeId.$in) {
        filter.employeeId = { $in: filter.employeeId.$in.map(toObjectId) };
      } else {
        filter.employeeId = toObjectId(filter.employeeId);
      }
    }

    // tlName: further narrows the authorized scope to a specific TL's employees.
    // If the scopeFilter already restricts employeeId, intersect — never expand.
    if (!employeeId && tlName) {
      const tlEmpIds = await resolveEmployeeIdsForTL(tlName);
      if (filter.employeeId && filter.employeeId.$in) {
        const scopedStrs = new Set(filter.employeeId.$in.map((id) => id.toString()));
        filter.employeeId = { $in: tlEmpIds.filter((id) => scopedStrs.has(id.toString())).map(toObjectId) };
      } else if (filter.employeeId) {
        // scope was a single id — keep only if it's within the TL's team
        const scopedStr = filter.employeeId.toString();
        const match = tlEmpIds.find((id) => id.toString() === scopedStr);
        filter.employeeId = match ? toObjectId(match) : { $in: [] };
      } else {
        filter.employeeId = { $in: tlEmpIds.map(toObjectId) };
      }
    }

    if (callType) filter.callType = callType;
    // Source lives on the linked Lead, not the call itself — resolve to the matching lead ids
    // first so every tab below (they all read off the same `filter`) narrows consistently. A
    // call with no leadId (never linked to a lead) has no source and is excluded by this filter.
    if (source) {
      const matchingLeadIds = await Lead.find({ source: { $regex: source, $options: 'i' } }).distinct('_id');
      filter.leadId = { $in: matchingLeadIds.map(toObjectId) };
    }
    // Added for ryan-crm's Owner Panel call report — "search by number" (also
    // matches contact name), same pattern as GET /api/calls's own `search`.
    if (search) {
      filter.$or = [
        { contactNumber: { $regex: search, $options: 'i' } },
        { contactName: { $regex: search, $options: 'i' } },
      ];
    }
    applyDurationFilter(filter, duration);
    applyConnectedOnlyFilter(filter, connectedOnly);
    applyCallTimeFilter(filter, callTime);

    // The call-time filter is an `$expr` on $hour, which no index can serve. Kept in its own
    // second $match so the first one still resolves as an index range on timestamp/employeeId
    // instead of degrading the whole pipeline into a collection scan. (`filter` itself stays
    // whole for the plain `find()` paths further down, where Mongo does this split itself.)
    const baseMatch = { ...filter };
    delete baseMatch.$expr;
    const pre = filter.$expr
      ? [{ $match: baseMatch }, { $match: { $expr: filter.$expr } }]
      : [{ $match: baseMatch }];

    const agg = (stages) => CallLog.aggregate([...pre, ...stages]).allowDiskUse(true);

    // Cache key must cover every input that changes the answer, including the caller's authorization scope.
    const userScopeKey = req.user && (req.user.role === 'admin' || req.user.isSuperAdmin)
      ? 'admin'
      : (req.user?._id?.toString() || 'anon');

    const cacheParts = [
      'periodic', userScopeKey, tab, start.getTime(), end.getTime(), employeeId || '', tlName || '',
      callType || '', duration || '', callTime || '', source || '', search || '',
      connectedOnly || '', pageNum, pageSize,
    ];
    // callHistory is deliberately uncached: it is the one tab whose rows are editable from the
    // dashboard (inline remarks), so serving a 45s-old copy would show a manager their own edit
    // reverting. It is also the cheapest tab — one paginated find — so it has least to gain.
    const cached = (producer) =>
      tab === 'callHistory' ? producer() : reportCache.memo(cacheParts, producer);

    const dateLabel =
      start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      (startDate !== endDate
        ? ' to ' + end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : '');

    if (tab === 'summary') {
      const data = await cached(async () => {
        // Two passes over the range, concurrently: one for every bounded group (call type and
        // per-employee counters share a $facet because both are tiny), one for the distinct-
        // count metrics, whose $facet re-groups the (employee, number) intermediate by employee
        // and by number instead of re-reading the collection for each.
        const [[bounded], [distinct]] = await Promise.all([
          agg([
            {
              $facet: {
                byType: BY_TYPE_BRANCH,
                all: ALL_TOTALS_BRANCH,
                empCounters: EMPLOYEE_COUNTER_BRANCH,
              },
            },
          ]),
          agg([
            PAIR_GROUP,
            { $facet: { perEmployee: PER_EMPLOYEE_BRANCH, perNumber: PER_NUMBER_BRANCH } },
          ]),
        ]);

        const t = {};
        for (const r of bounded?.byType || []) t[r._id] = r;
        const n = (k, f = 'calls') => t[k]?.[f] || 0;
        const nums = distinct?.perNumber?.[0] || {
          uniqueClients: 0, uniqueConnectedCalls: 0, neverAttended: 0,
        };

        const all = bounded?.all?.[0] || { calls: 0, duration: 0, connected: 0 };
        const totalCalls = all.calls;
        const totalDuration = all.duration;
        const connectedCalls = all.connected;

        return {
          dateLabel,
          summary: {
            incoming: { calls: n('incoming'), duration: fmtDuration(n('incoming', 'duration')) },
            outgoing: { calls: n('outgoing'), duration: fmtDuration(n('outgoing', 'duration')) },
            missed: { calls: n('missed'), duration: '—' },
            rejected: { calls: n('rejected'), duration: '—' },
            total: { calls: totalCalls, duration: fmtDuration(totalDuration) },
          },
          sidebarStats: {
            neverAttended: nums.neverAttended,
            notPickupByClient: n('outgoing') - n('outgoing', 'connected'),
            connectedCalls,
            uniqueConnectedCalls: nums.uniqueConnectedCalls,
            uniqueClients: nums.uniqueClients,
            workingHours: fmtDuration(totalDuration),
          },
          pieData: [
            { name: 'Incoming', value: n('incoming'), color: '#34C759' },
            { name: 'Outgoing', value: n('outgoing'), color: '#FF9500' },
            { name: 'Missed', value: n('missed'), color: '#FF3B30' },
            { name: 'Rejected', value: n('rejected'), color: '#7C3AED' },
          ].filter((d) => d.value > 0),
          employeeSummary: await shapeEmployeeRollup(
            bounded?.empCounters || [],
            distinct?.perEmployee || []
          ),
        };
      });
      return res.json({ success: true, data });
    }

    if (tab === 'daywise' || tab === 'dayWise') {
      const data = await cached(async () => {
        const rows = await agg([
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: IST_TZ } },
              totalCalls: { $sum: 1 },
              duration: { $sum: '$duration' },
              connected: countIf(isConnected),
              incoming: countIf(typeIs('incoming')),
              outgoing: countIf(typeIs('outgoing')),
              missed: countIf(typeIs('missed')),
              rejected: countIf(typeIs('rejected')),
            },
          },
          { $sort: { _id: -1 } },
        ]);
        return {
          daywise: rows.map((d) => ({
            date: d._id,
            label: istDayLabel(`${d._id}T00:00:00+05:30`),
            totalCalls: d.totalCalls,
            connected: d.connected,
            incoming: d.incoming,
            outgoing: d.outgoing,
            missed: d.missed,
            rejected: d.rejected,
            duration: fmtDuration(d.duration),
          })),
        };
      });
      return res.json({ success: true, data });
    }

    if (tab === 'hourly') {
      const data = await cached(async () => {
        const rows = await agg([
          {
            $group: {
              _id: { $hour: { date: '$timestamp', timezone: IST_TZ } },
              totalCalls: { $sum: 1 },
              duration: { $sum: '$duration' },
              connected: countIf(isConnected),
              incoming: countIf(typeIs('incoming')),
              outgoing: countIf(typeIs('outgoing')),
              missed: countIf(typeIs('missed')),
              rejected: countIf(typeIs('rejected')),
            },
          },
        ]);
        const hourly = Array.from({ length: 24 }, (_, h) => ({
          hour: h, label: hourSlotLabel(h),
          totalCalls: 0, connected: 0, incoming: 0, outgoing: 0, missed: 0, rejected: 0, duration: 0,
        }));
        let totalAll = 0;
        for (const r of rows) {
          const h = hourly[r._id];
          if (!h) continue;
          Object.assign(h, {
            totalCalls: r.totalCalls, connected: r.connected, incoming: r.incoming,
            outgoing: r.outgoing, missed: r.missed, rejected: r.rejected, duration: r.duration,
          });
          totalAll += r.totalCalls;
        }
        const denom = totalAll || 1;
        return {
          hourly: hourly.map((h) => ({
            ...h,
            duration: fmtDuration(h.duration),
            pct: Number(((h.totalCalls / denom) * 100).toFixed(2)),
          })),
        };
      });
      return res.json({ success: true, data });
    }

    if (tab === 'analysis') {
      const data = await cached(async () => {
        // Every group this tab needs is bounded — 24 hours, 4 call types, one bucket per day,
        // one per employee — so they all share a single $facet and a single pass. This tab
        // deliberately does NOT run the (employee, number) pass: it reads only the scalar
        // counters below (top dialer / receiver / caller / talk time), never uniqueClients or
        // neverAttended, so computing those would be a second full scan for nothing.
        const [[facet], longestRows] = await Promise.all([
          agg([
            {
              $facet: {
                hourly: HOURLY_BRANCH,
                byType: BY_TYPE_BRANCH,
                all: ALL_TOTALS_BRANCH,
                days: DAY_COUNT_BRANCH,
                empCounters: EMPLOYEE_COUNTER_BRANCH,
              },
            },
          ]),
          // Ties resolve to the newest call, as the old "strictly greater" JS scan over a
          // timestamp-desc list did. The `$gt: 0` is not an optimisation: that scan seeded
          // `longestCall` with null and compared `> (longestCall?.durationSec || 0)`, so a
          // range in which every call has zero duration yields no longest call at all.
          agg([
            { $match: { duration: { $gt: 0 } } },
            { $sort: { duration: -1, timestamp: -1 } },
            { $limit: 1 },
            { $lookup: { from: 'users', localField: 'employeeId', foreignField: '_id', as: 'emp' } },
            {
              $project: {
                _id: 0, duration: 1, callType: 1, contactNumber: 1,
                contactName: { $ifNull: ['$contactName', 'Unknown'] },
                timestamp: 1,
                employeeName: { $ifNull: [{ $arrayElemAt: ['$emp.name', 0] }, 'Unknown'] },
              },
            },
          ]),
        ]);

        const hourly = Array.from({ length: 24 }, (_, h) => ({
          hour: h, label: hourSlotLabel(h), totalCalls: 0, connected: 0,
        }));
        for (const r of facet?.hourly || []) {
          if (hourly[r._id]) {
            hourly[r._id].totalCalls = r.totalCalls;
            hourly[r._id].connected = r.connected;
          }
        }

        const emps = await shapeEmployeeRollup(facet?.empCounters || []);
        const pick = (field) =>
          emps.reduce((best, e) => (!best || e[field] > best[field] ? e : best), null);
        const byCount = (e, field) => (e ? { employeeName: e.employeeName, count: e[field] } : null);

        // `totalDuration` is the formatted string by this point — compare the seconds.
        const topDurationEmp = pick('totalDurationSec');
        const t = {};
        for (const r of facet?.byType || []) t[r._id] = r;
        const n = (k, f = 'calls') => t[k]?.[f] || 0;

        // Across every call, including the out-of-enum ones — see ALL_TOTALS_BRANCH.
        const totalDuration = facet?.all?.[0]?.duration || 0;
        const dayCount = facet?.days?.[0]?.n || 1;
        const longestRaw = longestRows[0] || null;

        return {
          hourly,
          topDialer: byCount(pick('outgoing'), 'outgoing'),
          topReceiver: byCount(pick('incoming'), 'incoming'),
          topOverall: byCount(pick('totalCalls'), 'totalCalls'),
          mostDuration: topDurationEmp
            ? { employeeName: topDurationEmp.employeeName, duration: topDurationEmp.totalDuration }
            : null,
          longestCall: longestRaw
            ? { ...longestRaw, durationSec: longestRaw.duration || 0, duration: fmtDuration(longestRaw.duration || 0) }
            : null,
          avgIncomingDuration: fmtDuration(
            n('incoming', 'connected') ? Math.round(n('incoming', 'duration') / n('incoming', 'connected')) : 0
          ),
          avgOutgoingDuration: fmtDuration(
            n('outgoing', 'connected') ? Math.round(n('outgoing', 'duration') / n('outgoing', 'connected')) : 0
          ),
          avgPerDay: fmtDuration(Math.round(totalDuration / dayCount)),
          dayCount,
        };
      });
      return res.json({ success: true, data });
    }

    if (tab === 'neverAttended') {
      const data = await cached(async () => {
        // Count and page as two top-level pipelines instead of one $facet, for the same
        // reason as the summary tab: this group holds a bucket per distinct contact number,
        // well past what a $facet sub-pipeline can hold when it is unable to spill to disk.
        const core = [
          {
            $group: {
              _id: '$contactNumber',
              hadOutgoing: anyIf(typeIs('outgoing')),
              missedCount: countIf(typeIs('missed')),
              lastMissedAt: { $max: { $cond: [typeIs('missed'), '$timestamp', null] } },
            },
          },
          { $match: { hadOutgoing: 0, missedCount: { $gt: 0 } } },
        ];
        const [countRows, rows] = await Promise.all([
          agg([...core, { $count: 'n' }]),
          // Newest miss first — the old code walked a timestamp-desc list and kept first-seen
          // order, which is the same ordering. It matters because the tab is paginated.
          agg([...core, { $sort: { lastMissedAt: -1, _id: 1 } }, { $skip: skip }, { $limit: pageSize }]),
        ]);

        // Who missed the call, and the name as of the latest miss. Scoped to missed calls:
        // these numbers have no outgoing call in range by definition, but saying so is clearer
        // than relying on it.
        const details = await pageDetailsByNumber(pre, rows.map((r) => r._id), { callType: 'missed' });

        const total = countRows[0]?.n || 0;
        return {
          total,
          records: rows.map((r) => ({
            contactNumber: r._id,
            contactName: details.get(r._id)?.contactName || 'Unknown',
            missedCount: r.missedCount,
            lastMissedAt: r.lastMissedAt,
            employees: details.get(r._id)?.employees || [],
          })),
          pages: Math.ceil(total / pageSize),
        };
      });
      return res.json({ success: true, data });
    }

    if (tab === 'notPickupByClient' || tab === 'notPickup') {
      const data = await cached(async () => {
        // "Outgoing that the client never picked up" narrows the same filter rather than
        // re-deriving it from a full in-memory list. An explicit callType filter for some
        // *other* type can't also be outgoing, so it yields nothing — matching the old
        // behaviour, where `byType.outgoing` was empty because the query excluded it.
        if (filter.callType && filter.callType !== 'outgoing') {
          return { total: 0, records: [], pages: 0 };
        }
        const npFilter = {
          ...filter,
          callType: 'outgoing',
          duration: { ...(filter.duration || {}), $lte: 0 },
        };
        const [total, rows] = await Promise.all([
          CallLog.countDocuments(npFilter),
          CallLog.find(npFilter)
            .select('contactNumber contactName employeeId timestamp callType')
            .populate('employeeId', 'name')
            .sort({ timestamp: -1, _id: -1 })
            .skip(skip)
            .limit(pageSize)
            .lean(),
        ]);
        return {
          total,
          records: rows.map((c) => ({
            _id: c._id,
            contactNumber: c.contactNumber,
            contactName: c.contactName || 'Unknown',
            employeeName: empName(c),
            timestamp: c.timestamp,
            callType: c.callType,
          })),
          pages: Math.ceil(total / pageSize),
        };
      });
      return res.json({ success: true, data });
    }

    if (tab === 'uniqueClients') {
      const data = await cached(async () => {
        const [countRows, rows] = await Promise.all([
          // Counting distinct numbers needs none of the per-number counters, so it groups on
          // the key alone — a far smaller pipeline than reusing the one below.
          agg([{ $group: { _id: '$contactNumber' } }, { $count: 'n' }]),
          agg([
            {
              $group: {
                _id: '$contactNumber',
                totalCalls: { $sum: 1 },
                totalDuration: { $sum: '$duration' },
                connectedCalls: countIf(isConnected),
                incoming: countIf(typeIs('incoming')),
                outgoing: countIf(typeIs('outgoing')),
                missed: countIf(typeIs('missed')),
                lastCallAt: { $max: '$timestamp' },
              },
            },
            // Most-recently-called first. This ordering is load-bearing, not cosmetic: the tab
            // is paginated, so sorting differently would put different clients on page 2 than
            // the old code did. It walked a timestamp-desc list and kept first-seen order,
            // which is exactly "newest last call first".
            { $sort: { lastCallAt: -1, _id: 1 } },
            { $skip: skip },
            { $limit: pageSize },
          ]),
        ]);

        const details = await pageDetailsByNumber(pre, rows.map((r) => r._id));

        const total = countRows[0]?.n || 0;
        return {
          total,
          records: rows.map((r) => ({
            contactNumber: r._id,
            contactName: details.get(r._id)?.contactName || 'Unknown',
            totalCalls: r.totalCalls,
            connectedCalls: r.connectedCalls,
            incoming: r.incoming,
            outgoing: r.outgoing,
            missed: r.missed,
            totalDuration: fmtDuration(r.totalDuration),
            lastCallAt: r.lastCallAt,
            employees: details.get(r._id)?.employees || [],
          })),
          pages: Math.ceil(total / pageSize),
        };
      });
      return res.json({ success: true, data });
    }

    if (tab === 'callHistory') {
      const data = await cached(async () => {
        const [total, historyCalls] = await Promise.all([
          CallLog.countDocuments(filter),
          CallLog.find(filter)
            .select('employeeId callType contactNumber contactName duration timestamp notes callStatus notesUpdatedAt notesUpdatedByName leadId')
            .populate('employeeId', 'name phone tlName')
            .populate('leadId', 'source')
            .sort({ timestamp: -1, _id: -1 })
            .skip(skip)
            .limit(pageSize)
            .lean(),
        ]);

        // Global first-ever-contact check for the visible page only (cheap —
        // one page's worth of numbers), mirrors the New/Repeat export column.
        const numbers = [...new Set(historyCalls.map((c) => c.contactNumber).filter(Boolean))];
        const firstSeenAgg = numbers.length
          ? await CallLog.aggregate([
              { $match: { contactNumber: { $in: numbers } } },
              { $group: { _id: '$contactNumber', first: { $min: '$timestamp' } } },
            ])
          : [];
        const firstSeenMap = new Map(firstSeenAgg.map((r) => [r._id, new Date(r.first).getTime()]));

        return {
          total,
          calls: historyCalls.map((c) => ({
            ...c,
            employeeName: empName(c),
            employeePhone: empPhone(c),
            employeeTL: empTL(c),
            source: c.leadId?.source || null,
            contactType:
              firstSeenMap.get(c.contactNumber) === new Date(c.timestamp).getTime() ? 'New' : 'Repeat',
          })),
          pages: Math.ceil(total / pageSize),
          page: pageNum,
        };
      });
      return res.json({ success: true, data });
    }

    // Unknown tab — the employee rollup alone, as before.
    const data = await cached(async () => {
      const [counters, [distinct]] = await Promise.all([
        agg(EMPLOYEE_COUNTER_BRANCH),
        agg([PAIR_GROUP, { $facet: { perEmployee: PER_EMPLOYEE_BRANCH } }]),
      ]);
      return {
        employeeSummary: await shapeEmployeeRollup(counters, distinct?.perEmployee || []),
        dateLabel: start.toLocaleDateString('en-GB'),
      };
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Lead status keys/labels — mirrors dashboard/src/app/(protected)/reports/lead/page.js STATUS_META

const LEAD_STATUS_LABELS = {
  new:            'New',
  contacted:      'Contacted',
  not_connected:  'Not Connected',
  interested:     'Interested',
  not_interested: 'Not Interested',
  follow_up:      'Follow-up',
  booking_done:   'Booking Done',
  converted:      'Converted',
  lost:           'Lost'
};
const LEAD_STATUS_KEYS = Object.keys(LEAD_STATUS_LABELS);

function applyLeadTimeFilter(filter, leadTime) {
  const ranges = { morning: [6, 12], afternoon: [12, 18], evening: [18, 24] };
  const r = ranges[leadTime];
  if (!r) return;
  const hourExpr = { $hour: { date: '$createdAt', timezone: 'Asia/Kolkata' } };
  filter.$expr = { $and: [{ $gte: [hourExpr, r[0]] }, { $lt: [hourExpr, r[1]] }] };
}
function round1(n) { return Math.round(n * 10) / 10; }


const leadIsContacted = { $gt: ['$attempts', 0] };
const statusIs = (s) => ({ $eq: ['$status', s] });

// Per-assignee rollup. `assignedTo` is null for pool leads, which $group keeps as its own
// bucket — that bucket is the "Unassigned" row the old JS built under the 'unassigned' key.
const LEAD_EMPLOYEE_STAGES = [
  {
    $group: {
      _id: '$assignedTo',
      total: { $sum: 1 },
      new: countIf(statusIs('new')),
      contacted: countIf(statusIs('contacted')),
      follow_up: countIf(statusIs('follow_up')),
      converted: countIf(statusIs('converted')),
      lost: countIf(statusIs('lost')),
      attemptsSum: { $sum: { $ifNull: ['$attempts', 0] } },
    },
  },
  { $sort: { total: -1 } },
  { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'emp' } },
  {
    $project: {
      _id: 0,
      employeeName: { $ifNull: [{ $arrayElemAt: ['$emp.name', 0] }, 'Unassigned'] },
      tlName: { $ifNull: [{ $arrayElemAt: ['$emp.tlName', 0] }, ''] },
      total: 1, new: 1, contacted: 1, follow_up: 1, converted: 1, lost: 1, attemptsSum: 1,
    },
  },
];

// GET /api/reports/leads-periodic — leads report (Lead Reports page)
router.get('/leads-periodic', protect, requireManagement, async (req, res) => {
  try {
    const {
      startDate, endDate, employeeId, status, source, leadTime, tlName,
      tab = 'summary', page = 1, limit = 500,
    } = req.query;

    const { allowed, filter: scopeFilter, error } = await resolveEmployeeFilter(req.user, employeeId, 'assignedTo');
    if (!allowed) {
      return res.status(403).json({ success: false, error });
    }

    const toObjectId = (id) =>
      typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)
        ? new mongoose.Types.ObjectId(id)
        : id;

    const filter = { ...scopeFilter };
    if (startDate) filter.createdAt = { ...(filter.createdAt || {}), $gte: istDateStrStart(startDate) };
    if (endDate) filter.createdAt = { ...(filter.createdAt || {}), $lte: istDateStrEnd(endDate) };

    if (filter.assignedTo) {
      if (filter.assignedTo.$in) {
        filter.assignedTo = { $in: filter.assignedTo.$in.map(toObjectId) };
      } else {
        filter.assignedTo = toObjectId(filter.assignedTo);
      }
    }

    if (!employeeId && tlName) {
      const tlEmpIds = await resolveEmployeeIdsForTL(tlName);
      if (filter.assignedTo && filter.assignedTo.$in) {
        const scopedStrs = new Set(filter.assignedTo.$in.map((id) => id.toString()));
        filter.assignedTo = { $in: tlEmpIds.filter((id) => scopedStrs.has(id.toString())).map(toObjectId) };
      } else if (filter.assignedTo) {
        const scopedStr = filter.assignedTo.toString();
        const match = tlEmpIds.find((id) => id.toString() === scopedStr);
        filter.assignedTo = match ? toObjectId(match) : { $in: [] };
      } else {
        filter.assignedTo = { $in: tlEmpIds.map(toObjectId) };
      }
    }

    if (status) filter.status = status;
    if (source) filter.source = { $regex: source, $options: 'i' };
    applyLeadTimeFilter(filter, leadTime);

    // As in /periodic: the $hour `$expr` can never use an index, so it runs as its own stage
    // after the indexable createdAt/assignedTo/status range has already narrowed the set.
    const baseMatch = { ...filter };
    delete baseMatch.$expr;
    const pre = filter.$expr
      ? [{ $match: baseMatch }, { $match: { $expr: filter.$expr } }]
      : [{ $match: baseMatch }];

    const agg = (stages) => Lead.aggregate([...pre, ...stages]).allowDiskUse(true);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(2000, Math.max(1, parseInt(limit, 10) || 500));
    const skip = (pageNum - 1) * pageSize;

    const userScopeKey = req.user && (req.user.role === 'admin' || req.user.isSuperAdmin)
      ? 'admin'
      : (req.user?._id?.toString() || 'anon');

    const cacheParts = [
      'leads-periodic', userScopeKey, tab, startDate || '', endDate || '', employeeId || '', tlName || '',
      status || '', source || '', leadTime || '', pageNum, pageSize,
    ];
    // leadList carries the inline-editable note column — same reasoning as callHistory above.
    const cached = (producer) =>
      tab === 'leadList' ? producer() : reportCache.memo(cacheParts, producer);

    const dateLabel = startDate
      ? new Date(startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
        (endDate && endDate !== startDate
          ? ' to ' + new Date(endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : '')
      : 'All Leads';

    if (tab === 'summary') {
      const data = await cached(async () => {
        const [facet] = await agg([
          {
            $facet: {
              byStatus: [
                { $group: { _id: '$status', leads: { $sum: 1 }, attempts: { $sum: { $ifNull: ['$attempts', 0] } } } },
              ],
              overall: [
                {
                  $group: {
                    _id: null,
                    leads: { $sum: 1 },
                    attempts: { $sum: { $ifNull: ['$attempts', 0] } },
                    contacted: countIf(leadIsContacted),
                    // The `$ne null` guard is load-bearing: in BSON ordering null sorts
                    // *below* every date, so a lead with no followUpDate would satisfy
                    // `$lte: now` on its own and inflate the count.
                    followUpsDue: countIf({
                      $and: [
                        statusIs('follow_up'),
                        { $ne: ['$followUpDate', null] },
                        { $lte: ['$followUpDate', new Date()] },
                      ],
                    }),
                  },
                },
              ],
              sources: [{ $match: { source: { $nin: [null, ''] } } }, { $group: { _id: '$source' } }, { $count: 'n' }],
              employees: LEAD_EMPLOYEE_STAGES,
            },
          },
        ]);

        const st = {};
        for (const r of facet?.byStatus || []) st[r._id] = r;
        const o = facet?.overall?.[0] || { leads: 0, attempts: 0, contacted: 0, followUpsDue: 0 };

        const summary = {};
        for (const k of LEAD_STATUS_KEYS) {
          const leads = st[k]?.leads || 0;
          summary[k] = { leads, avgAttempts: leads ? round1((st[k]?.attempts || 0) / leads) : 0 };
        }
        summary.total = { leads: o.leads, avgAttempts: o.leads ? round1(o.attempts / o.leads) : 0 };

        return {
          dateLabel,
          summary,
          pieData: LEAD_STATUS_KEYS
            .map((k) => ({ key: k, name: LEAD_STATUS_LABELS[k], value: st[k]?.leads || 0 }))
            .filter((d) => d.value > 0),
          sidebarStats: {
            uncontacted: o.leads - o.contacted,
            notConnected: st.not_connected?.leads || 0,
            contacted: o.contacted,
            converted: st.converted?.leads || 0,
            uniqueSources: facet?.sources?.[0]?.n || 0,
            followUpsDue: o.followUpsDue,
          },
          employeeSummary: (facet?.employees || []).map(({ attemptsSum, ...e }) => ({
            ...e,
            conversionRate: e.total ? Math.round((e.converted / e.total) * 100) : 0,
            avgAttempts: e.total ? round1(attemptsSum / e.total) : 0,
          })),
        };
      });
      return res.json({ success: true, data });
    }

    if (tab === 'analysis') {
      const data = await cached(async () => {
        const [facet] = await agg([
          {
            $facet: {
              hourly: [
                {
                  $group: {
                    _id: { $hour: { date: '$createdAt', timezone: IST_TZ } },
                    total: { $sum: 1 },
                    contacted: countIf(leadIsContacted),
                  },
                },
              ],
              overall: [
                {
                  $group: {
                    _id: null,
                    total: { $sum: 1 },
                    converted: countIf(statusIs('converted')),
                    attempts: { $sum: { $ifNull: ['$attempts', 0] } },
                    convertedAttempts: {
                      $sum: { $cond: [statusIs('converted'), { $ifNull: ['$attempts', 0] }, 0] },
                    },
                  },
                },
              ],
              days: [
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: IST_TZ } } } },
                { $count: 'n' },
              ],
              mostAttempted: [
                { $sort: { attempts: -1, createdAt: -1 } },
                { $limit: 1 },
                { $project: { _id: 0, name: 1, phone: 1, status: 1, attempts: { $ifNull: ['$attempts', 0] } } },
              ],
              employees: LEAD_EMPLOYEE_STAGES,
            },
          },
        ]);

        const hourly = Array.from({ length: 24 }, (_, h) => ({
          hour: h, label: hourSlotLabel(h), total: 0, contacted: 0,
        }));
        for (const r of facet?.hourly || []) {
          if (hourly[r._id]) { hourly[r._id].total = r.total; hourly[r._id].contacted = r.contacted; }
        }

        const emps = facet?.employees || [];
        const pick = (f) => emps.reduce((best, e) => (!best || e[f] > best[f] ? e : best), null);
        const asCount = (e, f) => (e ? { employeeName: e.employeeName, count: e[f] } : null);
        const topAttempts = asCount(pick('attemptsSum'), 'attemptsSum');

        const o = facet?.overall?.[0] || { total: 0, converted: 0, attempts: 0, convertedAttempts: 0 };
        const dayCount = facet?.days?.[0]?.n || 1;

        return {
          dateLabel,
          hourly,
          topAssignee: asCount(pick('total'), 'total'),
          topConverter: asCount(pick('converted'), 'converted'),
          topOverall: topAttempts,
          mostAttempts: topAttempts,
          mostAttemptedLead: facet?.mostAttempted?.[0] || null,
          conversionRate: o.total ? Math.round((o.converted / o.total) * 100) : 0,
          avgAttemptsPerLead: o.total ? round1(o.attempts / o.total) : 0,
          avgAttemptsPerConverted: o.converted ? round1(o.convertedAttempts / o.converted) : 0,
          avgLeadsPerDay: round1(o.total / dayCount),
          dayCount,
        };
      });
      return res.json({ success: true, data });
    }

    if (tab === 'dayWise') {
      const data = await cached(async () => {
        const rows = await agg([
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: IST_TZ } },
              total: { $sum: 1 },
              converted: countIf(statusIs('converted')),
            },
          },
          { $sort: { _id: -1 } },
        ]);
        return {
          dateLabel,
          daywise: rows.map((d) => ({
            date: d._id,
            label: istDayLabel(`${d._id}T00:00:00+05:30`),
            total: d.total,
            converted: d.converted,
            conversionRate: d.total ? Math.round((d.converted / d.total) * 100) : 0,
          })),
        };
      });
      return res.json({ success: true, data });
    }

    if (tab === 'hourly') {
      const data = await cached(async () => {
        const rows = await agg([
          {
            $group: {
              _id: { $hour: { date: '$createdAt', timezone: IST_TZ } },
              total: { $sum: 1 },
              contacted: countIf(leadIsContacted),
              converted: countIf(statusIs('converted')),
            },
          },
        ]);
        const hourly = Array.from({ length: 24 }, (_, h) => ({
          hour: h, label: hourSlotLabel(h), total: 0, contacted: 0, converted: 0,
        }));
        let totalAll = 0;
        for (const r of rows) {
          const h = hourly[r._id];
          if (!h) continue;
          h.total = r.total; h.contacted = r.contacted; h.converted = r.converted;
          totalAll += r.total;
        }
        const denom = totalAll || 1;
        return {
          dateLabel,
          hourly: hourly.map((h) => ({ ...h, pct: Number(((h.total / denom) * 100).toFixed(2)) })),
        };
      });
      return res.json({ success: true, data });
    }

    // The remaining tabs are plain row listings — a narrowed, projected, paginated find
    // rather than a full load that was then filtered and sliced in Node. `page` is honoured
    // now too; page 1 returns exactly what the old `slice(0, limit)` did.
    // `filter` already carries any $expr; find() splits indexable clauses from it itself.
    const listFilter = (extra) => ({ ...filter, ...extra });
    const runList = async (f, projection, sort) => {
      const [total, rows] = await Promise.all([
        Lead.countDocuments(f),
        Lead.find(f).select(projection).populate('assignedTo', 'name tlName').sort(sort).skip(skip).limit(pageSize).lean(),
      ]);
      return { total, rows };
    };
    const empNameOf = (l) => l.assignedTo?.name || 'Unassigned';

    if (tab === 'uncontacted') {
      const data = await cached(async () => {
        // `!(attempts > 0)` in the old JS — covers 0, negative, null and missing alike.
        const { total, rows } = await runList(
          listFilter({ attempts: { $not: { $gt: 0 } } }),
          'name phone source assignedTo createdAt',
          { createdAt: 1 }
        );
        return {
          dateLabel,
          total,
          pages: Math.ceil(total / pageSize),
          records: rows.map((l) => ({
            _id: l._id, name: l.name, phone: l.phone, source: l.source || '—',
            employeeName: empNameOf(l), createdAt: l.createdAt,
            daysSince: Math.max(0, Math.floor((Date.now() - new Date(l.createdAt).getTime()) / 86400000)),
          })),
        };
      });
      return res.json({ success: true, data });
    }

    if (tab === 'notConnected') {
      const data = await cached(async () => {
        // An explicit status filter for some other status can never also be not_connected —
        // the old code filtered the already-status-narrowed list and got nothing.
        if (filter.status && filter.status !== 'not_connected') {
          return { dateLabel, total: 0, pages: 0, records: [] };
        }
        const { total, rows } = await runList(
          listFilter({ status: 'not_connected' }),
          'name phone status attempts lastCallAt assignedTo createdAt',
          { createdAt: -1 }
        );
        return {
          dateLabel,
          total,
          pages: Math.ceil(total / pageSize),
          records: rows.map((l) => ({
            _id: l._id, employeeName: empNameOf(l), name: l.name, phone: l.phone,
            status: l.status, attempts: l.attempts || 0, lastCallAt: l.lastCallAt || null,
          })),
        };
      });
      return res.json({ success: true, data });
    }

    if (tab === 'sources') {
      const data = await cached(async () => {
        const rows = await agg([
          {
            $group: {
              // `l.source || 'Unknown'` in the old JS — an empty string folds in too,
              // which $ifNull alone would not do.
              _id: { $cond: [{ $in: ['$source', [null, '']] }, 'Unknown', '$source'] },
              total: { $sum: 1 },
              converted: countIf(statusIs('converted')),
              lost: countIf(statusIs('lost')),
            },
          },
          { $sort: { total: -1 } },
        ]);
        return {
          dateLabel,
          total: rows.length,
          records: rows.map((s) => ({
            source: s._id,
            total: s.total,
            converted: s.converted,
            lost: s.lost,
            conversionRate: s.total ? Math.round((s.converted / s.total) * 100) : 0,
          })),
        };
      });
      return res.json({ success: true, data });
    }

    if (tab === 'leadList') {
      const data = await cached(async () => {
        const { total, rows } = await runList(
          listFilter(),
          'name phone status source attempts followUpDate createdAt lastCallNote assignedTo',
          { createdAt: -1 }
        );
        return {
          dateLabel,
          total,
          pages: Math.ceil(total / pageSize),
          leads: rows.map((l) => ({
            _id: l._id, employeeName: empNameOf(l), tlName: l.assignedTo?.tlName || '',
            phone: l.phone, name: l.name, status: l.status, source: l.source || '—',
            attempts: l.attempts || 0, followUpDate: l.followUpDate || null,
            createdAt: l.createdAt, lastCallNote: l.lastCallNote || '',
          })),
        };
      });
      return res.json({ success: true, data });
    }

    const data = await cached(async () => ({ dateLabel, total: await Lead.countDocuments(filter) }));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/reports/employees-periodic — Employee Reports page (scoped by hierarchy)
router.get('/employees-periodic', protect, requireManagement, async (req, res) => {
  try {
    const { startDate, endDate, employeeId, status, tlName, tab = 'summary' } = req.query;

    const { allowed, filter: scopeFilter, error } = await resolveEmployeeFilter(req.user, employeeId, '_id');
    if (!allowed) {
      return res.status(403).json({ success: false, error });
    }

    const start = startDate ? istDateStrStart(startDate) : istDayStart(-29);
    const end = endDate ? istDateStrEnd(endDate) : new Date();

    const empFilter = { role: 'employee', ...scopeFilter };
    if (tlName) {
      const tlEmpIds = await resolveEmployeeIdsForTL(tlName);
      if (empFilter._id && empFilter._id.$in) {
        const scopedStrs = new Set(empFilter._id.$in.map((id) => id.toString()));
        empFilter._id = { $in: tlEmpIds.filter((id) => scopedStrs.has(id.toString())) };
      } else {
        empFilter._id = { $in: tlEmpIds };
      }
    }
    if (status === 'active') empFilter.isActive = true;
    else if (status === 'inactive') empFilter.isActive = false;

    const employeesList = await User.find(empFilter).sort({ name: 1 }).lean();
    const employeeIds = employeesList.map((e) => e._id);

    const callFilter = { timestamp: { $gte: start, $lte: end }, employeeId: { $in: employeeIds } };
    const leadFilter = { createdAt: { $gte: start, $lte: end }, assignedTo: { $in: employeeIds } };

    const isBucketTab = ['analysis', 'dayWise', 'hourly'].includes(tab);

    let callAgg = [];
    let leadAgg = [];
    let calls = [];
    let leads = [];

    if (!isBucketTab) {
      [callAgg, leadAgg] = await Promise.all([
        CallLog.aggregate([
          { $match: { timestamp: { $gte: start, $lte: end }, employeeId: { $in: employeeIds } } },
          { $group: {
            _id: '$employeeId',
            totalCalls: { $sum: 1 },
            connectedCalls: { $sum: { $cond: [{ $gt: ['$duration', 0] }, 1, 0] } },
            totalDuration: { $sum: { $ifNull: ['$duration', 0] } }
          }}
        ]),
        Lead.aggregate([
          { $match: { createdAt: { $gte: start, $lte: end }, assignedTo: { $in: employeeIds } } },
          { $group: {
            _id: '$assignedTo',
            leadsAssigned: { $sum: 1 },
            leadsConverted: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } }
          }}
        ])
      ]);
    } else {
      [calls, leads] = await Promise.all([
        CallLog.find(callFilter).select('employeeId duration timestamp').lean(),
        Lead.find(leadFilter).select('assignedTo status createdAt').lean(),
      ]);
    }

    const statsMap = {};
    employeesList.forEach((e) => {
      statsMap[e._id.toString()] = {
        employeeId: e._id.toString(), employeeCode: e.ryanEmployeeCode || '', employeeName: e.name, email: e.email, phone: e.phone || '',
        tlName: e.tlName || '', isActive: e.isActive, dailyTarget: e.dailyTarget || 0,
        totalCalls: 0, connectedCalls: 0, totalDuration: 0, leadsAssigned: 0, leadsConverted: 0
      };
    });

    if (!isBucketTab) {
      callAgg.forEach((c) => {
        const s = statsMap[c._id?.toString()];
        if (!s) return;
        s.totalCalls = c.totalCalls || 0;
        s.totalDuration = c.totalDuration || 0;
        s.connectedCalls = c.connectedCalls || 0;
      });
      leadAgg.forEach((l) => {
        const s = statsMap[l._id?.toString()];
        if (!s) return;
        s.leadsAssigned = l.leadsAssigned || 0;
        s.leadsConverted = l.leadsConverted || 0;
      });
    } else {
      calls.forEach((c) => {
        const s = statsMap[c.employeeId?.toString()];
        if (!s) return;
        s.totalCalls++;
        s.totalDuration += c.duration || 0;
        if ((c.duration || 0) > 0) s.connectedCalls++;
      });
      leads.forEach((l) => {
        const s = statsMap[l.assignedTo?.toString()];
        if (!s) return;
        s.leadsAssigned++;
        if (l.status === 'converted') s.leadsConverted++;
      });
    }

    const dayCount = Math.max(1, Math.round((end - start) / 86400000) + 1);

    const perfList = Object.values(statsMap).map((s) => {
      const conversionRate = s.leadsAssigned ? Math.round((s.leadsConverted / s.leadsAssigned) * 100) : 0;
      const targetTotal = s.dailyTarget * dayCount;
      const targetAchievement = s.dailyTarget > 0 ? Math.round((s.totalCalls / targetTotal) * 100) : null;
      return { ...s, conversionRate, targetTotal, targetAchievement, totalTalktime: fmtDuration(s.totalDuration) };
    });

    const totalAllCalls = !isBucketTab
      ? callAgg.reduce((sum, c) => sum + (c.totalCalls || 0), 0)
      : calls.length;
    const totalAllLeads = !isBucketTab
      ? leadAgg.reduce((sum, l) => sum + (l.leadsAssigned || 0), 0)
      : leads.length;

    const dateLabel = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' to ' + end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    if (tab === 'analysis') {
      const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: hourSlotLabel(h), calls: 0, leads: 0 }));
      calls.forEach((c) => { hourly[istHourOf(c.timestamp)].calls++; });
      leads.forEach((l) => { hourly[istHourOf(l.createdAt)].leads++; });

      let topDialer = null, topConverter = null, bestTarget = null, needsAttention = null;
      perfList.forEach((e) => {
        if (!topDialer || e.totalCalls > topDialer.count) topDialer = { employeeName: e.employeeName, count: e.totalCalls };
        if (!topConverter || e.leadsConverted > topConverter.count) topConverter = { employeeName: e.employeeName, count: e.leadsConverted };
        if (e.targetAchievement != null) {
          if (!bestTarget || e.targetAchievement > bestTarget.pct) bestTarget = { employeeName: e.employeeName, pct: e.targetAchievement };
          if (!needsAttention || e.targetAchievement < needsAttention.pct) needsAttention = { employeeName: e.employeeName, pct: e.targetAchievement };
        }
      });

      const empCount = employeesList.length || 1;
      return res.json({
        success: true,
        data: {
          dateLabel, hourly, topDialer, topConverter, bestTarget, needsAttention,
          avgCallsPerEmployee: Math.round(calls.length / empCount),
          avgLeadsPerEmployee: Math.round(leads.length / empCount),
          dayCount
        }
      });
    }

    if (tab === 'dayWise') {
      const dayMap = {};
      calls.forEach((c) => {
        const key = istDayKey(c.timestamp);
        if (!dayMap[key]) dayMap[key] = { date: key, label: istDayLabel(c.timestamp), calls: 0, leadsCreated: 0, leadsConverted: 0 };
        dayMap[key].calls++;
      });
      leads.forEach((l) => {
        const key = istDayKey(l.createdAt);
        if (!dayMap[key]) dayMap[key] = { date: key, label: istDayLabel(l.createdAt), calls: 0, leadsCreated: 0, leadsConverted: 0 };
        dayMap[key].leadsCreated++;
        if (l.status === 'converted') dayMap[key].leadsConverted++;
      });
      const daywise = Object.values(dayMap).sort((a, b) => b.date.localeCompare(a.date));
      return res.json({ success: true, data: { dateLabel, daywise } });
    }

    if (tab === 'hourly') {
      const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: hourSlotLabel(h), calls: 0, leads: 0 }));
      calls.forEach((c) => { hourly[istHourOf(c.timestamp)].calls++; });
      leads.forEach((l) => { hourly[istHourOf(l.createdAt)].leads++; });
      const totalAll = (calls.length + leads.length) || 1;
      return res.json({
        success: true,
        data: { dateLabel, hourly: hourly.map((h) => ({ ...h, pct: Number((((h.calls + h.leads) / totalAll) * 100).toFixed(2)) })) }
      });
    }

    if (tab === 'target') {
      const records = perfList
        .filter((e) => e.dailyTarget > 0)
        .sort((a, b) => (a.targetAchievement ?? 0) - (b.targetAchievement ?? 0));
      return res.json({ success: true, data: { dateLabel, records } });
    }

    if (tab === 'attention') {
      const records = perfList
        .filter((e) => !e.isActive || e.totalCalls === 0 || (e.dailyTarget > 0 && e.targetAchievement < 50))
        .map((e) => ({
          ...e,
          reason: !e.isActive
            ? 'Inactive account'
            : e.totalCalls === 0
              ? 'No activity this period'
              : `Below 50% of target (${e.targetAchievement}%)`
        }));
      return res.json({ success: true, data: { dateLabel, records } });
    }

    if (tab === 'directory') {
      return res.json({ success: true, data: { dateLabel, employees: perfList } });
    }

    const activeCount = employeesList.filter((e) => e.isActive).length;
    return res.json({
      success: true,
      data: {
        dateLabel,
        kpis: {
          totalEmployees: employeesList.length,
          activeEmployees: activeCount,
          totalCalls: totalAllCalls,
          totalLeadsAssigned: totalAllLeads
        },
        statusPie: [
          { name: 'Active', value: activeCount, color: '#16A34A' },
          { name: 'Inactive', value: employeesList.length - activeCount, color: '#DC2626' }
        ].filter((d) => d.value > 0),
        employeePerformance: perfList.sort((a, b) => b.totalCalls - a.totalCalls)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

function csvEsc(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }

// GET /api/reports/employees/export — full-field CSV of every employee (scoped by hierarchy)
router.get('/employees/export', protect, requireManagement, async (req, res) => {
  let job = null;
  try {
    const { startDate, endDate, status, tlName } = req.query;
    const start = startDate ? istDateStrStart(startDate) : istDayStart(-29);
    const end = endDate ? istDateStrEnd(endDate) : new Date();

    const scopedEmpIds = await getScopedEmployeeIds(req.user);
    const empFilter = { role: 'employee' };
    if (scopedEmpIds !== null) {
      empFilter._id = { $in: scopedEmpIds };
    }
    if (tlName) {
      const tlEmpIds = await resolveEmployeeIdsForTL(tlName);
      if (empFilter._id && empFilter._id.$in) {
        const scopedStrs = new Set(empFilter._id.$in.map((id) => id.toString()));
        empFilter._id = { $in: tlEmpIds.filter((id) => scopedStrs.has(id.toString())) };
      } else {
        empFilter._id = { $in: tlEmpIds };
      }
    }
    if (status === 'active') empFilter.isActive = true;
    else if (status === 'inactive') empFilter.isActive = false;

    const employeesList = await User.find(empFilter).sort({ name: 1 }).lean();
    const employeeIds = employeesList.map((e) => e._id);

    const [callAgg, leadAgg] = await Promise.all([
      CallLog.aggregate([
        { $match: { timestamp: { $gte: start, $lte: end }, employeeId: { $in: employeeIds } } },
        { $group: {
          _id: '$employeeId',
          totalCalls: { $sum: 1 },
          connectedCalls: { $sum: { $cond: [{ $gt: ['$duration', 0] }, 1, 0] } },
          totalDuration: { $sum: { $ifNull: ['$duration', 0] } }
        }}
      ]),
      Lead.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end }, assignedTo: { $in: employeeIds } } },
        { $group: {
          _id: '$assignedTo',
          leadsAssigned: { $sum: 1 },
          leadsConverted: { $sum: { $cond: [{ $in: ['$status', ['converted', 'booking_done']] }, 1, 0] } },
          leadsInterested: { $sum: { $cond: [{ $eq: ['$status', 'interested'] }, 1, 0] } },
          leadsLost: { $sum: { $cond: [{ $in: ['$status', ['lost', 'not_interested']] }, 1, 0] } }
        }}
      ])
    ]);

    const callMap = new Map(callAgg.map((c) => [String(c._id), c]));
    const leadMap = new Map(leadAgg.map((l) => [String(l._id), l]));

    const filename = `employees_${startDate || '30d'}_${endDate || 'now'}.csv`;

    try {
      job = await createPendingDownloadJob({ ownerId: req.user._id, label: 'Employee Report Export', filename });
    } catch {}

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const header = [
      'Name', 'Email', 'Phone', 'Role', 'Team Lead', 'Daily Target', 'Active',
      'Total Calls', 'Connected Calls', 'Total Talktime',
      'Leads Assigned', 'Leads Converted', 'Conversion Rate (%)', 'Target Achievement (%)',
      'Joined At'
    ].join(',') + '\n';
    res.write(header);

    let jobBuf = [header];
    let jobBytes = Buffer.byteLength(header, 'utf8');
    let jobOverflowed = false;

    const FLUSH_BYTES = 64 * 1024;
    let outBuf = '';

    for (const e of employeesList) {
      const c = callMap.get(String(e._id)) || {};
      const l = leadMap.get(String(e._id)) || {};
      const totalCalls     = c.totalCalls     || 0;
      const connectedCalls = c.connectedCalls || 0;
      const totalDuration  = c.totalDuration  || 0;
      const leadsAssigned  = l.leadsAssigned  || 0;
      const leadsConverted = l.leadsConverted || 0;
      const leadsInterested= l.leadsInterested|| 0;
      const leadsLost      = l.leadsLost      || 0;
      const connectRate    = totalCalls > 0    ? round1((connectedCalls / totalCalls) * 100) : 0;
      const convRate       = leadsAssigned > 0 ? round1((leadsConverted / leadsAssigned) * 100) : 0;

      const line = [
        csvEsc(e.ryanEmployeeCode),
        csvEsc(e.name),
        csvEsc(e.email),
        csvEsc(e.phone || ''),
        csvEsc(e.tlName),
        e.isActive ? 'Active' : 'Inactive',
        e.dailyTarget || 0,
        totalCalls,
        connectedCalls,
        connectRate,
        totalDuration,
        fmtDuration(totalDuration),
        leadsAssigned,
        leadsConverted,
        leadsInterested,
        leadsLost,
        convRate
      ].join(',') + '\n';

      outBuf += line;
      if (outBuf.length >= FLUSH_BYTES) { res.write(outBuf); outBuf = ''; }

      if (!jobOverflowed) {
        jobBytes += Buffer.byteLength(line, 'utf8');
        if (jobBytes > MAX_CONTENT_BYTES) { jobOverflowed = true; jobBuf = null; }
        else jobBuf.push(line);
      }
    }
    if (outBuf) res.write(outBuf);
    res.end();

    if (job) {
      try {
        job = jobOverflowed
          ? await failDownloadJob(job._id, 'Export too large to store for re-download — direct download completed successfully.')
          : await completeDownloadJob(job._id, jobBuf.join(''));
      } catch {}
    }
  } catch (err) {
    if (job) { try { await failDownloadJob(job._id, err.message); } catch {} }
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
    else res.end();
  }
});

// GET /api/reports/client — per-client call report (scoped by hierarchy)
router.get('/client', protect, requireManagement, async (req, res) => {
  try {
    const { phone, duration = 'all', tab = 'summary', page = 1, limit = 50, search = '' } = req.query;

    const scopedEmpIds = await getScopedEmployeeIds(req.user);
    const baseEmpFilter = scopedEmpIds !== null ? { $in: scopedEmpIds } : undefined;

    // ── CLIENT DIRECTORY MODE (no phone provided) ──────────────────────────
    if (!phone || !phone.trim()) {
      const dirFilter = { contactNumber: { $exists: true, $ne: '' } };
      if (baseEmpFilter) dirFilter.employeeId = baseEmpFilter;

      if (duration !== 'all') {
        const now = new Date();
        const start = new Date();
        if (duration === 'today') { start.setHours(0, 0, 0, 0); }
        else if (duration === 'yesterday') { start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0); now.setHours(0, 0, 0, 0); }
        else if (duration === 'week') { start.setDate(start.getDate() - 7); }
        else if (duration === 'month') { start.setMonth(start.getMonth() - 1); }
        dirFilter.timestamp = { $gte: start, $lte: now };
      }

      const searchMatch = search && search.trim() ? {
        $or: [
          { _id: { $regex: search.trim(), $options: 'i' } },
          { contactName: { $regex: search.trim(), $options: 'i' } }
        ]
      } : null;

      const pageNum = Math.max(1, parseInt(page));
      const pageSize = Math.min(100, Math.max(1, parseInt(limit)));

      const countPipeline = [
        { $match: dirFilter },
        { $group: {
          _id: '$contactNumber',
          ...(searchMatch ? { contactName: { $first: '$contactName' } } : {})
        }},
        ...(searchMatch ? [{ $match: searchMatch }] : []),
        { $count: 'total' }
      ];

      const dirPipeline = [
        { $match: dirFilter },
        { $group: {
          _id: '$contactNumber',
          contactName: { $first: '$contactName' },
          totalCalls: { $sum: 1 },
          connectedCalls: { $sum: { $cond: [{ $gt: ['$duration', 0] }, 1, 0] } },
          lastCallAt: { $max: '$timestamp' }
        }},
        ...(searchMatch ? [{ $match: searchMatch }] : []),
        { $sort: { lastCallAt: -1 } },
        { $skip: (pageNum - 1) * pageSize },
        { $limit: pageSize }
      ];

      const [countRes, rows] = await Promise.all([
        CallLog.aggregate(countPipeline).allowDiskUse(true),
        CallLog.aggregate(dirPipeline).allowDiskUse(true)
      ]);

      const totalCount = countRes[0]?.total || 0;
      return res.json({
        success: true,
        data: {
          mode: 'directory',
          total: totalCount,
          pages: Math.max(1, Math.ceil(totalCount / pageSize)),
          page: pageNum,
          clients: rows.map((r) => ({
            phone: r._id,
            contactName: r.contactName || '',
            totalCalls: r.totalCalls,
            connectedCalls: r.connectedCalls,
            notConnectedCalls: Math.max(0, r.totalCalls - r.connectedCalls),
            lastCallAt: r.lastCallAt
          }))
        }
      });
    }

    // ── SINGLE-CLIENT REPORT MODE ──────────────────────────────────────────
    const digits = phone.replace(/\D/g, '');
    if (!digits) return res.status(400).json({ success: false, error: 'Enter a valid phone number' });

    // Normalise to last 10 digits so +918320006222 / 08320006222 / 8320006222 all match
    const last10 = digits.slice(-10);
    const filter = { contactNumber: { $regex: last10, $options: 'i' } };
    if (baseEmpFilter) {
      filter.employeeId = baseEmpFilter;
    }

    if (duration !== 'all') {
      const now = new Date();
      const start = new Date();
      if (duration === 'today') { start.setHours(0, 0, 0, 0); }
      else if (duration === 'yesterday') { start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0); now.setHours(0, 0, 0, 0); }
      else if (duration === 'week') { start.setDate(start.getDate() - 7); }
      else if (duration === 'month') { start.setMonth(start.getMonth() - 1); }
      filter.timestamp = { $gte: start, $lte: now };
    }

    const calls = await CallLog.find(filter)
      .populate('employeeId', 'name phone tlName')
      .sort({ timestamp: -1, _id: -1 })
      .lean();

    const totalDuration = calls.reduce((s, c) => s + (c.duration || 0), 0);
    const connectedCalls = calls.filter((c) => (c.duration || 0) > 0).length;
    const notPickupByClient = calls.filter((c) => c.callType === 'outgoing' && (!c.duration || c.duration === 0)).length;
    const neverAttended = calls.filter((c) => c.callType === 'missed').length;

    if (calls.length === 0) {
      return res.json({ success: true, data: { phone, noResults: true } });
    }

    if (tab === 'summary') {
      const empSummary = {};
      const byType = { incoming: [], outgoing: [], missed: [], rejected: [] };
      calls.forEach((c) => { if (byType[c.callType]) byType[c.callType].push(c); });

      calls.forEach((c) => {
        const id = c.employeeId?._id?.toString() || c.employeeId?.toString();
        if (!id) return;
        if (!empSummary[id]) {
          empSummary[id] = {
            employeeId: id, employeeName: empName(c), employeePhone: empPhone(c), tlName: empTL(c),
            totalCalls: 0, totalDuration: 0,
            incomingTotal: 0, incomingConnected: 0, incomingDuration: 0,
            outgoingTotal: 0, outgoingConnected: 0, outgoingDuration: 0,
            missed: 0, rejected: 0, neverAttended: 0, notPickupByClient: 0,
            lastSyncTime: c.timestamp
          };
        }
        const e = empSummary[id];
        e.totalCalls++;
        e.totalDuration += c.duration || 0;
        if (c.callType === 'incoming') {
          e.incomingTotal++;
          e.incomingDuration += c.duration || 0;
          if ((c.duration || 0) > 0) e.incomingConnected++;
        } else if (c.callType === 'outgoing') {
          e.outgoingTotal++;
          e.outgoingDuration += c.duration || 0;
          if ((c.duration || 0) > 0) e.outgoingConnected++;
          else e.notPickupByClient++;
        } else if (c.callType === 'missed') {
          e.missed++;
          e.neverAttended++;
        } else if (c.callType === 'rejected') {
          e.rejected++;
        }
        if (new Date(c.timestamp) > new Date(e.lastSyncTime)) e.lastSyncTime = c.timestamp;
      });

      return res.json({
        success: true,
        data: {
          phone,
          summary: {
            incoming: { calls: byType.incoming.length, duration: fmtDuration(byType.incoming.reduce((s, c) => s + (c.duration || 0), 0)) },
            outgoing: { calls: byType.outgoing.length, duration: fmtDuration(byType.outgoing.reduce((s, c) => s + (c.duration || 0), 0)) },
            missed:   { calls: byType.missed.length },
            rejected: { calls: byType.rejected.length },
            total:    { calls: calls.length, duration: fmtDuration(totalDuration) }
          },
          sidebarStats: { neverAttended, notPickupByClient, connectedCalls },
          pieData: [
            { name: 'Incoming', value: byType.incoming.length, color: '#34C759' },
            { name: 'Outgoing', value: byType.outgoing.length, color: '#FF9500' },
            { name: 'Missed',   value: byType.missed.length,   color: '#FF3B30' },
            { name: 'Rejected', value: byType.rejected.length, color: '#7C3AED' }
          ].filter((d) => d.value > 0),
          employeeSummary: Object.values(empSummary).map((e) => ({
            ...e,
            totalDuration:    fmtDuration(e.totalDuration),
            incomingDuration: fmtDuration(e.incomingDuration),
            outgoingDuration: fmtDuration(e.outgoingDuration)
          }))
        }
      });
    }

    const pageNum = parseInt(page), pageSize = parseInt(limit);
    return res.json({
      success: true,
      data: {
        total: calls.length,
        calls: calls.slice((pageNum - 1) * pageSize, pageNum * pageSize).map(c => ({
          ...c,
          employeeName:  empName(c),
          employeePhone: empPhone(c),
          employeeTL:    empTL(c),
        })),
        pages: Math.ceil(calls.length / pageSize)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
