// GET /api/leads/workforce-summary
//
// Per-agent + per-team rollup of call activity and lead ownership, built entirely from CallLog
// and Lead data already in this system. Consumed by ryan-crm's Owner panel (Live Workforce /
// TL & Manager screens) via CALLBY_API_URL + CALLBY_SERVICE_TOKEN, the same manager-role-JWT
// pattern GET /api/leads/funnel-data already uses.
//
// Query params (all optional):
//   dateFrom, dateTo — ISO date bounds on CallLog.timestamp for the `calls` figures. With
//                       NEITHER supplied this defaults to the LAST 30 DAYS, not all of history
//                       (see DEFAULT_CALL_STATS_DAYS in lib/workforceStats.js). The window
//                       actually used is always echoed back in `data.range`, with
//                       `range.defaulted: true` when it came from that default.
//   teams            — comma-separated User.tlName values; only employees under one of these
//                       team leads are included (same resolution leadFunnel.js uses for `teams`).
//
// `leads` figures are a present-moment ownership snapshot, not scoped by dateFrom/dateTo and NOT
// subject to the 30-day default — see the comment on getLeadStatsByEmployee in
// lib/workforceStats.js for why.
//
// Field-name note: each agent object carries TWO different identifiers — don't confuse them.
//   agent.employeeId        — this app's own User._id (an ObjectId string). Every call/lead
//                              query in this codebase (CallLog.employeeId, Lead.assignedTo,
//                              agent-detail/:employeeId) keys off THIS value. Unchanged by the
//                              field below; do not repurpose it.
//   agent.ryanEmployeeCode  — ryan-crm's own Employee.employeeId code (e.g. "RC-014"), stored on
//                              User.ryanEmployeeCode. Used only for matching an agent to its
//                              ryan-crm record; never used to query callby's own data.
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, requireManagement } = require('../middleware/auth');
const { getScopedEmployeeIds } = require('../lib/scope');
const {
  emptyCallStats, emptyLeadStats, getCallStatsByEmployee, getLeadStatsByEmployee, resolveCallStatsRange,
} = require('../lib/workforceStats');
const cache = require('../lib/cache');

router.get('/workforce-summary', protect, requireManagement, async (req, res) => {
  try {
    const data = await cache.cached(['leads', 'workforce-summary', req.query], 60, () => buildWorkforceSummary(req.query));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Not scoped to the requesting manager — every manager sees the same rollup, so unlike
// scripts.js/my-stats there's no identity dimension that needs to be in the cache key.
async function buildWorkforceSummary({ dateFrom, dateTo, teams }) {

    // Every employee in the user's hierarchy, not just active ones — `isActive` rides along on each agent row
    const employeeFilter = { role: 'employee' };

    const scopedEmpIds = await getScopedEmployeeIds(req.user);
    if (scopedEmpIds !== null) {
      employeeFilter._id = { $in: scopedEmpIds };
    }

    if (teams) {
      const teamList = teams.split(',').filter(Boolean);
      employeeFilter.tlName = { $in: teamList };
    }
    const employees = await User.find(employeeFilter).select('name tlName isActive dailyTarget ryanEmployeeCode').lean();

    let callMap = {}, leadMap = {};
    if (employees.length) {
      const employeeIds = employees.map((e) => e._id);
      [callMap, leadMap] = await Promise.all([
        getCallStatsByEmployee({ employeeIds, dateFrom, dateTo }),
        getLeadStatsByEmployee({ employeeIds }),
      ]);
    }

    const agents = employees.map((emp) => {
      const id = emp._id.toString();
      return {
        employeeId:       id, // this app's User._id — see field-name note above, not ryan-crm's code
        ryanEmployeeCode: emp.ryanEmployeeCode || null,
        name:        emp.name,
        tlName:      emp.tlName || null,
        isActive:    emp.isActive,
        dailyTarget: emp.dailyTarget,
        calls: callMap[id] || emptyCallStats(),
        leads: leadMap[id] || emptyLeadStats(),
      };
    });

    // Bucketed by tlName; agents with no team lead land under 'Unassigned' rather than being
    // silently dropped from the rollup.
    const teamBuckets = {};
    agents.forEach((a) => {
      const key = a.tlName || 'Unassigned';
      if (!teamBuckets[key]) {
        teamBuckets[key] = { tlName: key, agentCount: 0, calls: emptyCallStats(), leads: emptyLeadStats() };
      }
      const bucket = teamBuckets[key];
      bucket.agentCount += 1;
      Object.keys(bucket.calls).forEach((k) => {
        if (k === 'connectRate' || k === 'byEngagement') return; // handled separately
        bucket.calls[k] += a.calls[k];
      });
      Object.keys(bucket.calls.byEngagement).forEach((b) => {
        bucket.calls.byEngagement[b] += a.calls.byEngagement[b] || 0;
      });
      bucket.leads.assigned += a.leads.assigned;
      Object.keys(bucket.leads.byStatus).forEach((s) => { bucket.leads.byStatus[s] += a.leads.byStatus[s]; });
    });
    const teamTotals = Object.values(teamBuckets).map((bucket) => ({
      ...bucket,
      calls: {
        ...bucket.calls,
        connectRate: bucket.calls.total > 0 ? Math.round((bucket.calls.connected / bucket.calls.total) * 10000) / 10000 : 0,
      },
    }));

    // Report the window actually applied to `calls`, not the raw query params — otherwise a
    // no-param request would render as an unbounded "all time" range beside 30-day numbers.
    const range = resolveCallStatsRange(dateFrom, dateTo);

    return {
      generatedAt: new Date(),
      range: { from: range.from, to: range.to, defaulted: range.defaulted },
      agents,
      teamTotals,
    };
}

module.exports = router;
