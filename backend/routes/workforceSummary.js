// GET /api/leads/workforce-summary
//
// Per-agent + per-team rollup of call activity and lead ownership, built entirely from CallLog
// and Lead data already in this system. Consumed by ryan-crm's Owner panel (Live Workforce /
// TL & Manager screens) via CALLBY_API_URL + CALLBY_SERVICE_TOKEN, the same manager-role-JWT
// pattern GET /api/leads/funnel-data already uses.
//
// Query params (all optional):
//   dateFrom, dateTo — ISO date bounds on CallLog.timestamp for the `calls` figures.
//   teams            — comma-separated User.tlName values; only employees under one of these
//                       team leads are included (same resolution leadFunnel.js uses for `teams`).
//
// `leads` figures are a present-moment ownership snapshot, not scoped by dateFrom/dateTo — see
// the comment on getLeadStatsByEmployee in lib/workforceStats.js for why.
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, isManager } = require('../middleware/auth');
const { emptyCallStats, emptyLeadStats, getCallStatsByEmployee, getLeadStatsByEmployee } = require('../lib/workforceStats');

router.get('/workforce-summary', protect, isManager, async (req, res) => {
  try {
    const { dateFrom, dateTo, teams } = req.query;

    // Every employee, not just active ones — `isActive` rides along on each agent row so the
    // Owner panel can decide whether to hide inactive agents, rather than this endpoint
    // silently deciding that for every consumer.
    const employeeFilter = { role: 'employee' };
    if (teams) {
      const teamList = teams.split(',').filter(Boolean);
      employeeFilter.tlName = { $in: teamList };
    }
    const employees = await User.find(employeeFilter).select('name tlName isActive dailyTarget').lean();

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
        employeeId:  id,
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
        if (k === 'connectRate') return; // recomputed after summing, not itself summed
        bucket.calls[k] += a.calls[k];
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

    return res.json({
      success: true,
      data: {
        generatedAt: new Date(),
        range: { from: dateFrom || null, to: dateTo || null },
        agents,
        teamTotals,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
