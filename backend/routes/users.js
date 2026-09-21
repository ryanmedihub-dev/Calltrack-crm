const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const { protect, isAdmin, requireManagement, isSystemAdmin } = require('../middleware/auth');

// ── Safe field projection ─────────────────────────────────────────────────────
// Used in all hierarchy queries. Never returns password, fcmToken, or deviceId.
const SAFE_FIELDS = 'name email role phone tlName isActive dailyTarget createdAt managerId teamLeadId isSuperAdmin';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ── PATCH /api/users/:tlId/manager ────────────────────────────────────────────
// Assign (or reassign) a TL to a Manager.
// Only admin can call this; manager/tl/employee → 403.
// Non-cascading: changing a TL's managerId does not touch the TL's agents.
router.patch('/:tlId/manager', protect, isAdmin, async (req, res) => {
  try {
    const { tlId } = req.params;
    const { managerId } = req.body;

    if (!isValidObjectId(tlId)) {
      return res.status(400).json({ success: false, error: 'Invalid TL ID' });
    }
    if (!managerId || !isValidObjectId(managerId)) {
      return res.status(400).json({ success: false, error: 'managerId is required and must be a valid ID' });
    }
    if (tlId === managerId) {
      return res.status(400).json({ success: false, error: 'A user cannot be assigned to themselves' });
    }

    // Validate target TL
    const tl = await User.findById(tlId).select('_id name role isActive');
    if (!tl) {
      return res.status(404).json({ success: false, error: 'TL not found' });
    }
    if (tl.role !== 'tl') {
      return res.status(400).json({ success: false, error: `Target user has role '${tl.role}'; only users with role 'tl' can be assigned a manager` });
    }

    // Validate manager reference
    const manager = await User.findById(managerId).select('_id name role isActive');
    if (!manager) {
      return res.status(400).json({ success: false, error: 'Referenced manager does not exist' });
    }
    if (manager.role !== 'manager') {
      return res.status(400).json({ success: false, error: `Referenced user has role '${manager.role}'; managerId must point to a user with role 'manager'` });
    }
    if (!manager.isActive) {
      return res.status(400).json({ success: false, error: 'Referenced manager is inactive' });
    }

    const updated = await User.findByIdAndUpdate(
      tlId,
      { $set: { managerId } },
      { new: true }
    ).select(SAFE_FIELDS);

    return res.json({
      success: true,
      data: updated,
      message: `TL '${tl.name}' assigned to Manager '${manager.name}'`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/users/:tlId/manager ──────────────────────────────────────────
// Remove the manager assignment from a TL (sets managerId to null).
// Non-cascading: does not touch the TL's agents.
router.delete('/:tlId/manager', protect, isAdmin, async (req, res) => {
  try {
    const { tlId } = req.params;
    if (!isValidObjectId(tlId)) {
      return res.status(400).json({ success: false, error: 'Invalid TL ID' });
    }

    const tl = await User.findById(tlId).select('_id name role managerId');
    if (!tl) {
      return res.status(404).json({ success: false, error: 'TL not found' });
    }
    if (tl.role !== 'tl') {
      return res.status(400).json({ success: false, error: `Target user has role '${tl.role}'; only users with role 'tl' can have their manager assignment removed` });
    }
    if (!tl.managerId) {
      return res.json({ success: true, data: tl, message: 'TL already has no manager assigned (no-op)' });
    }

    const updated = await User.findByIdAndUpdate(
      tlId,
      { $set: { managerId: null } },
      { new: true }
    ).select(SAFE_FIELDS);

    return res.json({
      success: true,
      data: updated,
      message: `Manager assignment removed from TL '${tl.name}'`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/users/:agentId/team-lead ──────────────────────────────────────
// Assign (or reassign) an Agent to a TL.
// Only admin can call this; manager/tl/employee → 403.
// Non-cascading: only the agent's teamLeadId is updated; other agents are untouched.
router.patch('/:agentId/team-lead', protect, isAdmin, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { teamLeadId } = req.body;

    if (!isValidObjectId(agentId)) {
      return res.status(400).json({ success: false, error: 'Invalid agent ID' });
    }
    if (!teamLeadId || !isValidObjectId(teamLeadId)) {
      return res.status(400).json({ success: false, error: 'teamLeadId is required and must be a valid ID' });
    }
    if (agentId === teamLeadId) {
      return res.status(400).json({ success: false, error: 'A user cannot be assigned to themselves' });
    }

    // Validate target agent
    const agent = await User.findById(agentId).select('_id name role isActive');
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    if (agent.role !== 'employee') {
      return res.status(400).json({ success: false, error: `Target user has role '${agent.role}'; only users with role 'employee' can be assigned a team lead` });
    }

    // Validate TL reference
    const tl = await User.findById(teamLeadId).select('_id name role isActive');
    if (!tl) {
      return res.status(400).json({ success: false, error: 'Referenced team lead does not exist' });
    }
    if (tl.role !== 'tl') {
      return res.status(400).json({ success: false, error: `Referenced user has role '${tl.role}'; teamLeadId must point to a user with role 'tl'` });
    }
    if (!tl.isActive) {
      return res.status(400).json({ success: false, error: 'Referenced team lead is inactive' });
    }

    const updated = await User.findByIdAndUpdate(
      agentId,
      { $set: { teamLeadId } },
      { new: true }
    ).select(SAFE_FIELDS);

    return res.json({
      success: true,
      data: updated,
      message: `Agent '${agent.name}' assigned to TL '${tl.name}'`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/users/:agentId/team-lead ─────────────────────────────────────
// Remove the TL assignment from an agent (sets teamLeadId to null).
// Non-cascading: only this agent is updated; other agents are untouched.
router.delete('/:agentId/team-lead', protect, isAdmin, async (req, res) => {
  try {
    const { agentId } = req.params;
    if (!isValidObjectId(agentId)) {
      return res.status(400).json({ success: false, error: 'Invalid agent ID' });
    }

    const agent = await User.findById(agentId).select('_id name role teamLeadId');
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    if (agent.role !== 'employee') {
      return res.status(400).json({ success: false, error: `Target user has role '${agent.role}'; only users with role 'employee' can have their team lead assignment removed` });
    }
    if (!agent.teamLeadId) {
      return res.json({ success: true, data: agent, message: 'Agent already has no team lead assigned (no-op)' });
    }

    const updated = await User.findByIdAndUpdate(
      agentId,
      { $set: { teamLeadId: null } },
      { new: true }
    ).select(SAFE_FIELDS);

    return res.json({
      success: true,
      data: updated,
      message: `Team lead assignment removed from agent '${agent.name}'`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/users/hierarchy ──────────────────────────────────────────────────
// Returns the organisational hierarchy:
//   - Admin: Full hierarchy (all managers, TLs, agents, unassigned).
//   - Manager: Only their own tree (their TLs and their agents).
//   - TL: Only their own node and their agents.
//   - Employee: 403 Forbidden.
//
// Shape:
//   { managers: [{ manager, teamLeads: [{ tl, agents: [...] }] }],
//     unassignedTLs: [...],
//     unassignedAgents: [...] }
//
// Safe projection: only SAFE_FIELDS are selected — no password, fcmToken, deviceId.
router.get('/hierarchy', protect, requireManagement, async (req, res) => {
  try {
    if (req.user.role === 'manager' && !isSystemAdmin(req.user)) {
      const manager = await User.findById(req.user._id).select(SAFE_FIELDS).lean();
      const tls = await User.find({ role: 'tl', managerId: req.user._id }).select(SAFE_FIELDS).lean();
      const tlIds = tls.map((t) => t._id);
      const agents = await User.find({ role: 'employee', teamLeadId: { $in: tlIds } }).select(SAFE_FIELDS).lean();

      const agentsByTL = {};
      for (const agent of agents) {
        const key = agent.teamLeadId ? agent.teamLeadId.toString() : null;
        if (key) {
          if (!agentsByTL[key]) agentsByTL[key] = [];
          agentsByTL[key].push(agent);
        }
      }

      const teamLeads = tls.map((tl) => ({
        tl,
        agents: agentsByTL[tl._id.toString()] || [],
      }));

      return res.json({
        success: true,
        data: {
          managers: [{ manager, teamLeads }],
          unassignedTLs: [],
          unassignedAgents: [],
        },
      });
    }

    if (req.user.role === 'tl') {
      const tl = await User.findById(req.user._id).select(SAFE_FIELDS).lean();
      const agents = await User.find({ role: 'employee', teamLeadId: req.user._id }).select(SAFE_FIELDS).lean();
      const manager = tl.managerId ? await User.findById(tl.managerId).select(SAFE_FIELDS).lean() : null;

      const teamLeads = [{ tl, agents }];
      const managerNodes = [{ manager, teamLeads }];

      return res.json({
        success: true,
        data: {
          managers: managerNodes,
          unassignedTLs: [],
          unassignedAgents: [],
        },
      });
    }

    // Admin: Full hierarchy
    const [managers, tls, agents] = await Promise.all([
      User.find({ role: 'manager' }).select(SAFE_FIELDS).lean(),
      User.find({ role: 'tl' }).select(SAFE_FIELDS).lean(),
      User.find({ role: 'employee' }).select(SAFE_FIELDS).lean(),
    ]);

    // Index TLs by managerId for O(1) lookup
    const tlsByManager = {};
    const unassignedTLs = [];
    for (const tl of tls) {
      const key = tl.managerId ? tl.managerId.toString() : null;
      if (key) {
        if (!tlsByManager[key]) tlsByManager[key] = [];
        tlsByManager[key].push(tl);
      } else {
        unassignedTLs.push(tl);
      }
    }

    // Index agents by teamLeadId for O(1) lookup
    const agentsByTL = {};
    const unassignedAgents = [];
    for (const agent of agents) {
      const key = agent.teamLeadId ? agent.teamLeadId.toString() : null;
      if (key) {
        if (!agentsByTL[key]) agentsByTL[key] = [];
        agentsByTL[key].push(agent);
      } else {
        unassignedAgents.push(agent);
      }
    }

    // Build manager nodes
    const managerNodes = managers.map((manager) => {
      const managerTLs = tlsByManager[manager._id.toString()] || [];
      const teamLeads = managerTLs.map((tl) => ({
        tl,
        agents: agentsByTL[tl._id.toString()] || [],
      }));
      return { manager, teamLeads };
    });

    return res.json({
      success: true,
      data: {
        managers: managerNodes,
        unassignedTLs,
        unassignedAgents,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
