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
      .map((c) => ({
        contactNumber: normalizePhone(c.contactNumber) || c.contactNumber,
        contactName:   c.contactName,
        callType:      c.callType,
        duration:      c.duration,
        timestamp:     c.timestamp,
        notes:         c.notes,
        callStatus:    c.callStatus,
        employeeId:    req.user._id,
        synced:        true
      }))
      .filter((d) => d.contactNumber && d.timestamp && d.callType);

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
      const key = `${d.employeeId}_${d.contactNumber}_${new Date(d.timestamp).toISOString()}`;
      const prev = byKey.get(key);
      byKey.set(key, prev ? {
        ...prev,
        notes:      d.notes      || prev.notes,
        callStatus: d.callStatus || prev.callStatus,
        duration:   d.duration   || prev.duration,
      } : d);
    }

    const ops = [...byKey.values()].map((d) => {
      const setOnInsert = { callType: d.callType, contactName: d.contactName, synced: true };
      const set = {};
      if (d.notes)      set.notes      = d.notes;
      if (d.callStatus) set.callStatus = d.callStatus;
      return {
        updateOne: {
          filter: { employeeId: d.employeeId, contactNumber: d.contactNumber, timestamp: d.timestamp },
          update: {
            $setOnInsert: setOnInsert,
            // Android's CallLog.Calls.DURATION isn't always finalized the instant a call
            // ends — the first sync of a call can carry a 0 that only gets corrected on a
            // later resync once the OS finalizes it. $max (instead of folding duration into
            // $setOnInsert/$set) means a later correct value can heal an earlier 0, while a
            // later spurious 0 can never regress an already-correct duration.
            $max: { duration: d.duration || 0 },
            ...(Object.keys(set).length ? { $set: set } : {}),
          },
          upsert: true,
        },
      };
    });

    let inserted = [];
    if (ops.length) {
      const result = await CallLog.bulkWrite(ops, { ordered: false });
      const newIds = Object.values(result.upsertedIds || {});
      if (newIds.length) inserted = await CallLog.find({ _id: { $in: newIds } });
    }

    // Auto-link to lead and update lead call stats / callLogs array.
    // Re-fetch ALL docs in this batch (not just freshly-inserted ones) — the mobile
    // app resyncs the whole day's calls on every sync, so a call is often already
    // in the DB (synced bare, before the post-call popup was filled in) by the time
    // its enriched resync arrives. Using `leadId` as the "already counted" guard
    // means every call still gets counted toward Lead.attempts exactly once, even
    // if the lead didn't exist yet on an earlier sync and only appeared later.
    const batchKeys = docs
      .map((d) => ({ employeeId: req.user._id, contactNumber: d.contactNumber, timestamp: d.timestamp }))
      .filter((k) => k.contactNumber && k.timestamp);
    const batchDocs = batchKeys.length ? await CallLog.find({ $or: batchKeys }) : [];

    const phoneToLead = {};
    const phones = [...new Set(batchDocs.map((l) => l.contactNumber).filter(Boolean))];
    if (phones.length) {
      const leads = await Lead.find({ phone: { $in: phones } });
      leads.forEach((l) => { phoneToLead[l.phone] = l; });
    }

    for (const log of batchDocs) {
      if (log.leadId) continue; // already linked + counted on a previous sync

      const lead = phoneToLead[log.contactNumber];

      if (lead) {
        // Existing lead: update call stats + add callLog reference
        await CallLog.findByIdAndUpdate(log._id, { leadId: lead._id });

        const fuDate = followUpMap[log.contactNumber];
        const updateData = {
          $inc: { attempts: 1 },
          $set: {
            lastCallAt:            log.timestamp,
            lastCallType:          log.callType,
            lastCallDuration:      log.duration || 0,
            lastCallEmployee:      req.user.name,
            lastCallEmployeePhone: req.user.phone || '',
          },
          $addToSet: { callLogs: log._id },
          $push: {
            changelog: {
              changedBy:     req.user._id,
              changedByName: req.user.name,
              action:        'call_linked',
              details: {
                callType:   log.callType,
                duration:   log.duration || 0,
                timestamp:  log.timestamp,
                notes:      log.notes     || null,
                callStatus: log.callStatus || null,
              }
            }
          }
        };

        if ((log.duration || 0) > 0) updateData.$inc.connectedCallCount = 1;
        if (fuDate) updateData.$set.followUpDate = new Date(fuDate);
        if (log.callStatus) updateData.$set.lastCallSummary = log.callStatus;
        if (log.notes && log.notes.trim()) updateData.$set.lastCallNote = log.notes.trim();

        await Lead.findByIdAndUpdate(lead._id, updateData);

      }
      // No number in system — call log saved, lead is created only when employee explicitly submits via the app
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
router.get('/', protect, isManager, async (req, res) => {
  try {
    const { employeeId, callType, startDate, endDate, search, unsynced, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (employeeId) filter.employeeId = employeeId;
    if (callType) filter.callType = callType;
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
    if (search) {
      filter.$or = [
        { contactNumber: { $regex: search, $options: 'i' } },
        { contactName:   { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [callsRaw, total] = await Promise.all([
      CallLog.find(filter).populate('employeeId', 'name phone tlName').sort({ timestamp: -1, _id: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      CallLog.countDocuments(filter)
    ]);
    const calls = callsRaw.map(enrichWithEmployee);
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

    return res.json({
      success: true,
      data: {
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
      }
    });
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

    return res.json({
      success: true,
      data: {
        period, ...s,
        avgDuration, connectedRate,
        totalDurationFmt: fmtDuration(s.totalDuration),
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
    const { employeeId, callType, startDate, endDate, tlName } = req.query;
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
    const filename = `calls_${startDate ? startDate.slice(0, 10) : 'all'}_${endDate ? endDate.slice(0, 10) : 'now'}.csv`;

    try {
      job = await createPendingDownloadJob({ ownerId: req.user._id, label: 'Call Logs Export', filename });
    } catch {}

    // Resolve employee names/TLs via one lookup instead of populate() on the
    // cursor — populate() re-queries User per row as the cursor iterates,
    // which turns a 10k-row export into 10k extra round-trips.
    const employeeIds = await CallLog.distinct('employeeId', filter);
    const employees = await User.find({ _id: { $in: employeeIds } }, 'name tlName').lean();
    const employeeMap = new Map(employees.map((e) => [String(e._id), e]));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const header = 'Date,Time,Employee,Employee TL,Contact Name,Contact Number,Type,Call Status,Duration,Notes,Lead Linked,Synced\n';
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
    const { notes, callStatus, followUpDate } = req.body;
    const call = await CallLog.findById(req.params.id);
    if (!call) return res.status(404).json({ success: false, error: 'Call not found' });
    const isOwner = call.employeeId.toString() === req.user._id.toString();
    if (req.user.role !== 'manager' && !isOwner) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    if (notes      !== undefined) call.notes      = notes;
    if (callStatus !== undefined) call.callStatus = callStatus;
    await call.save();

    // Propagate callStatus/notes/followUpDate to linked lead's tracking fields
    // (follow-up dates live on Lead, not CallLog — see GET /pending-followups)
    if (call.leadId) {
      const leadUpdate = {};
      if (callStatus) leadUpdate.lastCallSummary = callStatus;
      if (notes && notes.trim()) leadUpdate.lastCallNote = notes.trim();
      if (followUpDate !== undefined) leadUpdate.followUpDate = followUpDate ? new Date(followUpDate) : null;
      if (Object.keys(leadUpdate).length) {
        await Lead.findByIdAndUpdate(call.leadId, { $set: leadUpdate }).catch(() => {});
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