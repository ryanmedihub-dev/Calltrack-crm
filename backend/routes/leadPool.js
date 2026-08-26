const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const { protect, isManager } = require('../middleware/auth');
const normalizePhone = require('../lib/normalizePhone');
const getPusher = require('../lib/pusher');
const { logAction } = require('../lib/audit');
const { normalizeExtraDetails } = require('../lib/normalizeExtraDetails');

// Tunable because the right values depend on how the floor actually works, and these will be
// adjusted after watching real recycle volume for a week.
const RECYCLE_AFTER_MS      = 30 * 60 * 1000;  // grace period after claim / after a short call
const SHORT_CALL_MAX_SEC    = 60;              // a call at or under this didn't amount to a conversation
const MAX_RECYCLES          = 3;               // after this many, the lead sticks with its holder

// Statuses that mean a claimed lead is being worked successfully — the recycle sweep must
// never pull these back into the pool out from under the agent closing them.
const RECYCLE_PROTECTED_STATUSES = ['booking_done', 'converted', 'interested', 'follow_up'];

// ── Core design note ───────────────────────────────────────────────────────────
// Pool membership is not a stored flag: "in the pool" *is* `assignedTo: null`. That makes
// pooled-and-owned mutually exclusive by construction rather than by convention, brings every
// already-unassigned lead into the pool with zero migration, and leaves no second collection
// to reconcile. `pooledAt` exists only to order the pool — a lead released back should surface
// as newly available rather than stay buried under everything imported since it was created.
const POOL_FILTER = { assignedTo: null };

// Indian mobile numbers: 10 digits starting 6-9, post-normalisation.
const PHONE_RE = /^[6-9]\d{9}$/;

const ALLOWED_SOURCES = ['Meta', 'WhatsApp', 'Instagram', 'Web Chat', 'Website', 'Referral', 'Excel Upload'];

const CHANNEL = 'lead-pool';

// Pusher is optional infrastructure (getPusher() returns null when unconfigured). A realtime
// outage must never fail the write that triggered it, so every broadcast is best-effort.
function broadcast(event, payload) {
  try {
    const pusher = getPusher();
    if (!pusher) return;
    pusher.trigger(CHANNEL, event, payload).catch(() => {});
  } catch {}
}

// Escapes user input before it reaches a $regex, so a search for "a+b" can't be parsed as a
// quantifier (or, with a pathological pattern, stall the query).
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeMetaRef(meta) {
  if (!meta || typeof meta !== 'object') return undefined;
  const created = meta.createdTime || meta.created_time;
  const parsed = created ? new Date(created) : null;
  return {
    leadgenId:   meta.leadgenId   || meta.leadgen_id   || undefined,
    formId:      meta.formId      || meta.form_id      || undefined,
    pageId:      meta.pageId      || meta.page_id      || undefined,
    adId:        meta.adId        || meta.ad_id        || undefined,
    createdTime: parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined,
  };
}

