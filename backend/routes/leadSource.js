// POST /api/leads/source-update
//
// Bulk-sets Lead.source for every lead whose phone is in the list. Called by ryan-crm's
// campaign-lead upload (Owner panel -> Marketing -> Campaign Leads) so each lead's source
// names the campaign that delivered it. Never creates, assigns, or otherwise touches a lead —
// only `source`, plus one changelog entry recording the change.
//
// LAST UPLOAD WINS. A lead that appears in two campaign uploads ends up with the later one's
// source. Deliberate: if a marketer uploads a list against the wrong campaign, re-uploading it
// against the right one is the fix, with no separate undo path needed. ryan-crm keeps the
// per-campaign upload rows itself, so no attribution history is lost by overwriting here.
const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const { protect, isManager } = require('../middleware/auth');
const normalizePhone = require('../lib/normalizePhone');

const MAX_PHONES = 1000;
const MAX_SOURCE_LEN = 120;

router.post('/source-update', protect, isManager, async (req, res) => {
  try {
    const { phones, source, dryRun = false, ref = null } = req.body || {};

    const label = typeof source === 'string' ? source.trim() : '';
    if (!label) return res.status(400).json({ success: false, error: 'source is required' });
    if (label.length > MAX_SOURCE_LEN) {
      return res.status(400).json({ success: false, error: `source must be at most ${MAX_SOURCE_LEN} characters` });
    }
    if (!Array.isArray(phones) || phones.length === 0) {
      return res.status(400).json({ success: false, error: 'phones must be a non-empty array' });
    }
    if (phones.length > MAX_PHONES) {
      return res.status(400).json({ success: false, error: `phones exceeds the limit of ${MAX_PHONES} per request` });
    }

    // ryan-crm normalizes with an identical helper, but never trust that — Lead.phone is stored
    // normalized to 10 digits, so an un-normalized input would silently match nothing.
    const normalized = [...new Set(phones.map((p) => normalizePhone(String(p))).filter(Boolean))];

    const matched = await Lead.find({ phone: { $in: normalized } }).select('phone source').lean();
    const toChange = matched.filter((l) => (l.source || '') !== label);

    let updated = 0;
    if (!dryRun && toChange.length) {
      const result = await Lead.updateMany(
        // Re-checks `source` in the write itself, so a concurrent upload of the same label
        // can't produce duplicate changelog entries.
        { _id: { $in: toChange.map((l) => l._id) }, source: { $ne: label } },
        {
          $set: { source: label },
          $push: { changelog: {
            changedBy: req.user._id,
            changedByName: req.user.name,
            action: 'source_updated',
            details: { to: label, via: 'campaign_upload', ref },
          } },
        }
      );
      updated = result.modifiedCount;
    }

    return res.json({
      success: true,
      data: {
        requested:  normalized.length,
        matched:    matched.length,
        alreadySet: matched.length - toChange.length,
        updated:    dryRun ? 0 : updated,
        wouldUpdate: dryRun ? toChange.length : undefined,
        unmatched:  normalized.length - matched.length,
        dryRun:     !!dryRun,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
