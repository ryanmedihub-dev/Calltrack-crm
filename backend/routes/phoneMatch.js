// POST /api/leads/phone-match
//
// Batch phone lookup for ryan-crm's marketing-attribution flow: given up to 1000 phone numbers
// from an uploaded campaign list, report per-number call activity (count, connected, duration,
// engagement) and whether a callby Lead exists for it — in two aggregations, not one round trip
// per number. Consumed via CALLBY_API_URL + CALLBY_SERVICE_TOKEN, same manager-role-JWT pattern
// as workforce-summary/funnel-data.
const express = require('express');
const router = express.Router();
const CallLog = require('../models/CallLog');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { protect, isManager } = require('../middleware/auth');
const normalizePhone = require('../lib/normalizePhone');
const { phoneVariants } = require('../lib/assignToLastCaller');
const { bandByScore } = require('../lib/engagement');

const MAX_PHONES = 1000;

router.post('/phone-match', protect, isManager, async (req, res) => {
  try {
    const { phones, dateFrom, dateTo } = req.body || {};
    if (!Array.isArray(phones) || phones.length === 0) {
      return res.status(400).json({ success: false, error: 'phones must be a non-empty array' });
    }
    if (phones.length > MAX_PHONES) {
      return res.status(400).json({ success: false, error: `phones exceeds the limit of ${MAX_PHONES} per request` });
    }

    // ryan-crm normalizes on its side too (src/lib/phone.js, identical logic), but this endpoint
    // never trusts that — every incoming number is normalized here before matching or keying.
    const normalizedSet = new Set(phones.map((p) => normalizePhone(String(p))).filter(Boolean));
    const normalizedPhones = [...normalizedSet];

    const range = { from: dateFrom ? new Date(dateFrom) : null, to: dateTo ? new Date(dateTo) : null, defaulted: false };

    // Lead.phone is normalized to 10 digits, but older CallLog.contactNumber rows carry whatever
    // shape the device reported — match every variant and fold the result back onto the
    // normalized key. Reusing phoneVariants() from assignToLastCaller.js rather than a second copy.
    const variantToNormalized = new Map();
    normalizedPhones.forEach((phone) => phoneVariants(phone).forEach((v) => variantToNormalized.set(v, phone)));
    const allVariants = [...variantToNormalized.keys()];

    const match = { contactNumber: { $in: allVariants } };
    if (range.from || range.to) {
      match.timestamp = {};
      if (range.from) match.timestamp.$gte = range.from;
      if (range.to)   match.timestamp.$lte = range.to;
    }

    const rows = await CallLog.aggregate([
      { $match: match },
      { $sort: { timestamp: -1 } }, // so $first below picks the latest call per number
      {
        $group: {
          _id: '$contactNumber',
          calls: { $sum: 1 },
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
          firstCallAt: { $min: '$timestamp' },
          lastCallAt: { $max: '$timestamp' },
          bestEngagementScore: { $max: { $ifNull: ['$engagementScore', 0] } },
          lastCallType: { $first: '$callType' },
          lastEmployeeId: { $first: '$employeeId' },
          lastEngagement: { $first: '$engagement' },
        },
      },
    ]);

    // Merge variant rows back onto the normalized number a caller actually asked about.
    const merged = new Map();
    rows.forEach((r) => {
      const phone = variantToNormalized.get(r._id);
      if (!phone) return;
      const prev = merged.get(phone);
      if (!prev) {
        merged.set(phone, { ...r, phone });
        return;
      }
      prev.calls += r.calls;
      prev.connected += r.connected;
      prev.totalDurationSeconds += r.totalDurationSeconds;
      if (r.firstCallAt < prev.firstCallAt) prev.firstCallAt = r.firstCallAt;
      prev.bestEngagementScore = Math.max(prev.bestEngagementScore, r.bestEngagementScore);
      if (r.lastCallAt > prev.lastCallAt) {
        prev.lastCallAt = r.lastCallAt;
        prev.lastCallType = r.lastCallType;
        prev.lastEmployeeId = r.lastEmployeeId;
        prev.lastEngagement = r.lastEngagement;
      }
    });

    const employeeIds = [...new Set([...merged.values()].map((m) => String(m.lastEmployeeId)).filter(Boolean))];
    const users = employeeIds.length
      ? await User.find({ _id: { $in: employeeIds } }).select('name').lean()
      : [];
    const nameById = new Map(users.map((u) => [String(u._id), u.name]));

    const leads = await Lead.find({ phone: { $in: normalizedPhones } })
      .select('name phone status source assignedTo createdAt')
      .populate('assignedTo', 'name')
      .lean();
    const leadByPhone = new Map(leads.map((l) => [l.phone, l]));

    const matches = {};
    merged.forEach((m, phone) => {
      const lead = leadByPhone.get(phone);
      matches[phone] = {
        calls: m.calls,
        connected: m.connected,
        totalDurationSeconds: m.totalDurationSeconds,
        firstCallAt: m.firstCallAt,
        lastCallAt: m.lastCallAt,
        lastCallType: m.lastCallType,
        lastEmployeeId: m.lastEmployeeId ? String(m.lastEmployeeId) : null,
        lastEmployeeName: m.lastEmployeeId ? (nameById.get(String(m.lastEmployeeId)) || null) : null,
        bestEngagement: bandByScore(m.bestEngagementScore).key,
        bestEngagementScore: m.bestEngagementScore,
        lastEngagement: m.lastEngagement || null,
        lead: lead ? {
          id: lead._id,
          status: lead.status,
          source: lead.source || null,
          assignedToName: lead.assignedTo ? lead.assignedTo.name : null,
          createdAt: lead.createdAt,
        } : null,
      };
    });

    return res.json({
      success: true,
      data: {
        range: { from: range.from, to: range.to, defaulted: range.defaulted },
        matches,
        unmatchedCount: normalizedPhones.length - Object.keys(matches).length,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
