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

    // Calls per hour bucket
    CallLog.aggregate([
      { $match: match },
      { $group: { _id: { $hour: '$timestamp' }, count: { $sum: 1 } } }
    ]),

    // Per-employee: count + working-hours span + top dialers
    CallLog.aggregate([
      { $match: match },
      { $group: {
        _id:   '$employeeId',
        name:  { $first: '$employeeName' },
        count: { $sum: 1 },
        first: { $min: '$timestamp' },
        last:  { $max: '$timestamp' }
      }},
      { $sort: { count: -1 } }
    ]),

    // notPickupByClient: outgoing with 0 duration
    CallLog.aggregate([
      { $match: { ...match, callType: 'outgoing', $or: [{ duration: 0 }, { duration: null }, { duration: { $exists: false } }] } },
      { $count: 'count' }
    ]),

    // neverAttended: missed contacts that have no outgoing call in same period
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

// POST /api/calls/sync — employee sends batch of call logs
router.post('/sync', protect, async (req, res) => {
  try {
    const { calls } = req.body;
    if (!Array.isArray(calls) || calls.length === 0) {
      return res.status(400).json({ success: false, error: 'calls array required' });
    }

    // Capture follow-up dates from raw payload before schema strips unknown fields
    const followUpMap = {};
    calls.forEach((c) => {
      if (c.followUpDate && c.contactNumber) {
        followUpMap[normalizePhone(c.contactNumber) || c.contactNumber] = c.followUpDate;
      }
    });

    const docs = calls.map((c) => ({
      ...c,
      contactNumber: normalizePhone(c.contactNumber) || c.contactNumber,
      employeeId:    req.user._id,
      employeeName:  req.user.name,
      employeePhone: req.user.phone || '',
      deviceId:      req.user.deviceId || c.deviceId || '',
      synced:        true
    }));

    // ordered:false lets all non-duplicate docs insert; catch duplicate-key errors
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

    // For docs that already existed (skipped by insertMany), update their
    // enriched fields (notes, callStatus, callTags) if the employee just added them.
    const insertedKeys = new Set(
      inserted.map((d) => `${d.contactNumber}_${Math.floor(new Date(d.timestamp).getTime() / 60000)}`)
    );
    for (const doc of docs) {
      if (!doc.notes && !doc.callStatus && (!doc.callTags || !doc.callTags.length)) continue;
      const docKey = `${doc.contactNumber}_${Math.floor(new Date(doc.timestamp).getTime() / 60000)}`;
      if (insertedKeys.has(docKey)) continue; // newly inserted — already has enriched data
      const enrichedSet = {};
      if (doc.notes)                       enrichedSet.notes       = doc.notes;
      if (doc.callStatus)                  enrichedSet.callStatus  = doc.callStatus;
      if (doc.callTags && doc.callTags.length) enrichedSet.callTags = doc.callTags;
      if (!Object.keys(enrichedSet).length) continue;
      const ts = new Date(doc.timestamp).getTime();
      await CallLog.updateOne(
        {
          employeeId:    req.user._id,
          contactNumber: doc.contactNumber,
          timestamp:     { $gte: new Date(ts - 90000), $lte: new Date(ts + 90000) },
        },
        { $set: enrichedSet }
      ).catch(() => {});
    }

    // Auto-link to lead if phone number matches and update lead call stats
    const phoneToLead = {};
    const phones = inserted.map((l) => l.contactNumber).filter(Boolean);
    if (phones.length) {
      const leads = await Lead.find({ phone: { $in: phones } });
      leads.forEach((l) => { phoneToLead[l.phone] = l; });
    }

    for (const log of inserted) {
      const lead = phoneToLead[log.contactNumber];

      if (lead) {
        // ── Existing lead: update call stats + push note if present ──────
        await CallLog.findByIdAndUpdate(log._id, { leadId: lead._id });

        const updateData = {
          $inc: { attempts: 1 },
          $set: {
            lastCallAt:            log.timestamp,
            lastCallType:          log.callType,
            lastCallDuration:      log.duration || 0,
            lastCallEmployee:      log.employeeName,
            lastCallEmployeePhone: log.employeePhone,
          }
        };

        if ((log.duration || 0) > 0) updateData.$inc.connectedCallCount = 1;

        // Follow-up date
        const fuDate = followUpMap[log.contactNumber];
        if (fuDate) updateData.$set.followUpDate = new Date(fuDate);

        // Push note to lead's notes array if employee added one
        if (log.notes && log.notes.trim()) {
          updateData.$push = {
            notes: {
              text:    log.notes.trim(),
              addedBy: log.employeeId,
              addedAt: new Date(log.timestamp)
            }
          };
        }

        // Sync callStatus to lastCallSummary field for quick reference
        if (log.callStatus) updateData.$set.lastCallSummary = log.callStatus;

        await Lead.findByIdAndUpdate(lead._id, updateData);

      } else {
        // ── New number: auto-create lead ──────────────────────────────────
        const isConnected = (log.duration || 0) > 0;

        // Only auto-create if connected call or employee explicitly added input
        const hasEmployeeInput = !!(log.notes?.trim() || log.callStatus || (log.callTags && log.callTags.length));

        if (isConnected || hasEmployeeInput) {
          try {
            const fuDate = followUpMap[log.contactNumber];
            const initialNotes = (log.notes && log.notes.trim())
              ? [{ text: log.notes.trim(), addedBy: log.employeeId, addedAt: new Date(log.timestamp) }]
              : [];

            const newLead = await Lead.create({
              name:                  log.contactName && log.contactName !== 'Unknown'
                                       ? log.contactName
                                       : log.contactNumber,
              phone:                 log.contactNumber,
              status:                'new',
              source:                'Call',
              capturedBy:            log.employeeName,
              assignedTo:            log.employeeId,
              attempts:              1,
              lastCallAt:            log.timestamp,
              lastCallType:          log.callType,
              lastCallDuration:      log.duration || 0,
              lastCallEmployee:      log.employeeName,
              lastCallEmployeePhone: log.employeePhone,
              lastCallSummary:       log.callStatus || null,
              connectedCallCount:    isConnected ? 1 : 0,
              followUpDate:          fuDate ? new Date(fuDate) : null,
              notes:                 initialNotes,
            });

            await CallLog.findByIdAndUpdate(log._id, { leadId: newLead._id });

          } catch (leadErr) {
            // Duplicate phone (race condition) — silently skip
            if (leadErr.code !== 11000) {
              console.error('Auto lead create error:', leadErr.message);
            }
          }
        }
      }
    }

    const pusher = getPusher();
    if (pusher && inserted.length) {
      const events = inserted.map((log) => ({
        channel: 'managers',
        name: 'new_call_log',
        data: {
          _id:          log._id.toString(),
          employeeId:   log.employeeId.toString(),
          employeeName: log.employeeName,
          callType:     log.callType,
          duration:     log.duration,
          timestamp:    log.timestamp,
          contactNumber: log.contactNumber,
          contactName:  log.contactName,
          hasLead:      !!phoneToLead[log.contactNumber]
        }
      }));
      // Pusher batch limit is 10 events per call
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
        { employeeName:  { $regex: search, $options: 'i' } }
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [calls, total] = await Promise.all([
      CallLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit)),
      CallLog.countDocuments(filter)
    ]);
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
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);
    const ystStart   = new Date(todayStart); ystStart.setDate(ystStart.getDate() - 1);
    const ystEnd     = new Date(todayStart);
    const lw7Start   = new Date(ystEnd); lw7Start.setDate(lw7Start.getDate() - 7);
    const lw7End     = new Date(ystEnd);

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
        // legacy fields
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
    const calls = await CallLog.find().sort({ timestamp: -1 }).limit(50);
    return res.json({ success: true, data: calls });
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
    res.write('Date,Time,Employee,Employee Phone,Contact Name,Contact Number,Type,Duration (s),Notes\n');

    const cursor = CallLog.find(filter).sort({ timestamp: -1 }).lean().cursor();
    for await (const doc of cursor) {
      const d   = new Date(doc.timestamp);
      const esc = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
      res.write([
        d.toLocaleDateString('en-IN'),
        d.toLocaleTimeString('en-IN'),
        esc(doc.employeeName),
        doc.employeePhone || '',
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

// PATCH /api/calls/:id/notes — add notes, tags, status to a call log
router.patch('/:id/notes', protect, async (req, res) => {
  try {
    const { notes, callTags, callStatus } = req.body;
    const call = await CallLog.findById(req.params.id);
    if (!call) return res.status(404).json({ success: false, error: 'Call not found' });
    const isOwner = call.employeeId.toString() === req.user._id.toString();
    if (req.user.role !== 'manager' && !isOwner) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    if (notes     !== undefined) call.notes      = notes;
    if (callTags  !== undefined) call.callTags   = callTags;
    if (callStatus !== undefined) call.callStatus = callStatus;
    await call.save();
    return res.json({ success: true, data: call });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/calls/:id — employee can delete own call, manager can delete any
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
    const [calls, total, [agg]] = await Promise.all([
      CallLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit)),
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

// DELETE /api/calls/:id — manager only
router.delete('/:id', protect, isManager, async (req, res) => {
  try {
    const call = await CallLog.findByIdAndDelete(req.params.id);
    if (!call) return res.status(404).json({ success: false, error: 'Call not found' });
    return res.json({ success: true, message: 'Call deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
