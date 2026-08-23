// GET /api/leads/retry-queue
//
// Prioritized list of currently-assigned leads worth calling back, ranked P0 (most urgent) to
// P4. Built entirely from Lead fields already maintained elsewhere in this system — no new
// tracking. Consumed by ryan-crm's Owner panel (Retry & Recovery screen) via CALLBY_API_URL +
// CALLBY_SERVICE_TOKEN, the same manager-role-JWT pattern GET /api/leads/funnel-data already uses.
//
// Query params (all optional):
//   dateFrom, dateTo — ISO date bounds on Lead.createdAt.
//   teams            — comma-separated User.tlName values; only leads assigned to employees
//                       under one of these team leads are included (same resolution
//                       leadFunnel.js uses for `teams`).
const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const User = require('../models/User');
const { protect, isManager } = require('../middleware/auth');

// Written as the eligible set (the complement of ['converted', 'booking_done', 'lost',
// 'not_interested']) rather than a $nin of the excluded ones — Mongo can use the {assignedTo,
// status} index for an $in bounds scan, but not for $nin, which falls back to examining every
// document. Same result set either way; this shape is the one that stays fast as leads grow.
const ELIGIBLE_STATUSES = ['interested', 'contacted', 'new', 'not_connected', 'follow_up'];
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const PRIORITY_ORDER = ['P0', 'P1', 'P2', 'P3', 'P4'];

// Priority rules, checked in order — a lead is scored by the first rule its status matches,
// never by more than one. A lead whose status doesn't satisfy its own tier's extra condition
// (e.g. an 'interested' lead with no past follow-up) falls all the way through and is excluded
// from the queue entirely — it isn't "less urgent", it just isn't a retry-queue case (a future
// follow-up is already being tracked via its own reminder, not this queue).
function computePriority(lead, now) {
  const { status, followUpDate, attempts, connectedCallCount, lastCallAt } = lead;

  if (status === 'interested' && followUpDate && new Date(followUpDate).getTime() < now) {
    return 'P0';
  }
  if (
    status === 'contacted' && (connectedCallCount || 0) > 0 && lastCallAt &&
    (now - new Date(lastCallAt).getTime()) <= SEVEN_DAYS_MS
  ) {
    return 'P1';
  }
  if (status === 'new' && (attempts || 0) === 0) {
    return 'P2';
  }
  if (
    status === 'not_connected' &&
    (!lastCallAt || (now - new Date(lastCallAt).getTime()) > FOUR_HOURS_MS)
  ) {
    return 'P3';
  }
  if (['follow_up', 'contacted', 'not_connected'].includes(status)) {
    return 'P4';
  }
  return null;
}

function ageHours(lead, now) {
  const ref = lead.lastCallAt || lead.createdAt;
  return (now - new Date(ref).getTime()) / (1000 * 60 * 60);
}

router.get('/retry-queue', protect, isManager, async (req, res) => {
  try {
    const { dateFrom, dateTo, teams } = req.query;

    const filter = {
      status: { $in: ELIGIBLE_STATUSES },
      assignedTo: { $ne: null }, // only leads someone actually owns belong in a retry queue
    };
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }
    if (teams) {
      const teamList = teams.split(',').filter(Boolean);
      const teamEmployeeIds = await User.distinct('_id', { tlName: { $in: teamList } });
      filter.assignedTo = { $in: teamEmployeeIds };
    }

    const candidates = await Lead.find(filter)
      .populate('assignedTo', 'name tlName')
      .select('name phone status attempts lastCallAt lastCallType followUpDate connectedCallCount createdAt assignedTo')
      .lean();

    const now = Date.now();
    const leads = [];
    for (const lead of candidates) {
      const priority = computePriority(lead, now);
      if (!priority) continue;
      leads.push({
        id: lead._id,
        name: lead.name,
        phone: lead.phone,
        status: lead.status,
        attempts: lead.attempts || 0,
        lastCallAt: lead.lastCallAt || null,
        lastCallType: lead.lastCallType || null,
        followUpDate: lead.followUpDate || null,
        assignedTo: lead.assignedTo
          ? { id: lead.assignedTo._id, name: lead.assignedTo.name, tlName: lead.assignedTo.tlName || null }
          : null,
        ageHours: Math.round(ageHours(lead, now) * 100) / 100,
        priority,
      });
    }

    leads.sort((a, b) => {
      const pDiff = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
      return pDiff !== 0 ? pDiff : b.ageHours - a.ageHours;
    });

    return res.json({
      success: true,
      data: { generatedAt: new Date(), leads },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
