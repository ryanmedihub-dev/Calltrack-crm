
const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const User = require('../models/User');
const { protect, requireManagement } = require('../middleware/auth');
const { getScopedEmployeeIds, validateEmployeeInScope } = require('../lib/scope');
const normalizePhone = require('../lib/normalizePhone');

router.get('/funnel-data', protect, requireManagement, async (req, res) => {
  try {
    const { agentIds, teams, dateFrom, dateTo, leadNumber } = req.query;

    // Single lead-number lookup
    if (leadNumber) {
      const phone = normalizePhone(leadNumber) || leadNumber;
      const lead = await Lead.findOne({ phone })
        .populate('assignedTo', 'name tlName')
        .lean();
      if (!lead) return res.json({ success: true, data: [] });

      if (lead.assignedTo) {
        const inScope = await validateEmployeeInScope(req.user, lead.assignedTo._id);
        if (!inScope) return res.json({ success: true, data: [] });
      } else if (req.user.role !== 'admin') {
        return res.json({ success: true, data: [] });
      }
      return res.json({ success: true, data: [serializeLead(lead)] });
    }

    const filter = {};

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const scopedEmpIds = await getScopedEmployeeIds(req.user);
    const scopedIdStrings = scopedEmpIds ? new Set(scopedEmpIds.map((id) => id.toString())) : null;

    // Resolve team names -> employee ids, then merge with any directly
    // passed agentIds so both filters can be applied together.
    let resolvedAgentIds = agentIds ? agentIds.split(',').filter(Boolean) : null;

    if (teams) {
      const teamList = teams.split(',').filter(Boolean);
      const teamEmployeeIds = await User.distinct('_id', { tlName: { $in: teamList } });
      const teamIdStrings = teamEmployeeIds.map((id) => id.toString());
      resolvedAgentIds = resolvedAgentIds
        ? resolvedAgentIds.filter((id) => teamIdStrings.includes(id))
        : teamIdStrings;
    }

    // Intersect or apply server-side scope
    if (scopedIdStrings !== null) {
      if (resolvedAgentIds) {
        const intersected = resolvedAgentIds.filter((id) => scopedIdStrings.has(id));
        filter.assignedTo = { $in: intersected };
      } else {
        filter.assignedTo = { $in: scopedEmpIds };
      }
    } else if (resolvedAgentIds) {
      filter.assignedTo = { $in: resolvedAgentIds };
    }

    const leads = await Lead.find(filter)
      .populate('assignedTo', 'name tlName')
      .select('name phone status attempts connectedCallCount lastCallAt assignedTo createdAt')
      .lean();

    return res.json({ success: true, data: leads.map(serializeLead) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

function serializeLead(lead) {
  return {
    id: lead._id,
    name: lead.name,
    phone: lead.phone,
    status: lead.status,
    attempts: lead.attempts || 0,
    connectedCallCount: lead.connectedCallCount || 0,
    lastCallAt: lead.lastCallAt || null,
    createdAt: lead.createdAt,
    agent: lead.assignedTo ? { id: lead.assignedTo._id, name: lead.assignedTo.name, team: lead.assignedTo.tlName || null } : null,
  };
}

module.exports = router;
