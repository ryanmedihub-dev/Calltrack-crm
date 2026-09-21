// GET /api/leads/agent-detail/:employeeId
//
// Single-agent drill-down: the same call/lead totals workforce-summary reports for this agent
// (via the shared lib/workforceStats helpers, so the two endpoints can never disagree), plus
// recent call and lead-activity history. Consumed by ryan-crm's Owner panel (Agent 360° screen)
// via CALLBY_API_URL + CALLBY_SERVICE_TOKEN, the same manager-role-JWT pattern
// GET /api/leads/funnel-data already uses.
//
// Query params (all optional):
//   dateFrom, dateTo — ISO date bounds on CallLog.timestamp (for `calls`/`recentCalls`) and on
//                       Lead.changelog.changedAt (for `recentLeadChangelog`). With NEITHER
//                       supplied these default to the LAST 30 DAYS, not all of history (see
//                       DEFAULT_CALL_STATS_DAYS in lib/workforceStats.js), matching
//                       workforce-summary so the same agent reads the same on both screens.
//                       The window actually used is echoed back in `data.range`.
//                       `leads` is a present-moment snapshot and ignores all of this — see
//                       lib/workforceStats.js.
//
// Field-name note: the `:employeeId` route param and every `employeeId` reference in this file
// (callFilter, callMap/leadMap lookups) is this app's own User._id (an ObjectId string) — the
// same value CallLog.employeeId and Lead.assignedTo key off. `employee.ryanEmployeeCode` in the
// response below is a different thing entirely: ryan-crm's own Employee.employeeId code (e.g.
// "RC-014"), stored on User.ryanEmployeeCode, used only to match this agent to its ryan-crm
// record — never used to query callby's own data.
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');
const CallLog = require('../models/CallLog');
const { protect, requireManagement } = require('../middleware/auth');
const { validateEmployeeInScope } = require('../lib/scope');
const {
  emptyCallStats, emptyLeadStats, getCallStatsByEmployee, getLeadStatsByEmployee, resolveCallStatsRange,
} = require('../lib/workforceStats');
const cache = require('../lib/cache');

router.get('/agent-detail/:employeeId', protect, requireManagement, async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const inScope = await validateEmployeeInScope(req.user, employeeId);
    if (!inScope) {
      return res.status(403).json({ success: false, message: 'Access denied: employee is outside your hierarchy' });
    }

    // A plain object sentinel, not a Symbol — this value may round-trip through Redis as JSON,
    // and a Symbol serializes to `undefined` and can't survive that.
    const NOT_FOUND = { __notFound: true };
    const result = await cache.cached(['leads', 'agent-detail', employeeId, req.query], 60, async () => {
      const built = await buildAgentDetail(employeeId, req.query);
      return built || NOT_FOUND;
    });
    if (result && result.__notFound) return res.status(404).json({ success: false, message: 'Employee not found' });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Not scoped to the requesting manager — every manager sees the same drill-down for a given
// employeeId, so unlike scripts.js/my-stats there's no identity dimension needed in the key.
async function buildAgentDetail(employeeId, { dateFrom, dateTo }) {
  const employee = await User.findOne({ _id: employeeId, role: 'employee' })
      .select('name tlName isActive dailyTarget ryanEmployeeCode')
      .lean();
    if (!employee) return null;

    const [callMap, leadMap] = await Promise.all([
      getCallStatsByEmployee({ employeeIds: [employeeId], dateFrom, dateTo }),
      getLeadStatsByEmployee({ employeeIds: [employeeId] }),
    ]);

    // Same resolved window as the `calls` totals above — a 30-day headline figure sitting next
    // to a "recent call" from four months ago would read as a bug in the dashboard.
    const range = resolveCallStatsRange(dateFrom, dateTo);

    const callFilter = { employeeId };
    if (range.from || range.to) {
      callFilter.timestamp = {};
      if (range.from) callFilter.timestamp.$gte = range.from;
      if (range.to)   callFilter.timestamp.$lte = range.to;
    }
    const recentCallDocs = await CallLog.find(callFilter)
      .sort({ timestamp: -1 })
      .limit(20)
      .select('contactName contactNumber callType duration timestamp callStatus')
      .lean();

    const changelogDateMatch = {};
    if (range.from || range.to) {
      changelogDateMatch['changelog.changedAt'] = {};
      if (range.from) changelogDateMatch['changelog.changedAt'].$gte = range.from;
      if (range.to)   changelogDateMatch['changelog.changedAt'].$lte = range.to;
    }
    // $unwind + sort + limit in the pipeline — never load every assigned lead's full changelog
    // into Node just to keep the last 20 entries.
    const recentLeadChangelog = await Lead.aggregate([
      { $match: { assignedTo: new mongoose.Types.ObjectId(employeeId) } },
      { $unwind: '$changelog' },
      ...(Object.keys(changelogDateMatch).length ? [{ $match: changelogDateMatch }] : []),
      { $sort: { 'changelog.changedAt': -1 } },
      { $limit: 20 },
      {
        $project: {
          _id: 0,
          leadName:  '$name',
          action:    '$changelog.action',
          changedAt: '$changelog.changedAt',
          details:   '$changelog.details',
        },
      },
    ]);

    return {
      employee: {
        id: employee._id, name: employee.name, tlName: employee.tlName || null,
        isActive: employee.isActive, dailyTarget: employee.dailyTarget,
        ryanEmployeeCode: employee.ryanEmployeeCode || null,
      },
      range: { from: range.from, to: range.to, defaulted: range.defaulted },
      calls: callMap[employeeId] || emptyCallStats(),
      leads: leadMap[employeeId] || emptyLeadStats(),
      recentCalls: recentCallDocs.map((c) => ({
        contactName:   c.contactName,
        contactNumber: c.contactNumber,
        callType:      c.callType,
        duration:      c.duration || 0,
        timestamp:     c.timestamp,
        callStatus:    c.callStatus || null,
      })),
      recentLeadChangelog,
    };
}

module.exports = router;
