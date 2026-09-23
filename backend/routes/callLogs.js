const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const CallLog = require('../models/CallLog');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { protect, isManager } = require('../middleware/auth');
const getPusher = require('../lib/pusher');
const normalizePhone = require('../lib/normalizePhone');
const { createPendingDownloadJob, completeDownloadJob, failDownloadJob, MAX_CONTENT_BYTES } = require('../lib/downloadJobs');
const { resolveEmployeeIdsForTL } = require('../lib/tlFilter');
const fmtDuration = require('../lib/formatDuration');
const { createLeadFromCall } = require('../lib/leadFromCall');
const { applyCallToLead } = require('../lib/applyCallToLead');
const { FEATURES } = require('../config/features');
const { BANDS, deriveEngagement } = require('../lib/engagement');
const cache = require('../lib/cache');
const redis = require('../lib/redis');
const crypto = require('crypto');

// Built once at module scope (not per sync op) — maps the $max'd engagementScore back to its
// label inside the same aggregation-pipeline update. $max can't produce a string, so the score
// is the thing that gets maxed and this switch derives the label from whatever score won.
const ENGAGEMENT_SWITCH = {
  $switch: {
    branches: BANDS.map((b) => ({ case: { $eq: ['$engagementScore', b.score] }, then: b.key })),
    default: null,
  },
};

// Stable per-call key used for both in-payload collapsing and the "already synced"
// lead-linking lookup — prefers the device-generated clientCallId (stable across resyncs)
// and only falls back to the timestamp triplet for calls synced before it existed.
function callKey(d) {
  return d.clientCallId
    ? `cid_${d.clientCallId}`
    : `${d.employeeId}_${d.contactNumber}_${new Date(d.timestamp).toISOString()}`;
}

// Returns UTC start/end of a calendar day in IST (UTC+5:30).
function getISTDateBounds(offsetDays = 0) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  nowIST.setUTCHours(0, 0, 0, 0);
  nowIST.setUTCDate(nowIST.getUTCDate() + offsetDays);
  const start = new Date(nowIST.getTime() - IST_OFFSET_MS);
  const end   = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// Returns UTC start/end (7-day span) of the current calendar week (Mon–Sun) in IST.