// GET /api/lead-pool — the pool itself.
// Deliberately `protect` and not `isManager`: the whole point is that agents browse it.
router.get('/', protect, async (req, res) => {
  try {
    const { search, source, tag, page = 1, limit = 30 } = req.query;
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 30));

    const filter = { ...POOL_FILTER };
    if (source) filter.source = source;
    if (tag)    filter.tags = tag;
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: 'i' };
      filter.$or = [{ name: rx }, { phone: rx }];
    }

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        // Sort matches the { assignedTo, pooledAt } index. `createdAt` is the tiebreaker for
        // rows predating pooledAt (backfilled or legacy unassigned leads).
        .sort({ pooledAt: -1, createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        // extraDetails/metaRef.leadgenId ride along so the pool card can show budget and
        // timeline chips without a second round trip per lead. recycleCount/lastRecycledAt let
        // the card warn an agent that someone already tried this number and got nowhere.
        .select('name phone email source city tags status pooledAt createdAt extraDetails metaRef.leadgenId recycleCount lastRecycledAt')
        .lean(),
      Lead.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: {
        leads,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/lead-pool/stats
router.get('/stats', protect, async (req, res) => {
  try {
    // IST day boundary — the server runs UTC, so "today" has to be computed against
    // Asia/Kolkata or the counter rolls over at 5:30am local.
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    nowIST.setUTCHours(0, 0, 0, 0);
    const todayStart = new Date(nowIST.getTime() - IST_OFFSET_MS);

    const [available, claimedToday, recycledToday, bySource, oldest] = await Promise.all([
      Lead.countDocuments(POOL_FILTER),
      Lead.countDocuments({ claimedAt: { $gte: todayStart } }),
      Lead.countDocuments({ lastRecycledAt: { $gte: todayStart } }),
      Lead.aggregate([
        { $match: POOL_FILTER },
        { $group: { _id: { $ifNull: ['$source', 'Unknown'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, source: '$_id', count: 1 } },
      ]),
      Lead.find(POOL_FILTER).sort({ pooledAt: 1, createdAt: 1 }).select('pooledAt createdAt').limit(1).lean(),
    ]);

    return res.json({
      success: true,
      data: {
        available,
        claimedToday,
        recycledToday,
        bySource,
        oldestWaitingSince: oldest[0] ? (oldest[0].pooledAt || oldest[0].createdAt) : null,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/lead-pool/attempts-by-employee — who has been calling pool leads without claiming
// them. A lead stays in the pool (assignedTo: null) until someone taps "Attend", but the call
// sync auto-links any call to a matching lead by phone number regardless of assignment — so an
// employee can dial a pool number straight from their phone and rack up attempts on a lead that
// never shows as theirs. Managers use this to see who's actually working the pool.
router.get('/attempts-by-employee', protect, isManager, async (req, res) => {
  try {
    const rows = await Lead.aggregate([
      { $match: { ...POOL_FILTER, attempts: { $gt: 0 } } },
      { $unwind: '$changelog' },
      { $match: { 'changelog.action': 'call_linked' } },
      {
        $group: {
          _id:           '$changelog.changedBy',
          employeeName:  { $first: '$changelog.changedByName' },
          attempts:      { $sum: 1 },
          leadIds:       { $addToSet: '$_id' },
          lastAttemptAt: { $max: '$changelog.changedAt' },
        },
      },
      {
        $project: {
          _id: 0,
          employeeId:   '$_id',
          employeeName: 1,
          attempts:     1,
          leadsTouched: { $size: '$leadIds' },
          lastAttemptAt: 1,
        },
      },
      { $sort: { attempts: -1 } },
    ]);

    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/lead-pool/my-claims — what this agent has taken, newest first.
router.get('/my-claims', protect, async (req, res) => {
  try {
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const leads = await Lead.find({ claimedBy: req.user._id })
      .sort({ claimedAt: -1 })
      .limit(limitNum)
      .select('name phone source city tags status claimedAt lastCallAt attempts extraDetails recycleCount lastRecycledAt recycleLocked')
      .lean();
    return res.json({ success: true, data: leads });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/lead-pool/:id/claim — "Attend Lead".
router.post('/:id/claim', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, error: 'Lead not found', code: 'NOT_FOUND' });
    }

    // The entire concurrency story is `assignedTo: null` being part of the *filter*: MongoDB
    // decides which of two simultaneous taps wins, atomically. Splitting this into a find()
    // followed by a save() would reintroduce exactly the race this design exists to remove.
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, assignedTo: null },
      {
        $set: {
          assignedTo: req.user._id,
          claimedAt:  new Date(),
          claimedBy:  req.user._id,
          pooledAt:   null,
        },
        $push: {
          changelog: {
            changedBy:     req.user._id,
            changedByName: req.user.name,
            action:        'assigned',
            details:       { source: 'lead_pool_claim' },
          },
        },
      },
      { new: true }
    );

    if (!lead) {
      // Distinguish the two failure modes so the app can say something true and self-correct,
      // instead of showing a generic error the agent will just retry into the same wall.
      const exists = await Lead.exists({ _id: req.params.id });
      return exists
        ? res.status(409).json({ success: false, error: 'This lead was just claimed by someone else', code: 'ALREADY_CLAIMED' })
        : res.status(404).json({ success: false, error: 'Lead not found', code: 'NOT_FOUND' });
    }

    await logAction(req, 'lead.claim', {
      entity: 'Lead',
      entityId: lead._id,
      details: { name: lead.name, phone: lead.phone, source: lead.source },
    });

    broadcast('lead_claimed', {
      leadId: lead._id.toString(),
      claimedBy: req.user._id.toString(),
      claimedByName: req.user.name,
    });

    return res.json({ success: true, data: lead, message: 'Lead assigned to you' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/lead-pool/:id/release — put a lead back. Manager, or the current owner.
router.post('/:id/release', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, error: 'Lead not found', code: 'NOT_FOUND' });
    }
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found', code: 'NOT_FOUND' });

    const isOwner = lead.assignedTo && lead.assignedTo.toString() === req.user._id.toString();
    if (req.user.role !== 'manager' && !isOwner) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    lead.assignedTo = null;
    lead.claimedAt  = null;
    lead.claimedBy  = null;
    // Re-stamped rather than restored, so a released lead surfaces at the top of the pool as
    // newly available instead of sinking under everything imported since it was created.
    lead.pooledAt   = new Date();
    lead.changelog.push({
      changedBy:     req.user._id,
      changedByName: req.user.name,
      action:        'updated',
      details:       { source: 'lead_pool_release' },
    });
    await lead.save();

    await logAction(req, 'lead.release', { entity: 'Lead', entityId: lead._id, details: { name: lead.name } });
    broadcast('lead_added', { leadId: lead._id.toString(), name: lead.name, source: lead.source });

    return res.json({ success: true, data: lead, message: 'Lead returned to the pool' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/lead-pool/push — manager pushes existing leads back into the pool in bulk.
router.post('/push', protect, isManager, async (req, res) => {
  try {
    const { leadIds } = req.body;
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ success: false, error: 'leadIds array required' });
    }
    const ids = leadIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (!ids.length) return res.status(400).json({ success: false, error: 'No valid lead ids' });

    const result = await Lead.updateMany(
      { _id: { $in: ids } },
      {
        $set: { assignedTo: null, claimedAt: null, claimedBy: null, pooledAt: new Date() },
        $push: {
          changelog: {
            changedBy:     req.user._id,
            changedByName: req.user.name,
            action:        'updated',
            details:       { source: 'lead_pool_push' },
          },
        },
      }
    );

    await logAction(req, 'lead.pool_push', { entity: 'Lead', details: { count: result.modifiedCount } });
    broadcast('pool_refreshed', { pushed: result.modifiedCount });

    return res.json({
      success: true,
      data: { pushed: result.modifiedCount },
      message: `${result.modifiedCount} lead(s) pushed to the pool`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/lead-pool/:id/lock — manager stops a lead from ever auto-recycling again, without
// waiting for it to hit MAX_RECYCLES.
router.post('/:id/lock', protect, isManager, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, error: 'Lead not found', code: 'NOT_FOUND' });
    }
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      {
        $set: { recycleLocked: true },
        $push: {
          changelog: {
            changedBy:     req.user._id,
            changedByName: req.user.name,
            action:        'updated',
            details:       { source: 'recycle_lock' },
          },
        },
      },
      { new: true }
    );
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found', code: 'NOT_FOUND' });
    return res.json({ success: true, data: lead, message: 'Lead will no longer auto-recycle' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/lead-pool/:id/unlock — manager lets a capped-out or manually-pinned lead recycle again.
router.post('/:id/unlock', protect, isManager, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, error: 'Lead not found', code: 'NOT_FOUND' });
    }
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      {
        $set: { recycleLocked: false },
        $push: {
          changelog: {
            changedBy:     req.user._id,
            changedByName: req.user.name,
            action:        'updated',
            details:       { source: 'recycle_unlock' },
          },
        },
      },
      { new: true }
    );
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found', code: 'NOT_FOUND' });
    return res.json({ success: true, data: lead, message: 'Lead can recycle again' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Auto-recycle sweep ─────────────────────────────────────────────────────────
// Exported and run on a timer from server.js (not mounted as a route) — see the scheduling
// comment there for why it's a plain setInterval guarded to a single PM2 worker.
//
// A lead qualifies when it is claimed, unlocked, not being worked successfully, and either:
//   1. no call has happened since it was claimed, and the grace period has elapsed since claim, or
//   2. the most recent call came AFTER the claim, was short, and the grace period has elapsed
//      since that call.
//
// The `claimedAt <= cutoff` pre-filter below is a sound superset for both branches: branch 2
// requires `lastCallAt > claimedAt` AND `now - lastCallAt > RECYCLE_AFTER_MS`, which together
// imply `now - claimedAt > RECYCLE_AFTER_MS` too. So narrowing on claimedAt alone via the
// {recycleLocked, claimedAt} index never drops a real candidate, while keeping the sweep an
// index range scan instead of a collection scan.
async function runRecycleSweep() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - RECYCLE_AFTER_MS);

  const candidates = await Lead.find({
    recycleLocked: false,
    claimedAt: { $ne: null, $lte: cutoff },
    assignedTo: { $ne: null },
    status: { $nin: RECYCLE_PROTECTED_STATUSES },
    $and: [
      // No future follow-up — a lead with a scheduled callback is being worked, not stalled.
      { $or: [{ followUpDate: null }, { followUpDate: { $exists: false } }, { followUpDate: { $lte: now } }] },
      // Never recycle off the back of a genuine connected conversation — only a lead whose most
      // recently recorded call was short (or that has never connected at all) is a candidate.
      { $or: [{ connectedCallCount: { $lte: 0 } }, { lastCallDuration: { $lte: SHORT_CALL_MAX_SEC } }] },
    ],
  })
    .select('_id assignedTo claimedAt lastCallAt lastCallDuration recycleCount')
    .lean();

  const ops = [];
  for (const lead of candidates) {
    const { claimedAt, lastCallAt, lastCallDuration } = lead;
    // Critical: a lead recycled once already carries the PREVIOUS holder's call in lastCallAt/
    // lastCallDuration. Comparing lastCallAt to claimedAt is what stops the new holder from
    // being punished for a call they didn't make — without it, every re-claimed lead would look
    // like an instant short-call recycle and blow through MAX_RECYCLES in one sweep.
    const callSinceClaim = lastCallAt && claimedAt && lastCallAt.getTime() > claimedAt.getTime();

    let reason = null;
    if (!callSinceClaim) {
      if (now.getTime() - claimedAt.getTime() > RECYCLE_AFTER_MS) reason = 'no_call';
    } else if ((lastCallDuration || 0) <= SHORT_CALL_MAX_SEC) {
      if (now.getTime() - lastCallAt.getTime() > RECYCLE_AFTER_MS) reason = 'short_call';
    }
    if (!reason) continue;

    const nextCount = (lead.recycleCount || 0) + 1;
    const willLock = nextCount >= MAX_RECYCLES;
    const setFields = { lastRecycledAt: now, recycleLocked: willLock };
    // Capped out: stays with whoever holds it rather than pooling a 4th time.
    if (!willLock) {
      setFields.assignedTo = null;
      setFields.claimedAt  = null;
      setFields.claimedBy  = null;
      setFields.pooledAt   = now;
    }

    ops.push({
      updateOne: {
        // recycleLocked: false re-checked at write time so a manager's lock/unlock click
        // racing with this sweep can't be clobbered by a stale read.
        filter: { _id: lead._id, recycleLocked: false },
        update: {
          $set: setFields,
          $inc: { recycleCount: 1 },
          $push: {
            changelog: {
              changedByName: 'Auto-recycle',
              action:        'assigned',
              details: {
                source:           'auto_recycle',
                reason,
                previousAssignee: lead.assignedTo,
                recycleCount:     nextCount,
                locked:           willLock,
              },
            },
          },
        },
      },
    });
  }

  if (!ops.length) return { candidates: candidates.length, recycled: 0 };

  const result = await Lead.bulkWrite(ops, { ordered: false });
  broadcast('pool_refreshed', { recycled: result.modifiedCount });
  return { candidates: candidates.length, recycled: result.modifiedCount };
}

// ── Meta lead-ads webhook ──────────────────────────────────────────────────────
// Meta can't present a JWT, so these two routes sit outside `protect` and are gated by a
// shared secret instead. Both default CLOSED: if the env var is unset the endpoint rejects
// everything rather than silently accepting anonymous writes.
function verifyWebhookToken(req, res) {
  const expected = process.env.META_WEBHOOK_TOKEN;
  if (!expected) {
    res.status(503).json({ success: false, error: 'Webhook not configured' });
    return false;
  }
  const provided = req.headers['x-webhook-token'] || req.query.token;
  if (provided !== expected) {
    res.status(401).json({ success: false, error: 'Invalid webhook token' });
    return false;
  }
  return true;
}

// GET — Meta's subscription handshake. Echoes hub.challenge back verbatim.
router.get('/meta-webhook', (req, res) => {
  const expected = process.env.META_VERIFY_TOKEN;
  if (!expected) return res.status(503).send('Webhook not configured');
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === expected) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

// POST — ingest one lead, or a batch under { leads: [...] }.
router.post('/meta-webhook', async (req, res) => {
  if (!verifyWebhookToken(req, res)) return;
  try {
    const body = req.body || {};
    const incoming = Array.isArray(body.leads) ? body.leads : [body];

    let inserted = 0, duplicates = 0, invalid = 0;

    for (const raw of incoming) {
      const phone = normalizePhone(raw.phone || raw.phone_number || raw.mobile || '');
      if (!phone || !PHONE_RE.test(phone)) { invalid++; continue; }

      const extraDetails = normalizeExtraDetails(raw.extraDetails || raw.extra_details);
      const metaRef = normalizeMetaRef(raw.meta);

      try {
        await Lead.create({
          name:   raw.name || raw.full_name || phone,
          phone,
          email:  raw.email || undefined,
          city:   raw.city || raw.location || undefined,
          // Source comes from the caller now that more than one relay posts here (Meta webhook,
          // the CXWizard sheet script, and future intakes). Whitelisted rather than passed
          // through: source drives the pool's filter dropdown and its bySource stats, so one
          // typo in a caller would permanently add a junk facet that nobody can remove from the UI.
          source: ALLOWED_SOURCES.includes(raw.source) ? raw.source : 'Meta',
          importedBy: 'meta-webhook',
          // Always unassigned: that's what puts it in the pool.
          assignedTo: null,
          pooledAt:   new Date(),
          extraDetails,
          ...(metaRef ? { metaRef } : {}),
        });
        inserted++;
      } catch (err) {
        if (err.code === 11000) {
          duplicates++;
          // Enrich only — never re-pool or re-assign. A returning enquiry's fresh answers are
          // useful context for whoever already owns the lead, and losing them helps nobody;
          // but touching assignedTo/pooledAt/status would take an actively-worked lead away
          // from its owner mid-conversation. The $or guard means we only fill a genuine gap,
          // so a re-delivered webhook can't overwrite answers already on the record.
          if (extraDetails.length) {
            await Lead.updateOne(
              { phone, $or: [{ extraDetails: { $size: 0 } }, { extraDetails: { $exists: false } }] },
              { $set: { extraDetails, ...(metaRef ? { metaRef } : {}) } }
            ).catch(() => {});
          }
        } else {
          invalid++;
        }
      }
    }

    if (inserted) broadcast('lead_added', { count: inserted, source: 'Meta' });

    return res.json({
      success: true,
      data: { inserted, duplicates, invalid, total: incoming.length },
      message: `${inserted} lead(s) added to the pool`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// router is a function (express.Router()), so it can carry the sweep alongside the routes
// without changing the `app.use('/api/lead-pool', leadPoolRoutes)` mount in server.js.
router.runRecycleSweep = runRecycleSweep;

module.exports = router;
