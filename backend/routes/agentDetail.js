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
//                       Lead.changelog.changedAt (for `recentLeadChangelog`). `leads` is a
//                       present-moment snapshot and ignores these — see lib/workforceStats.js.
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');
const CallLog = require('../models/CallLog');
const { protect, isManager } = require('../middleware/auth');
const { emptyCallStats, emptyLeadStats, getCallStatsByEmployee, getLeadStatsByEmployee } = require('../lib/workforceStats');

router.get('/agent-detail/:employeeId', protect, isManager, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { dateFrom, dateTo } = req.query;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    const employee = await User.findOne({ _id: employeeId, role: 'employee' })
      .select('name tlName isActive dailyTarget')
      .lean();
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const [callMap, leadMap] = await Promise.all([
      getCallStatsByEmployee({ employeeIds: [employeeId], dateFrom, dateTo }),
      getLeadStatsByEmployee({ employeeIds: [employeeId] }),
    ]);

    const callFilter = { employeeId };
    if (dateFrom || dateTo) {
      callFilter.timestamp = {};
      if (dateFrom) callFilter.timestamp.$gte = new Date(dateFrom);
      if (dateTo) callFilter.timestamp.$lte = new Date(dateTo);
    }
    const recentCallDocs = await CallLog.find(callFilter)
      .sort({ timestamp: -1 })
      .limit(20)
      .select('contactName contactNumber callType duration timestamp callStatus')
      .lean();

    const changelogDateMatch = {};
    if (dateFrom || dateTo) {
      changelogDateMatch['changelog.changedAt'] = {};
      if (dateFrom) changelogDateMatch['changelog.changedAt'].$gte = new Date(dateFrom);
      if (dateTo) changelogDateMatch['changelog.changedAt'].$lte = new Date(dateTo);
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

    return res.json({
      success: true,
      data: {
        employee: {
          id: employee._id, name: employee.name, tlName: employee.tlName || null,
          isActive: employee.isActive, dailyTarget: employee.dailyTarget,
        },
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
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