function getISTWeekBounds() {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const day = nowIST.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7;
  nowIST.setUTCHours(0, 0, 0, 0);
  nowIST.setUTCDate(nowIST.getUTCDate() - diffToMonday);
  const start = new Date(nowIST.getTime() - IST_OFFSET_MS);
  const end   = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

// Returns UTC start/end for an IST calendar-date range given as 'YYYY-MM-DD' strings.
function getISTCustomBounds(startDateStr, endDateStr) {
  let s = startDateStr || new Date().toISOString().slice(0, 10);
  let e = endDateStr || s;
  if (e < s) { const t = s; s = e; e = t; }
  const start = new Date(`${s}T00:00:00+05:30`);
  const end   = new Date(new Date(`${e}T00:00:00+05:30`).getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// Resolves a named/custom range keyword to UTC {start, end} bounds.
function resolveStatsRange(range, startDate, endDate) {
  switch (range) {
    case 'tomorrow': return getISTDateBounds(1);
    case 'yesterday': return getISTDateBounds(-1);
    case 'thisWeek':  return getISTWeekBounds();
    case 'custom':    return getISTCustomBounds(startDate, endDate);
    case 'today':
    default:          return getISTDateBounds(0);
  }
}

// Aggregation-based period stats — no full doc loads
async function computePeriodStats(start, end, employeeId) {
  const match = { timestamp: { $gte: start, $lt: end } };
  if (employeeId) match.employeeId = new mongoose.Types.ObjectId(employeeId);

  const [summary, perHour, employees, notPickupRes, neverAttRes] = await Promise.all([
    CallLog.aggregate([
      { $match: match },
      { $group: {
        _id: null,
        totalCalls:     { $sum: 1 },
        totalDuration:  { $sum: { $ifNull: ['$duration', 0] } },
        incoming:       { $sum: { $cond: [{ $eq: ['$callType', 'incoming'] }, 1, 0] } },
        incomingDur:    { $sum: { $cond: [{ $eq: ['$callType', 'incoming'] }, { $ifNull: ['$duration', 0] }, 0] } },
        outgoing:       { $sum: { $cond: [{ $eq: ['$callType', 'outgoing'] }, 1, 0] } },
        outgoingDur:    { $sum: { $cond: [{ $eq: ['$callType', 'outgoing'] }, { $ifNull: ['$duration', 0] }, 0] } },
        missed:         { $sum: { $cond: [{ $eq: ['$callType', 'missed'] }, 1, 0] } },
        rejected:       { $sum: { $cond: [{ $eq: ['$callType', 'rejected'] }, 1, 0] } },
        connectedCalls: { $sum: { $cond: [{ $gt: ['$duration', 0] }, 1, 0] } },
        uniqueContacts: { $addToSet: '$contactNumber' }
      }},
      { $project: {
        _id: 0,
        totalCalls: 1, totalDuration: 1,
        incoming: 1, incomingDur: 1,
        outgoing: 1, outgoingDur: 1,
        missed: 1, rejected: 1, connectedCalls: 1,
        uniqueClients: { $size: '$uniqueContacts' }
      }}
    ]),

    CallLog.aggregate([
      { $match: match },
      { $group: { _id: { $hour: '$timestamp' }, count: { $sum: 1 } } }
    ]),

    // Per-employee stats — lookup User for name/tlName
    CallLog.aggregate([
      { $match: match },
      { $group: {
        _id:            '$employeeId',
        count:          { $sum: 1 },
        connectedCalls: { $sum: { $cond: [{ $gt: ['$duration', 0] }, 1, 0] } },
        missed:         { $sum: { $cond: [{ $eq: ['$callType', 'missed'] }, 1, 0] } },
        first:          { $min: '$timestamp' },
        last:           { $max: '$timestamp' }
      }},
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
      { $addFields: {
        name:    { $arrayElemAt: ['$userInfo.name', 0] },
        tlName:  { $arrayElemAt: ['$userInfo.tlName', 0] },
        dailyTarget: { $arrayElemAt: ['$userInfo.dailyTarget', 0] }
      }},
      { $project: { userInfo: 0 } },
      { $sort: { count: -1 } }
    ]),

    CallLog.aggregate([
      { $match: { ...match, callType: 'outgoing', $or: [{ duration: 0 }, { duration: null }, { duration: { $exists: false } }] } },
      { $count: 'count' }
    ]),

    CallLog.aggregate([
      { $match: match },
      { $group: {
        _id:         '$contactNumber',
        hasOutgoing: { $max: { $cond: [{ $eq: ['$callType', 'outgoing'] }, 1, 0] } },
        hasMissed:   { $max: { $cond: [{ $eq: ['$callType', 'missed']   }, 1, 0] } }
      }},
      { $match: { hasMissed: 1, hasOutgoing: 0 } },
      { $count: 'count' }
    ])
  ]);

  if (!summary.length) {
    return {
      totalCalls: 0, callDuration: '0s', callDurationSec: 0,
      incoming: 0, incomingDuration: '0s', incomingDurationSec: 0,
      outgoing: 0, outgoingDuration: '0s', outgoingDurationSec: 0,
      missed: 0, rejected: 0, neverAttended: 0, notPickupByClient: 0,
      uniqueClients: 0, workingHours: '0s', workingHoursSec: 0,
      connectedCalls: 0, callsPerHour: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 })),
      topDialers: [], employeeStats: [], activeEmployees: 0, avgDuration: 0
    };
  }

  const s = summary[0];

  let workingSeconds = 0;
  employees.forEach((e) => {
    workingSeconds += Math.max(0, (new Date(e.last) - new Date(e.first)) / 1000);
  });

  const callsPerHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  perHour.forEach((p) => { if (callsPerHour[p._id]) callsPerHour[p._id].count = p.count; });

  const topDialers = employees.slice(0, 5).map((e) => ({
    employeeId: e._id.toString(), name: e.name, count: e.count
  }));

  // Full per-employee breakdown (not capped at top 5) — used by Analytics
  // Agent Performance and the Daily Targets page, which need every employee's
  // numbers, not just the day's leaders.
  //
  // firstCallAt/lastCallAt: the aggregation above already computes `first`/`last`
  // per employee ($min/$max on timestamp) but this mapping used to drop them —
  // ryan-crm's Owner Panel employee-report needs them to show each agent's
  // active call window for the period. This is CALL ACTIVITY, not attendance —
  // consumers must label it accordingly, not as "working hours".
  const employeeStats = employees.map((e) => {
    const target = e.dailyTarget || 0;
    return {
      employeeId: e._id.toString(),
      name: e.name,
      tlName: e.tlName || '',
      count: e.count,
      connectedCalls: e.connectedCalls,
      missed: e.missed,
      connRate: e.count > 0 ? Math.round((e.connectedCalls / e.count) * 100) : 0,
      dailyTarget: target,
      targetAchievement: target > 0 ? Math.round((e.count / target) * 100) : null,
      firstCallAt: e.first || null,
      lastCallAt: e.last || null,
    };
  });

  return {
    totalCalls: s.totalCalls,
    callDuration: fmtDuration(s.totalDuration),
    callDurationSec: s.totalDuration,
    incoming: s.incoming,
    incomingDuration: fmtDuration(s.incomingDur),
    incomingDurationSec: s.incomingDur,
    outgoing: s.outgoing,
    outgoingDuration: fmtDuration(s.outgoingDur),
    outgoingDurationSec: s.outgoingDur,
    missed: s.missed,
    rejected: s.rejected,
    neverAttended: neverAttRes[0]?.count || 0,
    notPickupByClient: notPickupRes[0]?.count || 0,
    uniqueClients: s.uniqueClients,
    workingHours: fmtDuration(workingSeconds),
    workingHoursSec: workingSeconds,
    connectedCalls: s.connectedCalls,
    callsPerHour,
    topDialers,
    employeeStats,
    activeEmployees: employees.length,
    avgDuration: s.totalCalls > 0 ? Math.round(s.totalDuration / s.totalCalls) : 0
  };
}

// Enrich a raw CallLog lean object with computed employeeName/employeePhone
// (populated employeeId comes from .populate('employeeId', 'name phone'))
function enrichWithEmployee(doc) {
  return {
    ...doc,
    employeeName:  doc.employeeId?.name  || 'Unknown',
    employeePhone: doc.employeeId?.phone || '',
    employeeTL:    doc.employeeId?.tlName || '',
    // The schema field is `notes`; `remarks` is the name the UI has always
    // shown as a column label — expose both so existing `.notes` readers
    // keep working while `.remarks` stops rendering blank.
    remarks:       doc.notes || '',
  };
}

