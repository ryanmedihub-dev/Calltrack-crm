const express = require('express');
const router = express.Router();
const CallLog = require('../models/CallLog');
const Lead = require('../models/Lead');
const { protect, isManager } = require('../middleware/auth');
const getPusher = require('../lib/pusher');
const normalizePhone = require('../lib/normalizePhone');

function fmtDuration(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
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

// Aggregation-based period stats — no full doc loads
async function computePeriodStats(start, end) {
  const match = { timestamp: { $gte: start, $lt: end } };

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

    // Per-employee stats — lookup User for name
    CallLog.aggregate([
      { $match: match },
      { $group: {
        _id:   '$employeeId',
        count: { $sum: 1 },
        first: { $min: '$timestamp' },
        last:  { $max: '$timestamp' }
      }},
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
      { $addFields: { name: { $arrayElemAt: ['$userInfo.name', 0] } } },
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
      topDialers: [], activeEmployees: 0, avgDuration: 0
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

    const docs = calls.map((c) => ({
      contactNumber: normalizePhone(c.contactNumber) || c.contactNumber,
      contactName:   c.contactName,
      callType:      c.callType,
      duration:      c.duration,
      timestamp:     c.timestamp,
      notes:         c.notes,
      callStatus:    c.callStatus,
      employeeId:    req.user._id,
      synced:        true
    }));

    let inserted = [];
    try {
      inserted = await CallLog.insertMany(docs, { ordered: false });
    } catch (bulkErr) {
      if (bulkErr.code === 11000 || bulkErr.name === 'MongoBulkWriteError') {
        inserted = bulkErr.insertedDocs || [];
      } else {
        throw bulkErr;
      }
    }

    // For docs that already existed (skipped by insertMany), update enriched fields
    // (notes, callStatus) if the employee just added them.
    const insertedKeys = new Set(
      inserted.map((d) => `${d.contactNumber}_${Math.floor(new Date(d.timestamp).getTime() / 60000)}`)
    );
    for (const doc of docs) {
      if (!doc.notes && !doc.callStatus) continue;
      const docKey = `${doc.contactNumber}_${Math.floor(new Date(doc.timestamp).getTime() / 60000)}`;
      if (insertedKeys.has(docKey)) continue;
      const enrichedSet = {};
      if (doc.notes)      enrichedSet.notes      = doc.notes;
      if (doc.callStatus) enrichedSet.callStatus = doc.callStatus;
      if (!Object.keys(enrichedSet).length) continue;
      const ts = new Date(doc.timestamp).getTime();
      await CallLog.updateOne(
        {
          employeeId:    req.user._id,
          contactNumber: doc.contactNumber,
          timestamp:     { $gte: new Date(ts - 180000), $lte: new Date(ts + 180000) },
        },
        { $set: enrichedSet }
      ).catch(() => {});
    }

    // Auto-link to lead and update lead call stats / callLogs array
    const phoneToLead = {};
    const phones = inserted.map((l) => l.contactNumber).filter(Boolean);
    if (phones.length) {
      const leads = await Lead.find({ phone: { $in: phones } });
      leads.forEach((l) => { phoneToLead[l.phone] = l; });
    }

    for (const log of inserted) {
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
    const { employeeId, callType, startDate, endDate, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (employeeId) filter.employeeId = employeeId;
    if (callType) filter.callType = callType;
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
      CallLog.find(filter).populate('employeeId', 'name phone').sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit)).lean(),
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

// GET /api/calls/stats — full dashboard stats (today/yesterday/lastWeek)
router.get('/stats', protect, isManager, async (req, res) => {
  try {
    const { start: todayStart, end: todayEnd } = getISTDateBounds(0);
    const { start: ystStart,   end: ystEnd   } = getISTDateBounds(-1);
    const lw7Start = new Date(ystEnd); lw7Start.setDate(lw7Start.getDate() - 7);
    const lw7End   = new Date(ystEnd);

    const [todayStats, yesterdayStats, lastWeekStats] = await Promise.all([
      computePeriodStats(todayStart, todayEnd),
      computePeriodStats(ystStart, ystEnd),
      computePeriodStats(lw7Start, lw7End)
    ]);

    const fmtDate = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    lastWeekStats.period = `${fmtDate(lw7Start)} to ${fmtDate(new Date(lw7End.getTime() - 86400000))}`;

    return res.json({
      success: true,
      data: {
        today:     { ...todayStats,     date: fmtDate(todayStart) },
        yesterday: { ...yesterdayStats, date: fmtDate(ystStart) },
        lastWeek:  lastWeekStats,
        totalToday:     todayStats.totalCalls,
        missedToday:    todayStats.missed,
        incomingToday:  todayStats.incoming,
        outgoingToday:  todayStats.outgoing,
        rejectedToday:  todayStats.rejected,
        avgDuration:    todayStats.avgDuration,
        activeEmployees: todayStats.activeEmployees,
        topDialers:     todayStats.topDialers,
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
    const callsRaw = await CallLog.find().populate('employeeId', 'name phone').sort({ timestamp: -1 }).limit(50).lean();
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

// GET /api/calls/export — streaming CSV export (manager)
router.get('/export', protect, isManager, async (req, res) => {
  try {
    const { employeeId, callType, startDate, endDate } = req.query;
    const filter = {};
    if (employeeId) filter.employeeId = employeeId;
    if (callType)   filter.callType   = callType;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const ed = new Date(endDate); ed.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = ed;
      }
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="calls.csv"');
    res.write('Date,Time,Employee,Contact Name,Contact Number,Type,Duration (s),Notes\n');

    const cursor = CallLog.find(filter).populate('employeeId', 'name').sort({ timestamp: -1 }).lean().cursor();
    for await (const doc of cursor) {
      const d   = new Date(doc.timestamp);
      const esc = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
      res.write([
        d.toLocaleDateString('en-IN'),
        d.toLocaleTimeString('en-IN'),
        esc(doc.employeeId?.name),
        esc(doc.contactName),
        doc.contactNumber || '',
        doc.callType || '',
        doc.duration || 0,
        esc(doc.notes)
      ].join(',') + '\n');
    }

    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
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
    const { notes, callStatus } = req.body;
    const call = await CallLog.findById(req.params.id);
    if (!call) return res.status(404).json({ success: false, error: 'Call not found' });
    const isOwner = call.employeeId.toString() === req.user._id.toString();
    if (req.user.role !== 'manager' && !isOwner) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    if (notes      !== undefined) call.notes      = notes;
    if (callStatus !== undefined) call.callStatus = callStatus;
    await call.save();

    // Propagate callStatus/notes to linked lead's tracking fields
    if (call.leadId) {
      const leadUpdate = {};
      if (callStatus) leadUpdate.lastCallSummary = callStatus;
      if (notes && notes.trim()) leadUpdate.lastCallNote = notes.trim();
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
    const mongoose = require('mongoose');
    const [callsRaw, total, [agg]] = await Promise.all([
      CallLog.find(filter).populate('employeeId', 'name phone').sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit)).lean(),
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