// POST /api/calls/sync — employee sends batch of call logs
router.post('/sync', protect, async (req, res) => {
  try {
    const { calls } = req.body;
    if (!Array.isArray(calls) || calls.length === 0) {
      return res.status(400).json({ success: false, error: 'calls array required' });
    }

    // Capture follow-up dates from raw payload — used to update Lead.followUpDate
    const followUpMap = {};
    calls.forEach((c) => {
      if (c.followUpDate && c.contactNumber) {
        followUpMap[normalizePhone(c.contactNumber) || c.contactNumber] = c.followUpDate;
      }
    });

    const docs = calls
      .map((c) => {
        const ts = new Date(c.timestamp);
        // `hasRemark` lets an empty string through as a real edit (the user cleared the
        // remark) while still distinguishing it from "this sync carries no remark for this
        // call". Older app builds send neither flag, so fall back to notes being present.
        const hasRemark = c.hasRemark === true || (c.hasRemark === undefined && c.notes !== undefined && c.notes !== null);
        // When the client didn't send an edit clock (older build), fall back to the call's own
        // timestamp so such an entry always loses to any server-side edit made after the call.
        // That's the safe direction: a stale resync can never clobber a newer dashboard edit.
        const editedAt = c.notesUpdatedAt ? new Date(c.notesUpdatedAt) : ts;
        const band = deriveEngagement({ callType: c.callType, duration: c.duration });
        return {
          contactNumber: normalizePhone(c.contactNumber) || c.contactNumber,
          contactName:   c.contactName,
          callType:      c.callType,
          duration:      c.duration,
          timestamp:     ts,
          notes:         c.notes,
          hasRemark,
          callStatus:    c.callStatus,
          notesEditedAt: Number.isNaN(editedAt.getTime()) ? ts : editedAt,
          clientCallId:  c.clientCallId || null,
          submittedViaPostCall: !!c.submittedViaPostCall,
          employeeId:    req.user._id,
          synced:        true,
          engagement:      band.key,
          engagementScore: band.score,
        };
      })
      .filter((d) => d.contactNumber && d.timestamp && !Number.isNaN(d.timestamp.getTime()) && d.callType);

    // The mobile app resyncs the whole day's calls on every sync (e.g. once the
    // post-call popup is filled in, the same call is resent with notes/callStatus
    // added). We used to rely on a unique DB index on (employeeId, contactNumber,
    // timestamp) to turn those repeat sends into no-ops via insertMany — but that
    // index silently failed to build in production (Mongoose swallows index-build
    // errors), so every resync inserted a fresh duplicate row instead of being
    // deduped. Upserting on that same natural key here makes dedup work
    // independently of whether the DB index exists at all.
    //
    // Also collapse same-key entries within this single payload first — an
    // unordered bulkWrite can't rely on a (possibly still-missing) unique index to
    // stop two upserts for the same not-yet-existing key racing each other.
    const byKey = new Map();
    for (const d of docs) {
      const key = callKey(d);
      const prev = byKey.get(key);
      if (!prev) { byKey.set(key, d); continue; }
      // Collapse by edit clock rather than iteration order. The same call can appear twice in
      // one payload (the raw native row plus a locally enriched copy) in either order, so
      // "whichever came last wins" would non-deterministically drop the newer remark.
      const [newer, older] = d.notesEditedAt >= prev.notesEditedAt ? [d, prev] : [prev, d];
      // Duration heals upward regardless of which copy is newer — see the $max note below.
      const mergedDuration = Math.max(older.duration || 0, newer.duration || 0);
      // Engagement is recomputed from the MERGED duration, not merged independently — a copy
      // carrying a stale 0 duration would otherwise be able to carry a stale (lower) band
      // forward even though the other copy's duration just healed it upward.
      const mergedBand = deriveEngagement({ callType: newer.callType || older.callType, duration: mergedDuration });
      byKey.set(key, {
        ...older,
        ...newer,
        duration: mergedDuration,
        engagement: mergedBand.key,
        engagementScore: mergedBand.score,
        // Only fall back to the older copy's remark if the newer one isn't asserting any.
        ...(newer.hasRemark
          ? { notes: newer.notes, hasRemark: true }
          : older.hasRemark
            ? { notes: older.notes, hasRemark: true }
            : { hasRemark: false }),
        callStatus: newer.callStatus ?? older.callStatus,
      });
    }

    // The app resyncs the entire day on each cycle, so most of a payload is bytes the server
    // has already processed unchanged. Fingerprint each merged call on the fields that can
    // actually change and skip any whose fingerprint we saw recently — Redis-only, best-effort:
    // on a miss, or with Redis down, the call takes the normal path and the write is idempotent
    // anyway. This is a shortcut, never a correctness mechanism, so the skip only ever fires on
    // an exact fingerprint match; a missing fingerprint always falls through to full processing.
    const mergedDocs = [...byKey.values()];
    const fpKeyFor = (d) => redis.key('sync-fp', d.employeeId.toString(), callKey(d));
    const fingerprintOf = (d) => crypto.createHash('sha1')
      .update([callKey(d), d.duration || 0, d.notes ?? '', d.callStatus ?? '', d.notesEditedAt.getTime()].join('|'))
      .digest('base64');

    let toProcess = mergedDocs;
    if (redis.isEnabled() && mergedDocs.length) {
      try {
        const fps = mergedDocs.map(fingerprintOf);
        const seen = await redis.client.mget(...mergedDocs.map(fpKeyFor));
        toProcess = mergedDocs.filter((_d, i) => seen[i] !== fps[i]);
      } catch {
        toProcess = mergedDocs; // Redis hiccup mid-request — fall through to full processing
      }
      if (process.env.DEBUG_SYNC_SKIPS === '1') {
        const skipped = mergedDocs.length - toProcess.length;
        console.log(`[calls/sync] skip ${skipped}/${mergedDocs.length} (${mergedDocs.length ? Math.round((skipped / mergedDocs.length) * 100) : 0}%)`);
      }
    }

    const now = new Date();
    const ops = toProcess.map((d) => {
      // clientCallId is the primary dedup key going forward (stable across resyncs, unlike
      // an exact timestamp match) — only fall back to the timestamp triplet for calls
      // synced by an app version that predates it.
      const filter = d.clientCallId
        ? { employeeId: d.employeeId, clientCallId: d.clientCallId }
        : { employeeId: d.employeeId, contactNumber: d.contactNumber, timestamp: d.timestamp };

      // Last-write-wins guard, evaluated inside the write itself. A read-then-decide in JS
      // would reintroduce exactly the race this exists to close: between the read and the
      // write, a dashboard edit could land and then be silently overwritten.
      const remarkWins = {
        $or: [
          { $eq: [{ $ifNull: ['$notesUpdatedAt', null] }, null] },
          { $gte: [d.notesEditedAt, '$notesUpdatedAt'] },
        ],
      };
      const applyNotes  = d.hasRemark;
      const applyStatus = d.callStatus !== undefined && d.callStatus !== null;

      // Aggregation-pipeline update (Mongo 4.2+, works with upsert). $ifNull is the pipeline
      // equivalent of $setOnInsert; it's the only form that can make a field's new value
      // depend on the document's own current value, which is what the guard above needs.
      // NOTE: Mongoose does not cast pipeline updates — every value here is already a real
      // Date/ObjectId, never a string.
      const stage = {
        employeeId:    { $ifNull: ['$employeeId', d.employeeId] },
        contactNumber: { $ifNull: ['$contactNumber', d.contactNumber] },
        timestamp:     { $ifNull: ['$timestamp', d.timestamp] },
        callType:      { $ifNull: ['$callType', d.callType] },
        contactName:   { $ifNull: ['$contactName', d.contactName ?? 'Unknown'] },
        clientCallId:  { $ifNull: ['$clientCallId', d.clientCallId] },
        leadId:        { $ifNull: ['$leadId', null] },
        synced:        true,
        // Schema defaults don't apply to pipeline updates, so seed createdAt explicitly or
        // upserted rows would have none at all.
        createdAt:     { $ifNull: ['$createdAt', now] },
        // Android's CallLog.Calls.DURATION isn't always finalized the instant a call ends —
        // the first sync can carry a 0 that a later resync corrects. $max means a later
        // correct value heals an earlier 0, while a later spurious 0 never regresses it.
        duration:      { $max: ['$duration', d.duration || 0] },
        // Engagement follows duration and heals the same way: Android can report 0 on the
        // first sync and the real value on a resync, so a later, longer duration must be able
        // to raise the band. $max on the ordinal score does that without a read.
        engagementScore: { $max: [{ $ifNull: ['$engagementScore', -1] }, d.engagementScore] },
      };

      if (applyNotes)  stage.notes      = { $cond: [remarkWins, d.notes, '$notes'] };
      if (applyStatus) stage.callStatus = { $cond: [remarkWins, d.callStatus, '$callStatus'] };
      if (applyNotes || applyStatus) {
        stage.notesUpdatedAt     = { $cond: [remarkWins, d.notesEditedAt, '$notesUpdatedAt'] };
        stage.notesUpdatedBy     = { $cond: [remarkWins, d.employeeId, '$notesUpdatedBy'] };
        stage.notesUpdatedByName = { $cond: [remarkWins, req.user.name, '$notesUpdatedByName'] };
      }

      // The label can't be $max'd (it's a string) — a second stage derives it from whatever
      // score the first stage just settled on, in the same pipeline update, no extra round trip.
      return { updateOne: { filter, update: [{ $set: stage }, { $set: { engagement: ENGAGEMENT_SWITCH } }], upsert: true } };
    });

    let inserted = [];
    // Index -> failed. null = the whole bulkWrite failed with no per-op detail.
    let failedIdx = new Set();
    if (ops.length) {
      try {
        const result = await CallLog.bulkWrite(ops, { ordered: false });
        const newIds = Object.values(result.upsertedIds || {});
        if (newIds.length) inserted = await CallLog.find({ _id: { $in: newIds } });
      } catch (bulkErr) {
        // An unordered bulkWrite THROWS if even one op fails (e.g. a duplicate-key
        // collision), even though every other op in the batch still committed — letting
        // that propagate to the outer catch would 500 the whole sync request and skip the
        // lead-linking loop below for every other call in this batch too. Surface the
        // failed ops loudly instead of silently losing whichever call collided, and keep
        // going with whatever did succeed (the lead-linking loop below re-queries by the
        // batch's own keys, not by `inserted`, so it isn't affected by this).
        const writeErrors = bulkErr.writeErrors || bulkErr.result?.writeErrors || [];
        console.error(
          `[calls/sync] bulkWrite: ${writeErrors.length || 'unknown count of'} op(s) failed out of ${ops.length}:`,
          writeErrors.map((e) => ({ index: e.index, code: e.code, message: e.errmsg || e.message }))
        );
        failedIdx = writeErrors.length ? new Set(writeErrors.map((e) => e.index)) : null;
        const newIds = Object.values(bulkErr.result?.upsertedIds || {});
        if (newIds.length) inserted = await CallLog.find({ _id: { $in: newIds } }).catch(() => []);
      }

      // Fingerprint only ops that actually committed. A fingerprint on a failed op makes every
      // resync skip that call for 24h, so a DB outage (e.g. Atlas quota) silently lost the call.
      const committed = failedIdx ? toProcess.filter((_d, i) => !failedIdx.has(i)) : [];
      if (redis.isEnabled() && committed.length) {
        try {
          const pipeline = redis.client.pipeline();
          committed.forEach((d) => pipeline.set(fpKeyFor(d), fingerprintOf(d), 'EX', 86400));
          await pipeline.exec();
        } catch {}
      }

      // Nothing saved -> tell the app, so it queues the calls instead of treating them as synced.
      if (!failedIdx || failedIdx.size === ops.length) {
        return res.status(503).json({ success: false, error: 'Call logs could not be saved, will retry' });
      }
    }

    // Auto-link to lead and update lead call stats / callLogs array.
    // Re-fetch ALL docs in this batch (not just freshly-inserted ones) — the mobile
    // app resyncs the whole day's calls on every sync, so a call is often already
    // in the DB (synced bare, before the post-call popup was filled in) by the time
    // its enriched resync arrives. lib/applyCallToLead.js is what makes every call count
    // toward Lead.attempts exactly once regardless of how many times it resyncs.
    //
    // From EVERY doc in the payload, not just `toProcess`. The fingerprint skip only saves the
    // bulkWrite; linking must still see skipped calls, because a call made before its Lead
    // existed (imported / webhooked later the same day) is only ever linked here — lead imports
    // do not back-link calls. applyCallToLead() returns without writing for calls that have
    // nothing new, so this costs the same two reads the loop always did.
    const batchKeys = docs
      .map((d) => d.clientCallId
        ? { employeeId: req.user._id, clientCallId: d.clientCallId }
        : { employeeId: req.user._id, contactNumber: d.contactNumber, timestamp: d.timestamp })
      .filter((k) => k.clientCallId || (k.contactNumber && k.timestamp));
    const batchDocs = batchKeys.length ? await CallLog.find({ $or: batchKeys }) : [];

    const phoneToLead = {};
    const phones = [...new Set(batchDocs.map((l) => l.contactNumber).filter(Boolean))];
    if (phones.length) {
      const leads = await Lead.find({ phone: { $in: phones } });
      leads.forEach((l) => { phoneToLead[l.phone] = l; });
    }

    for (const log of batchDocs) {
      const lead = phoneToLead[log.contactNumber];
      const fuDate = followUpMap[log.contactNumber];

      if (!lead) {
        if (!log.leadId && FEATURES.AUTO_LEAD_CREATE_ON_CALL && log.callType === 'outgoing' && (log.duration || 0) > 0) {
          // No lead exists yet. Off by default — see config/features.js: every dialled number
          // becoming a Lead pollutes the pool filter, retry queue, report tabs and ryan-crm.
          try {
            const contactName = log.contactName && log.contactName !== 'Unknown'
              ? log.contactName
              : log.contactNumber;
            const band = deriveEngagement(log);
            const newLead = await createLeadFromCall({
              actor:  req.user,
              call:   log,
              name:   contactName,
              phone:  log.contactNumber,
              source: 'Call',
              status: band.status,
              note:   log.notes,
              followUpDate: fuDate,
              engagement:          band.key,
              engagementScore:     band.score,
              lastCallEngagement:  band.key,
              engagementUpdatedAt: log.timestamp,
            });
            await CallLog.findByIdAndUpdate(log._id, { leadId: newLead._id });
            phoneToLead[log.contactNumber] = newLead; // so later logs in this batch link to it too
          } catch (_err) {
            // Rare race (two calls to the same brand-new number synced concurrently) — the
            // lead created by the other request will be picked up by phoneToLead next sync.
          }
        }
        continue; // no lead for this number -> call log saved, nothing else happens
      }

      try {
        await applyCallToLead({ log, lead, user: req.user, followUpDate: fuDate });
      } catch (err) {
        // One bad lead must not fail the whole sync — the call logs are already saved above.
        console.error('[calls/sync] applyCallToLead failed:', log._id.toString(), err.message);
      }
    }

    const pusher = getPusher();
    if (pusher && inserted.length) {
      const events = inserted.map((log) => ({
        channel: 'managers',
        name: 'new_call_log',
        data: {
          _id:           log._id.toString(),
          employeeId:    log.employeeId.toString(),
          employeeName:  req.user.name,
          callType:      log.callType,
          duration:      log.duration,
          timestamp:     log.timestamp,
          contactNumber: log.contactNumber,
          contactName:   log.contactName,
          hasLead:       !!phoneToLead[log.contactNumber]
        }
      }));
      for (let i = 0; i < events.length; i += 10) {
        await pusher.triggerBatch(events.slice(i, i + 10));
      }
    }

    return res.status(201).json({
      success: true,
      data: { synced: inserted.length },
      message: `${inserted.length} call logs synced`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/calls — all call logs with filters (manager)
//
// tlName/durationMin/durationMax/connectedOnly and the leadId populate were
// added for ryan-crm's Owner Panel call report (/owner/calls/report), which
// needs the same shape as this route already returns plus team-level
// filtering and a "linked lead" column — additive, nothing existing changes.
router.get('/', protect, isManager, async (req, res) => {
  try {
    const {
      employeeId, callType, startDate, endDate, search, unsynced,
      tlName, durationMin, durationMax, connectedOnly, engagement,
      page = 1, limit = 20,
    } = req.query;
    const filter = {};
    if (employeeId) filter.employeeId = employeeId;
    else if (tlName) filter.employeeId = { $in: await resolveEmployeeIdsForTL(tlName) };
    if (callType) filter.callType = callType;
    if (engagement) filter.engagement = engagement;
    // "Unsynced" here means "no matching lead was auto-linked" (leadId is null),
    // not the CallLog.synced device-sync flag — matches the page's own copy.
    if (unsynced === 'true') filter.leadId = null;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const ed = new Date(endDate);
        ed.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = ed;
      }
    }
    if (connectedOnly === 'true') {
      filter.duration = { ...(filter.duration || {}), $gt: 0 };
    } else if (durationMin || durationMax) {
      filter.duration = { ...(filter.duration || {}) };
      if (durationMin) filter.duration.$gte = parseInt(durationMin);
      if (durationMax) filter.duration.$lte = parseInt(durationMax);
    }
    if (search) {
      filter.$or = [
        { contactNumber: { $regex: search, $options: 'i' } },
        { contactName:   { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [callsRaw, total] = await Promise.all([
      CallLog.find(filter)
        .populate('employeeId', 'name phone tlName')
        .populate('leadId', 'name status')
        .sort({ timestamp: -1, _id: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      CallLog.countDocuments(filter)
    ]);
    const calls = callsRaw.map((c) => ({
      ...enrichWithEmployee(c),
      leadName:   c.leadId?.name   || null,
      leadStatus: c.leadId?.status || null,
    }));
    return res.json({
      success: true,
      data: { calls, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/calls/stats — full dashboard stats (today/yesterday/lastWeek + a
// filterable `selected` bucket driven by ?range=today|tomorrow|thisWeek|custom
// (custom also takes ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD, IST calendar dates)
router.get('/stats', protect, isManager, async (req, res) => {
  try {
    const { range = 'today', startDate, endDate, employee } = req.query;
    const employeeId = employee && mongoose.Types.ObjectId.isValid(employee) ? employee : null;

    // Not scoped to the requesting manager — every manager sees the same numbers for a given
    // range/employee, so the cache key only needs the query inputs, not req.user.
    const data = await cache.cached(
      ['calls', 'stats', range, startDate || '', endDate || '', employeeId || ''],
      30,
      async () => {
        const { start: todayStart, end: todayEnd } = getISTDateBounds(0);
        const { start: ystStart,   end: ystEnd   } = getISTDateBounds(-1);
        const lw7Start = new Date(ystEnd); lw7Start.setDate(lw7Start.getDate() - 7);
        const lw7End   = new Date(ystEnd);
        const lm30Start = new Date(ystEnd); lm30Start.setDate(lm30Start.getDate() - 30);
        const lm30End   = new Date(ystEnd);

        const isToday = range === 'today';
        const { start: selStart, end: selEnd } = resolveStatsRange(range, startDate, endDate);

        const [todayStats, yesterdayStats, lastWeekStats, lastMonthStats, selectedStats] = await Promise.all([
          computePeriodStats(todayStart, todayEnd, employeeId),
          computePeriodStats(ystStart, ystEnd, employeeId),
          computePeriodStats(lw7Start, lw7End, employeeId),
          computePeriodStats(lm30Start, lm30End, employeeId),
          isToday ? Promise.resolve(null) : computePeriodStats(selStart, selEnd, employeeId)
        ]);

        const fmtDate = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
        lastWeekStats.period  = `${fmtDate(lw7Start)} to ${fmtDate(new Date(lw7End.getTime() - 86400000))}`;
        lastMonthStats.period = `${fmtDate(lm30Start)} to ${fmtDate(new Date(lm30End.getTime() - 86400000))}`;

        const selected = isToday ? todayStats : selectedStats;
        selected.date = range === 'custom'
          ? `${fmtDate(selStart)} to ${fmtDate(new Date(selEnd.getTime() - 86400000))}`
          : fmtDate(selStart);

        return {
          today:     { ...todayStats,     date: fmtDate(todayStart) },
          yesterday: { ...yesterdayStats, date: fmtDate(ystStart) },
          lastWeek:  lastWeekStats,
          lastMonth: lastMonthStats,
          selected,
          range,
          employee: employeeId,
          totalToday:     todayStats.totalCalls,
          missedToday:    todayStats.missed,
          incomingToday:  todayStats.incoming,
          outgoingToday:  todayStats.outgoing,
          rejectedToday:  todayStats.rejected,
          avgDuration:    todayStats.avgDuration,
          activeEmployees: todayStats.activeEmployees,
          topDialers:     todayStats.topDialers,
          employeeStats:  todayStats.employeeStats,
          callsPerHour:   todayStats.callsPerHour
        };
      }
    );

    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/calls/daily-by-employee — per-employee, per-IST-calendar-day call
// activity for a date range: calls, connected, first/last call timestamp,
// target attainment vs each employee's own dailyTarget. Added for ryan-crm's
// Owner Panel "Attendance" page (Part 6): that page SUGGESTS a day status
// from this activity data but a human must confirm/override it — this
// endpoint only reports call counts, it makes no claim about presence.
router.get('/daily-by-employee', protect, isManager, async (req, res) => {
  try {
    const records = await cache.cached(['calls', 'daily-by-employee', req.query], 60, async () => {
      const { startDate, endDate, employeeId } = req.query;
      const { start, end } = getISTCustomBounds(startDate, endDate);
      const match = { timestamp: { $gte: start, $lt: end } };
      if (employeeId && mongoose.Types.ObjectId.isValid(employeeId)) {
        match.employeeId = new mongoose.Types.ObjectId(employeeId);
      }

      const rows = await CallLog.aggregate([
        { $match: match },
        { $group: {
          _id: {
            employeeId: '$employeeId',
            day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'Asia/Kolkata' } },
          },
          count:          { $sum: 1 },
          connectedCalls: { $sum: { $cond: [{ $gt: ['$duration', 0] }, 1, 0] } },
          first:          { $min: '$timestamp' },
          last:           { $max: '$timestamp' }
        }},
        { $lookup: { from: 'users', localField: '_id.employeeId', foreignField: '_id', as: 'userInfo' } },
        { $addFields: {
          name:        { $arrayElemAt: ['$userInfo.name', 0] },
          tlName:      { $arrayElemAt: ['$userInfo.tlName', 0] },
          dailyTarget: { $arrayElemAt: ['$userInfo.dailyTarget', 0] }
        }},
        { $project: { userInfo: 0 } },
        { $sort: { '_id.day': 1 } }
      ]);

      return rows.map((r) => {
        const target = r.dailyTarget || 0;
        return {
          employeeId:        r._id.employeeId ? r._id.employeeId.toString() : '',
          date:              r._id.day,
          name:              r.name || 'Unknown',
          tlName:            r.tlName || '',
          totalCalls:        r.count,
          connectedCalls:    r.connectedCalls,
          connRate:          r.count > 0 ? Math.round((r.connectedCalls / r.count) * 100) : 0,
          dailyTarget:       target,
          targetAchievement: target > 0 ? Math.round((r.count / target) * 100) : null,
          firstCallAt:       r.first || null,
          lastCallAt:        r.last || null
        };
      });
    });

    return res.json({ success: true, data: { records } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/calls/realtime — latest 50 calls
router.get('/realtime', protect, isManager, async (req, res) => {
  try {
    const callsRaw = await CallLog.find().populate('employeeId', 'name phone tlName').sort({ timestamp: -1, _id: -1 }).limit(50).lean();
    return res.json({ success: true, data: callsRaw.map(enrichWithEmployee) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/calls/my-stats — per-employee aggregated stats for mobile analytics
router.get('/my-stats', protect, async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    const now = new Date();
    let start;
    if (period === 'today') {
      start = new Date(now); start.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      start = new Date(now); start.setDate(now.getDate() - 7); start.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      start = new Date(now); start.setDate(1); start.setHours(0, 0, 0, 0);
    } else {
      start = new Date(0);
    }

    const match = { employeeId: req.user._id, timestamp: { $gte: start, $lte: now } };

    const [mainAgg, perHour] = await Promise.all([
      CallLog.aggregate([
        { $match: match },
        { $group: {
          _id:            null,
          total:          { $sum: 1 },
          incoming:       { $sum: { $cond: [{ $eq: ['$callType', 'incoming'] }, 1, 0] } },
          outgoing:       { $sum: { $cond: [{ $eq: ['$callType', 'outgoing'] }, 1, 0] } },
          missed:         { $sum: { $cond: [{ $eq: ['$callType', 'missed']   }, 1, 0] } },
          rejected:       { $sum: { $cond: [{ $eq: ['$callType', 'rejected'] }, 1, 0] } },
          totalDuration:  { $sum: { $ifNull: ['$duration', 0] } },
          connectedCalls: { $sum: { $cond: [{ $gt: ['$duration', 0] }, 1, 0] } },
          uniqueContacts: { $addToSet: '$contactNumber' }
        }},
        { $project: {
          _id: 0, total: 1, incoming: 1, outgoing: 1, missed: 1, rejected: 1,
          totalDuration: 1, connectedCalls: 1,
          uniqueContacts: { $size: '$uniqueContacts' }
        }}
      ]),
      CallLog.aggregate([
        { $match: match },
        { $group: { _id: { $hour: '$timestamp' }, count: { $sum: 1 } } }
      ])
    ]);

    const s = mainAgg[0] || { total: 0, incoming: 0, outgoing: 0, missed: 0, rejected: 0, totalDuration: 0, connectedCalls: 0, uniqueContacts: 0 };
    const callsPerHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    perHour.forEach((p) => { if (callsPerHour[p._id]) callsPerHour[p._id].count = p.count; });

    const bestHour = callsPerHour.reduce((best, h) => h.count > best.count ? h : best, { hour: -1, count: 0 });
    const connectedRate = s.total > 0 ? Math.round((s.connectedCalls / s.total) * 100) : 0;
    const avgDuration   = s.total > 0 ? Math.round(s.totalDuration / s.total) : 0;
    // Working Time = talk time (every call attempt's duration, not just connected ones) +
    // a flat 1 minute of overhead per call (dialing, wrap-up, etc.)
    const workingTimeSec = s.totalDuration + (s.total * 2 * 60);

    return res.json({
      success: true,
      data: {
        period, ...s,
        avgDuration, connectedRate,
        totalDurationFmt: fmtDuration(s.totalDuration),
        workingTimeSec,
        workingTimeFmt: fmtDuration(workingTimeSec),
        callsPerHour,
        bestHour: bestHour.hour >= 0 ? bestHour.hour : null
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

function csvEsc(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }

// GET /api/calls/export — CSV export (manager); also registered in the Downloads Center.
// Streams the response (res.write per row) instead of buffering the whole file in
// memory, so large exports start downloading immediately and don't hold the full
// CSV in Node memory. A capped copy is also accumulated to register with the
// Downloads Center for re-download, matching the existing 8MB job-content limit.
router.get('/export', protect, isManager, async (req, res) => {
  let job = null;
  try {
    const { employeeId, callType, startDate, endDate, tlName, source } = req.query;
    const filter = {};
    if (employeeId) filter.employeeId = employeeId;
    else if (tlName) filter.employeeId = { $in: await resolveEmployeeIdsForTL(tlName) };
    if (callType)   filter.callType   = callType;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const ed = new Date(endDate); ed.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = ed;
      }
    }
    // Source lives on the linked Lead, not the call itself — same approach as the periodic
    // report (see routes/reports.js): resolve to matching lead ids first. A call never linked
    // to a lead has no source and is excluded once this filter is applied.
    if (source) {
      const matchingLeadIds = await Lead.find({ source: { $regex: source, $options: 'i' } }).distinct('_id');
      filter.leadId = { $in: matchingLeadIds };
    }
    const filename = `calls_${startDate ? startDate.slice(0, 10) : 'all'}_${endDate ? endDate.slice(0, 10) : 'now'}.csv`;

    try {
      job = await createPendingDownloadJob({ ownerId: req.user._id, label: 'Call Logs Export', filename });
    } catch {}

    // Resolve employee names/TLs and lead sources via one lookup each instead of populate() on
    // the cursor — populate() re-queries per row as the cursor iterates, which turns a 10k-row
    // export into 10k extra round-trips.
    const employeeIds = await CallLog.distinct('employeeId', filter);
    const employees = await User.find({ _id: { $in: employeeIds } }, 'name tlName').lean();
    const employeeMap = new Map(employees.map((e) => [String(e._id), e]));

    const leadIds = (await CallLog.distinct('leadId', filter)).filter(Boolean);
    const leadsForSource = await Lead.find({ _id: { $in: leadIds } }, 'source').lean();
    const leadSourceMap = new Map(leadsForSource.map((l) => [String(l._id), l.source || '']));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const header = 'Date,Time,Employee,Employee TL,Contact Name,Contact Number,Type,Call Status,Duration,Notes,Remarks Updated At,Remarks Updated By,Source,Lead Linked,Synced\n';
    res.write(header);

    let jobBuf = [header];
    let jobBytes = Buffer.byteLength(header, 'utf8');
    let jobOverflowed = false;

    // Batch rows into ~64KB chunks before flushing to the response — cuts the
    // number of res.write() calls (and underlying TCP writes) by two-plus
    // orders of magnitude on large exports versus writing one row at a time.
    const FLUSH_BYTES = 64 * 1024;
    let outBuf = '';

    const cursor = CallLog.find(filter).sort({ timestamp: -1, _id: -1 }).lean().cursor();
    for await (const doc of cursor) {
      const employee = employeeMap.get(String(doc.employeeId));
      const d = new Date(doc.timestamp);
      const line = [
        d.toLocaleDateString('en-IN'),
        d.toLocaleTimeString('en-IN'),
        csvEsc(employee?.name),
        csvEsc(employee?.tlName),
        csvEsc(doc.contactName),
        doc.contactNumber || '',
        doc.callType || '',
        csvEsc(doc.callStatus),
        fmtDuration(doc.duration),
        csvEsc(doc.notes),
        doc.notesUpdatedAt
          ? csvEsc(new Date(doc.notesUpdatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))
          : '',
        csvEsc(doc.notesUpdatedByName),
        csvEsc(doc.leadId ? leadSourceMap.get(String(doc.leadId)) : ''),
        doc.leadId ? 'Yes' : 'No',
        doc.synced ? 'Yes' : 'No',
      ].join(',') + '\n';

      outBuf += line;
      if (outBuf.length >= FLUSH_BYTES) { res.write(outBuf); outBuf = ''; }

      if (!jobOverflowed) {
        jobBytes += Buffer.byteLength(line, 'utf8');
        if (jobBytes > MAX_CONTENT_BYTES) { jobOverflowed = true; jobBuf = null; }
        else jobBuf.push(line);
      }
    }
    if (outBuf) res.write(outBuf);
    res.end();

    if (job) {
      try {
        job = jobOverflowed
          ? await failDownloadJob(job._id, 'Export too large to store for re-download from the Downloads Center — the direct download completed successfully.')
          : await completeDownloadJob(job._id, jobBuf.join(''));
      } catch {}
    }
  } catch (err) {
    if (job) { try { await failDownloadJob(job._id, err.message); } catch {} }
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
    else res.end();
  }
});

// GET /api/calls/pending-followups — leads with a future followUpDate assigned to this employee
router.get('/pending-followups', protect, async (req, res) => {
  try {
    const leads = await Lead.find({
      assignedTo:  req.user._id,
      followUpDate: { $gt: new Date() },
    }).sort({ followUpDate: 1 }).limit(200).lean();

    // Map to shape the mobile client expects
    const data = leads.map((l) => ({
      _id:           l._id,
      contactName:   l.name,
      contactNumber: l.phone,
      followUpDate:  l.followUpDate,
      notes:         l.lastCallNote || '',
    }));

    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/calls/:id/notes — add notes or status to a call log
router.patch('/:id/notes', protect, async (req, res) => {
  try {
    const { notes, callStatus, followUpDate, notesUpdatedAt } = req.body;
    const call = await CallLog.findById(req.params.id);
    if (!call) return res.status(404).json({ success: false, error: 'Call not found' });
    const isOwner = call.employeeId.toString() === req.user._id.toString();
    if (req.user.role !== 'manager' && !isOwner) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Last-write-wins, same rule as POST /sync. The offline note queue can retry a PATCH
    // minutes after it was composed, by which point a newer edit may already have landed —
    // applying it then would silently roll the newer remark back.
    if (notesUpdatedAt && call.notesUpdatedAt) {
      const incoming = new Date(notesUpdatedAt);
      if (!Number.isNaN(incoming.getTime()) && incoming < call.notesUpdatedAt) {
        return res.json({ success: true, data: call, message: 'Ignored — a newer edit already applied' });
      }
    }
    // Only stamp the audit fields when the remark/status text actually changes — a no-op
    // PATCH (e.g. the mobile modal re-saving an untouched note, or a double-submit) would
    // otherwise keep bumping the "last edited" time and make reports show phantom activity.
    const notesChanged  = notes      !== undefined && notes      !== (call.notes ?? '');
    const statusChanged = callStatus !== undefined && callStatus !== (call.callStatus ?? null);

    if (notes      !== undefined) call.notes      = notes;
    if (callStatus !== undefined) call.callStatus = callStatus;

    if (notesChanged || statusChanged) {
      // Prefer the client's own edit clock when it sent one. A queued offline PATCH composed
      // at T1 but delivered at T2 must be stamped T1, or it would look newer than it is and
      // could out-rank an edit that genuinely happened in between.
      const stampedAt = notesUpdatedAt ? new Date(notesUpdatedAt) : new Date();
      call.notesUpdatedAt     = Number.isNaN(stampedAt.getTime()) ? new Date() : stampedAt;
      call.notesUpdatedBy     = req.user._id;
      call.notesUpdatedByName = req.user.name;
      // Marks this edit as already pushed to the lead (below), so the next app resync of the
      // same call (POST /sync, via lib/applyCallToLead.js) doesn't push it again.
      call.leadSyncedAt       = call.notesUpdatedAt;
    }
    await call.save();

    // Propagate callStatus/notes/followUpDate to linked lead's tracking fields
    // (follow-up dates live on Lead, not CallLog — see GET /pending-followups)
    if (call.leadId) {
      const leadUpdate = {};
      if (callStatus) leadUpdate.lastCallSummary = callStatus;
      if (followUpDate !== undefined) leadUpdate.followUpDate = followUpDate ? new Date(followUpDate) : null;
      if (Object.keys(leadUpdate).length) {
        await Lead.findByIdAndUpdate(call.leadId, { $set: leadUpdate }).catch(() => {});
      }
      // Only the lead's most recent call may overwrite its "last call" remark — editing the
      // note on an older call must not replace today's remark on the lead. Mirrors a cleared
      // remark too (`notes !== undefined`, not `notes &&`) so a deleted note doesn't leave
      // stale text showing on the lead.
      if (notes !== undefined) {
        await Lead.updateOne(
          { _id: call.leadId, lastCallAt: { $lte: call.timestamp } },
          { $set: { lastCallNote: notes.trim() } }
        ).catch(() => {});
      }
    }

    return res.json({ success: true, data: call });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/calls/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const call = await CallLog.findById(req.params.id);
    if (!call) return res.status(404).json({ success: false, error: 'Call not found' });
    const isOwner = call.employeeId.toString() === req.user._id.toString();
    if (req.user.role !== 'manager' && !isOwner) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    await call.deleteOne();
    return res.json({ success: true, message: 'Call deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/calls/history/:phoneNumber — every synced call to a given number, each with its
// own notes/callStatus (not just the latest lastCallNote on the Lead), for the mobile app's
// tap-a-call-to-see-history feature.
router.get('/history/:phoneNumber', protect, async (req, res) => {
  try {
    const number = normalizePhone(req.params.phoneNumber) || req.params.phoneNumber;
    const filter = { contactNumber: number };
    if (req.user.role !== 'manager') filter.employeeId = req.user._id;
    const calls = await CallLog.find(filter)
      .populate('employeeId', 'name phone tlName')
      .sort({ timestamp: -1 })
      .lean();
    return res.json({ success: true, data: calls.map(enrichWithEmployee) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/calls/employee/:id
router.get('/employee/:id', protect, async (req, res) => {
  const isManagerRole = req.user.role === 'manager';
  const isSelf = req.user._id.toString() === req.params.id;
  if (!isManagerRole && !isSelf) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  try {
    const { callType, startDate, endDate, page = 1, limit = 20 } = req.query;
    const filter = { employeeId: req.params.id };
    if (callType) filter.callType = callType;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate)   filter.timestamp.$lte = new Date(endDate);
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [callsRaw, total, [agg]] = await Promise.all([
      CallLog.find(filter).populate('employeeId', 'name phone').sort({ timestamp: -1, _id: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      CallLog.countDocuments(filter),
      CallLog.aggregate([
        { $match: { employeeId: new mongoose.Types.ObjectId(req.params.id) } },
        { $group: {
          _id:           null,
          total:         { $sum: 1 },
          missed:        { $sum: { $cond: [{ $eq: ['$callType', 'missed'] }, 1, 0] } },
          totalDuration: { $sum: { $ifNull: ['$duration', 0] } }
        }}
      ])
    ]);
    const calls = callsRaw.map(enrichWithEmployee);
    const stats = agg
      ? { total: agg.total, missed: agg.missed, avgDuration: agg.total > 0 ? Math.round(agg.totalDuration / agg.total) : 0 }
      : { total: 0, missed: 0, avgDuration: 0 };
    return res.json({
      success: true,
      data: { calls, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), stats }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;