const express = require('express');
const router = express.Router();
const CallLog = require('../models/CallLog');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { protect, isManager } = require('../middleware/auth');
const { resolveEmployeeIdsForTL } = require('../lib/tlFilter');
const { createPendingDownloadJob, completeDownloadJob, failDownloadJob } = require('../lib/downloadJobs');
const fmtDuration = require('../lib/formatDuration');

// Parses a 'YYYY-MM-DD' IST calendar-date string (as sent by the dashboard's
// date-range filters) into the UTC instant of that day's IST start/end — using
// the server's local time here (as the old `new Date(str); setHours(...)` code
// did) would shift the boundary by up to 5.5h wherever the server isn't IST,
// causing report totals to disagree with the /calls/stats and /leads counts
// that deep-linked dashboard/overview cards promise to match.
function istDateStrStart(dateStr) {
  return new Date(`${dateStr}T00:00:00+05:30`);
}
function istDateStrEnd(dateStr) {
  return new Date(istDateStrStart(dateStr).getTime() + 24 * 60 * 60 * 1000 - 1);
}

function istDayStart(offsetDays = 0) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  nowIST.setUTCHours(0, 0, 0, 0);
  nowIST.setUTCDate(nowIST.getUTCDate() + offsetDays);
  return new Date(nowIST.getTime() - IST_OFFSET_MS);
}

// Helper: get employee display name from a populated call doc
function empName(c)  { return c.employeeId?.name  || 'Unknown'; }
function empPhone(c) { return c.employeeId?.phone || ''; }
function empTL(c)    { return c.employeeId?.tlName || ''; }

// IST-aware bucketing helpers (server runs in UTC on most hosts — never use
// Date#getHours()/#toLocaleDateString() without timeZone, it silently
// buckets calls into the wrong day/hour once deployed).
function istHourOf(ts) {
  return parseInt(
    new Date(ts).toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }),
    10
  );
}
function istDayKey(ts) {
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}
function istDayLabel(ts) {
  return new Date(ts).toLocaleDateString('en-GB', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: '2-digit', month: 'short', year: 'numeric'
  });
}
function hourSlotLabel(h) {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:00 – ${String(h12).padStart(2, '0')}:59 ${ampm}`;
}
// Mongo-level filters so callHistory's separate paginated query (which never
// loads the full call list into memory) stays consistent with the other tabs.
function applyDurationFilter(filter, duration) {
  if (duration === '0-60') filter.duration = { $gte: 0, $lt: 60 };
  else if (duration === '60-300') filter.duration = { $gte: 60, $lt: 300 };
  else if (duration === '300+') filter.duration = { $gte: 300 };
}
function applyCallTimeFilter(filter, callTime) {
  const ranges = { morning: [6, 12], afternoon: [12, 18], evening: [18, 24] };
  const r = ranges[callTime];
  if (!r) return;
  const hourExpr = { $hour: { date: '$timestamp', timezone: 'Asia/Kolkata' } };
  filter.$expr = { $and: [{ $gte: [hourExpr, r[0]] }, { $lt: [hourExpr, r[1]] }] };
}

// GET /api/reports/periodic — full periodic report
router.get('/periodic', protect, isManager, async (req, res) => {
  try {
    const {
      startDate, endDate, employeeId, callType, duration, callTime, tlName,
      tab = 'summary', page = 1, limit = 100
    } = req.query;

    const start = startDate ? istDateStrStart(startDate) : istDayStart(0);
    const end = endDate ? istDateStrEnd(endDate) : new Date();

    const filter = { timestamp: { $gte: start, $lte: end } };
    if (employeeId) filter.employeeId = employeeId;
    else if (tlName) filter.employeeId = { $in: await resolveEmployeeIdsForTL(tlName) };
    if (callType) filter.callType = callType;
    applyDurationFilter(filter, duration);
    applyCallTimeFilter(filter, callTime);

    // Only the fields actually read below (notes/callStatus/leadId/synced are
    // never used by this route) — cuts payload/memory for wide date ranges.
    const calls = await CallLog.find(filter)
      .select('employeeId callType contactNumber contactName duration timestamp')
      .populate('employeeId', 'name phone tlName')
      .sort({ timestamp: -1, _id: -1 })
      .lean();

    const byType = { incoming: [], outgoing: [], missed: [], rejected: [] };
    calls.forEach((c) => { if (byType[c.callType]) byType[c.callType].push(c); });

    const totalDuration = calls.reduce((s, c) => s + (c.duration || 0), 0);
    const incomingDuration = byType.incoming.reduce((s, c) => s + (c.duration || 0), 0);
    const outgoingDuration = byType.outgoing.reduce((s, c) => s + (c.duration || 0), 0);
    const connectedCalls = calls.filter((c) => (c.duration || 0) > 0).length;
    const notPickupByClientCalls = byType.outgoing.filter((c) => !c.duration || c.duration === 0);
    const missedNums = new Set(byType.missed.map((c) => c.contactNumber));
    const outgoingNums = new Set(byType.outgoing.map((c) => c.contactNumber));
    const neverAttendedNums = [...missedNums].filter((n) => !outgoingNums.has(n));
    const uniqueClientsSet = new Set(calls.map((c) => c.contactNumber));

    // Employee summary map
    const empSummary = {};
    calls.forEach((c) => {
      const id = c.employeeId?._id?.toString() || c.employeeId?.toString();
      if (!id) return;
      if (!empSummary[id]) empSummary[id] = {
        employeeId: id, employeeName: empName(c), tlName: empTL(c),
        totalCalls: 0, totalDuration: 0,
        incoming: 0, incomingConnected: 0, incomingDuration: 0,
        outgoing: 0, outgoingConnected: 0, outgoingDuration: 0,
        missed: 0, rejected: 0, neverAttended: 0, notPickupByClient: 0,
        connectedCalls: 0, lastSyncTime: c.timestamp, uniqueContacts: new Set()
      };
      const e = empSummary[id];
      e.totalCalls++;
      e.totalDuration += c.duration || 0;
      e.uniqueContacts.add(c.contactNumber);
      if ((c.duration || 0) > 0) e.connectedCalls++;
      if (c.callType === 'incoming') {
        e.incoming++;
        e.incomingDuration += c.duration || 0;
        if ((c.duration || 0) > 0) e.incomingConnected++;
      } else if (c.callType === 'outgoing') {
        e.outgoing++;
        e.outgoingDuration += c.duration || 0;
        if ((c.duration || 0) > 0) e.outgoingConnected++;
        else e.notPickupByClient++;
      } else if (c.callType === 'missed') {
        e.missed++;
      } else if (c.callType === 'rejected') {
        e.rejected++;
      }
      if (new Date(c.timestamp) > new Date(e.lastSyncTime)) e.lastSyncTime = c.timestamp;
    });

    const empMissedNums = {};
    const empOutgoingNums = {};
    byType.missed.forEach((c) => {
      const id = c.employeeId?._id?.toString() || c.employeeId?.toString();
      if (!id) return;
      if (!empMissedNums[id]) empMissedNums[id] = new Set();
      empMissedNums[id].add(c.contactNumber);
    });
    byType.outgoing.forEach((c) => {
      const id = c.employeeId?._id?.toString() || c.employeeId?.toString();
      if (!id) return;
      if (!empOutgoingNums[id]) empOutgoingNums[id] = new Set();
      empOutgoingNums[id].add(c.contactNumber);
    });
    for (const id of Object.keys(empSummary)) {
      const mn = empMissedNums[id] || new Set();
      const on = empOutgoingNums[id] || new Set();
      let na = 0;
      for (const n of mn) { if (!on.has(n)) na++; }
      empSummary[id].neverAttended = na;
    }

    const employeeSummaryList = Object.values(empSummary)
      .map((e) => {
        const { uniqueContacts, ...rest } = e;
        return {
          ...rest,
          uniqueClients:    uniqueContacts.size,
          totalDurationSec: e.totalDuration,
          totalDuration:    fmtDuration(e.totalDuration),
          incomingDuration: fmtDuration(e.incomingDuration),
          outgoingDuration: fmtDuration(e.outgoingDuration)
        };
      })
      .sort((a, b) => b.totalCalls - a.totalCalls);

    if (tab === 'summary') {
      return res.json({
        success: true,
        data: {
          dateLabel: start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
            (startDate !== endDate ? ' to ' + end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''),
          summary: {
            incoming: { calls: byType.incoming.length, duration: fmtDuration(incomingDuration) },
            outgoing: { calls: byType.outgoing.length, duration: fmtDuration(outgoingDuration) },
            missed:   { calls: byType.missed.length,   duration: '—' },
            rejected: { calls: byType.rejected.length, duration: '—' },
            total:    { calls: calls.length, duration: fmtDuration(totalDuration) }
          },
          sidebarStats: {
            neverAttended: neverAttendedNums.length,
            notPickupByClient: notPickupByClientCalls.length,
            connectedCalls,
            uniqueConnectedCalls: new Set(calls.filter(c => (c.duration||0) > 0).map(c => c.contactNumber)).size,
            uniqueClients: uniqueClientsSet.size,
            workingHours: fmtDuration(totalDuration)
          },
          pieData: [
            { name: 'Incoming', value: byType.incoming.length, color: '#34C759' },
            { name: 'Outgoing', value: byType.outgoing.length, color: '#FF9500' },
            { name: 'Missed',   value: byType.missed.length,   color: '#FF3B30' },
            { name: 'Rejected', value: byType.rejected.length, color: '#7C3AED' }
          ].filter(d => d.value > 0),
          employeeSummary: employeeSummaryList
        }
      });
    }

    if (tab === 'daywise') {
      const dayMap = {};
      calls.forEach((c) => {
        const key = istDayKey(c.timestamp);
        if (!dayMap[key]) dayMap[key] = {
          date: key, label: istDayLabel(c.timestamp),
          totalCalls: 0, connected: 0, incoming: 0, outgoing: 0, missed: 0, rejected: 0, duration: 0
        };
        dayMap[key].totalCalls++;
        dayMap[key].duration += c.duration || 0;
        if ((c.duration || 0) > 0) dayMap[key].connected++;
        if (byType[c.callType]) dayMap[key][c.callType]++;
      });
      const daywise = Object.values(dayMap)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(d => ({ ...d, duration: fmtDuration(d.duration) }));
      return res.json({ success: true, data: { daywise } });
    }

    if (tab === 'hourly') {
      const hourly = Array.from({ length: 24 }, (_, h) => ({
        hour: h, label: hourSlotLabel(h),
        totalCalls: 0, connected: 0, incoming: 0, outgoing: 0, missed: 0, rejected: 0, duration: 0
      }));
      calls.forEach((c) => {
        const h = istHourOf(c.timestamp);
        hourly[h].totalCalls++;
        hourly[h].duration += c.duration || 0;
        if ((c.duration || 0) > 0) hourly[h].connected++;
        if (hourly[h][c.callType] !== undefined) hourly[h][c.callType]++;
      });
      const totalAll = calls.length || 1;
      return res.json({
        success: true,
        data: {
          hourly: hourly.map(h => ({
            ...h,
            duration: fmtDuration(h.duration),
            pct: Number(((h.totalCalls / totalAll) * 100).toFixed(2))
          }))
        }
      });
    }

    if (tab === 'analysis') {
      const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: hourSlotLabel(h), totalCalls: 0, connected: 0 }));
      calls.forEach((c) => {
        const h = istHourOf(c.timestamp);
        hourly[h].totalCalls++;
        if ((c.duration || 0) > 0) hourly[h].connected++;
      });

      let topDialer = null, topReceiver = null, topOverall = null, mostDuration = null;
      Object.values(empSummary).forEach((e) => {
        if (!topDialer || e.outgoing > topDialer.count) topDialer = { employeeName: e.employeeName, count: e.outgoing };
        if (!topReceiver || e.incoming > topReceiver.count) topReceiver = { employeeName: e.employeeName, count: e.incoming };
        if (!topOverall || e.totalCalls > topOverall.count) topOverall = { employeeName: e.employeeName, count: e.totalCalls };
        if (!mostDuration || e.totalDuration > mostDuration.durationSec) mostDuration = { employeeName: e.employeeName, durationSec: e.totalDuration };
      });
      if (mostDuration) mostDuration = { employeeName: mostDuration.employeeName, duration: fmtDuration(mostDuration.durationSec) };

      let longestCall = null;
      calls.forEach((c) => {
        if ((c.duration || 0) > (longestCall?.durationSec || 0)) {
          longestCall = {
            durationSec: c.duration || 0, duration: fmtDuration(c.duration || 0),
            callType: c.callType, contactNumber: c.contactNumber, contactName: c.contactName || 'Unknown',
            employeeName: empName(c), timestamp: c.timestamp
          };
        }
      });

      const incomingDurTotal = byType.incoming.reduce((s, c) => s + (c.duration || 0), 0);
      const incomingConnCount = byType.incoming.filter((c) => (c.duration || 0) > 0).length;
      const outgoingDurTotal = byType.outgoing.reduce((s, c) => s + (c.duration || 0), 0);
      const outgoingConnCount = byType.outgoing.filter((c) => (c.duration || 0) > 0).length;
      const dayCount = new Set(calls.map((c) => istDayKey(c.timestamp))).size || 1;

      return res.json({
        success: true,
        data: {
          hourly, topDialer, topReceiver, topOverall, mostDuration, longestCall,
          avgIncomingDuration: fmtDuration(incomingConnCount ? Math.round(incomingDurTotal / incomingConnCount) : 0),
          avgOutgoingDuration: fmtDuration(outgoingConnCount ? Math.round(outgoingDurTotal / outgoingConnCount) : 0),
          avgPerDay: fmtDuration(Math.round(totalDuration / dayCount)),
          dayCount
        }
      });
    }

    if (tab === 'neverAttended') {
      const numMap = {};
      byType.missed.forEach((c) => {
        if (!numMap[c.contactNumber]) numMap[c.contactNumber] = {
          contactNumber: c.contactNumber, contactName: c.contactName || 'Unknown',
          missedCount: 0, lastMissedAt: c.timestamp, employees: new Set()
        };
        numMap[c.contactNumber].missedCount++;
        numMap[c.contactNumber].employees.add(empName(c));
        if (new Date(c.timestamp) > new Date(numMap[c.contactNumber].lastMissedAt)) {
          numMap[c.contactNumber].lastMissedAt = c.timestamp;
        }
      });
      const result = Object.values(numMap)
        .filter((n) => !outgoingNums.has(n.contactNumber))
        .map((n) => ({ ...n, employees: [...n.employees] }));
      const pageNum = parseInt(page), pageSize = parseInt(limit);
      return res.json({
        success: true,
        data: {
          total: result.length,
          records: result.slice((pageNum - 1) * pageSize, pageNum * pageSize),
          pages: Math.ceil(result.length / pageSize)
        }
      });
    }

    if (tab === 'notPickupByClient') {
      const pageNum = parseInt(page), pageSize = parseInt(limit);
      const records = notPickupByClientCalls.map((c) => ({
        _id: c._id, contactNumber: c.contactNumber, contactName: c.contactName || 'Unknown',
        employeeName: empName(c), timestamp: c.timestamp, callType: c.callType
      }));
      return res.json({
        success: true,
        data: {
          total: records.length,
          records: records.slice((pageNum - 1) * pageSize, pageNum * pageSize),
          pages: Math.ceil(records.length / pageSize)
        }
      });
    }

    if (tab === 'uniqueClients') {
      const clientMap = {};
      calls.forEach((c) => {
        if (!clientMap[c.contactNumber]) {
          clientMap[c.contactNumber] = {
            contactNumber: c.contactNumber, contactName: c.contactName || 'Unknown',
            totalCalls: 0, connectedCalls: 0, incoming: 0, outgoing: 0, missed: 0,
            totalDuration: 0, lastCallAt: c.timestamp, employees: new Set()
          };
        }
        const cl = clientMap[c.contactNumber];
        cl.totalCalls++;
        cl.totalDuration += c.duration || 0;
        if ((c.duration || 0) > 0) cl.connectedCalls++;
        if (cl[c.callType] !== undefined) cl[c.callType]++;
        cl.employees.add(empName(c));
        if (new Date(c.timestamp) > new Date(cl.lastCallAt)) cl.lastCallAt = c.timestamp;
      });
      const records = Object.values(clientMap).map((c) => ({
        ...c, employees: [...c.employees], totalDuration: fmtDuration(c.totalDuration)
      }));
      const pageNum = parseInt(page), pageSize = parseInt(limit);
      return res.json({
        success: true,
        data: {
          total: records.length,
          records: records.slice((pageNum - 1) * pageSize, pageNum * pageSize),
          pages: Math.ceil(records.length / pageSize)
        }
      });
    }

    if (tab === 'callHistory') {
      const pageNum = parseInt(page), pageSize = parseInt(limit);
      const total = await CallLog.countDocuments(filter);
      const historyCalls = await CallLog.find(filter)
        .populate('employeeId', 'name phone tlName')
        .sort({ timestamp: -1, _id: -1 })
        .skip((pageNum - 1) * pageSize)
        .limit(pageSize)
        .lean();

      // Global first-ever-contact check for the visible page only (cheap —
      // one page's worth of numbers), mirrors the New/Repeat export column.
      const numbers = [...new Set(historyCalls.map((c) => c.contactNumber).filter(Boolean))];
      const firstSeenAgg = numbers.length
        ? await CallLog.aggregate([
            { $match: { contactNumber: { $in: numbers } } },
            { $group: { _id: '$contactNumber', first: { $min: '$timestamp' } } }
          ])
        : [];
      const firstSeenMap = new Map(firstSeenAgg.map((r) => [r._id, new Date(r.first).getTime()]));

      return res.json({
        success: true,
        data: {
          total,
          calls: historyCalls.map(c => ({
            ...c,
            employeeName: empName(c),
            employeePhone: empPhone(c),
            employeeTL: empTL(c),
            contactType: firstSeenMap.get(c.contactNumber) === new Date(c.timestamp).getTime() ? 'New' : 'Repeat'
          })),
          pages: Math.ceil(total / pageSize),
          page: pageNum
        }
      });
    }

    return res.json({
      success: true,
      data: {
        employeeSummary: employeeSummaryList,
        dateLabel: start.toLocaleDateString('en-GB')
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Lead status keys/labels — mirrors dashboard/src/app/(protected)/reports/lead/page.js STATUS_META
const LEAD_STATUS_LABELS = {
  new:            'New',
  contacted:      'Contacted',
  not_connected:  'Not Connected',
  interested:     'Interested',
  not_interested: 'Not Interested',
  follow_up:      'Follow-up',
  booking_done:   'Booking Done',
  converted:      'Converted',
  lost:           'Lost'
};
const LEAD_STATUS_KEYS = Object.keys(LEAD_STATUS_LABELS);

function applyLeadTimeFilter(filter, leadTime) {
  const ranges = { morning: [6, 12], afternoon: [12, 18], evening: [18, 24] };
  const r = ranges[leadTime];
  if (!r) return;
  const hourExpr = { $hour: { date: '$createdAt', timezone: 'Asia/Kolkata' } };
  filter.$expr = { $and: [{ $gte: [hourExpr, r[0]] }, { $lt: [hourExpr, r[1]] }] };
}
function round1(n) { return Math.round(n * 10) / 10; }

// GET /api/reports/leads-periodic — leads report (Lead Reports page)
router.get('/leads-periodic', protect, isManager, async (req, res) => {
  try {
    const {
      startDate, endDate, employeeId, status, source, leadTime, tlName,
      tab = 'summary', page = 1, limit = 500
    } = req.query;

    const filter = {};
    if (startDate) {
      filter.createdAt = { ...(filter.createdAt || {}), $gte: istDateStrStart(startDate) };
    }
    if (endDate) {
      filter.createdAt = { ...(filter.createdAt || {}), $lte: istDateStrEnd(endDate) };
    }
    if (employeeId) filter.assignedTo = employeeId;
    else if (tlName) filter.assignedTo = { $in: await resolveEmployeeIdsForTL(tlName) };
    if (status) filter.status = status;
    if (source) filter.source = { $regex: source, $options: 'i' };
    applyLeadTimeFilter(filter, leadTime);

    const leads = await Lead.find(filter)
      .populate('assignedTo', 'name tlName')
      .sort({ createdAt: -1 })
      .lean();

    const dateLabel = startDate
      ? new Date(startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
        (endDate && endDate !== startDate
          ? ' to ' + new Date(endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : '')
      : 'All Leads';

    const empNameOf = (l) => l.assignedTo?.name || 'Unassigned';
    const empTLOf = (l) => l.assignedTo?.tlName || '';
    const pageNum = parseInt(page), pageSize = parseInt(limit);

    if (tab === 'summary') {
      const byStatus = {};
      LEAD_STATUS_KEYS.forEach((k) => { byStatus[k] = leads.filter((l) => l.status === k); });

      const summary = {};
      LEAD_STATUS_KEYS.forEach((k) => {
        const arr = byStatus[k];
        const attemptsSum = arr.reduce((s, l) => s + (l.attempts || 0), 0);
        summary[k] = { leads: arr.length, avgAttempts: arr.length ? round1(attemptsSum / arr.length) : 0 };
      });
      const totalAttempts = leads.reduce((s, l) => s + (l.attempts || 0), 0);
      summary.total = { leads: leads.length, avgAttempts: leads.length ? round1(totalAttempts / leads.length) : 0 };

      const pieData = LEAD_STATUS_KEYS
        .map((k) => ({ key: k, name: LEAD_STATUS_LABELS[k], value: byStatus[k].length }))
        .filter((d) => d.value > 0);

      const now = new Date();
      const sidebarStats = {
        uncontacted:    leads.filter((l) => !(l.attempts > 0)).length,
        notConnected:   byStatus.not_connected.length,
        contacted:      leads.filter((l) => l.attempts > 0).length,
        converted:      byStatus.converted.length,
        uniqueSources:  new Set(leads.map((l) => l.source).filter(Boolean)).size,
        followUpsDue:   leads.filter((l) => l.status === 'follow_up' && l.followUpDate && new Date(l.followUpDate) <= now).length
      };

      const empMap = {};
      leads.forEach((l) => {
        const id = l.assignedTo?._id?.toString() || 'unassigned';
        if (!empMap[id]) empMap[id] = {
          employeeName: empNameOf(l), tlName: empTLOf(l), total: 0, new: 0, contacted: 0,
          follow_up: 0, converted: 0, lost: 0, attemptsSum: 0
        };
        const e = empMap[id];
        e.total++;
        if (l.status === 'new') e.new++;
        if (l.status === 'contacted') e.contacted++;
        if (l.status === 'follow_up') e.follow_up++;
        if (l.status === 'converted') e.converted++;
        if (l.status === 'lost') e.lost++;
        e.attemptsSum += l.attempts || 0;
      });
      const employeeSummary = Object.values(empMap)
        .map((e) => ({
          ...e,
          conversionRate: e.total ? Math.round((e.converted / e.total) * 100) : 0,
          avgAttempts: e.total ? round1(e.attemptsSum / e.total) : 0
        }))
        .sort((a, b) => b.total - a.total);
      employeeSummary.forEach((e) => delete e.attemptsSum);

      return res.json({ success: true, data: { dateLabel, summary, pieData, sidebarStats, employeeSummary } });
    }

    if (tab === 'analysis') {
      const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: hourSlotLabel(h), total: 0, contacted: 0 }));
      leads.forEach((l) => {
        const h = istHourOf(l.createdAt);
        hourly[h].total++;
        if (l.attempts > 0) hourly[h].contacted++;
      });

      const empMap = {};
      leads.forEach((l) => {
        const id = l.assignedTo?._id?.toString() || 'unassigned';
        if (!empMap[id]) empMap[id] = { employeeName: empNameOf(l), total: 0, converted: 0, attemptsSum: 0 };
        empMap[id].total++;
        if (l.status === 'converted') empMap[id].converted++;
        empMap[id].attemptsSum += l.attempts || 0;
      });
      const empList = Object.values(empMap);

      let topAssignee = null, topConverter = null, topOverall = null, mostAttempts = null;
      empList.forEach((e) => {
        if (!topAssignee || e.total > topAssignee.count) topAssignee = { employeeName: e.employeeName, count: e.total };
        if (!topConverter || e.converted > topConverter.count) topConverter = { employeeName: e.employeeName, count: e.converted };
        if (!topOverall || e.attemptsSum > topOverall.count) topOverall = { employeeName: e.employeeName, count: e.attemptsSum };
        if (!mostAttempts || e.attemptsSum > mostAttempts.count) mostAttempts = { employeeName: e.employeeName, count: e.attemptsSum };
      });

      let mostAttemptedLead = null;
      leads.forEach((l) => {
        if (!mostAttemptedLead || (l.attempts || 0) > mostAttemptedLead.attempts) {
          mostAttemptedLead = { name: l.name, phone: l.phone, attempts: l.attempts || 0, status: l.status };
        }
      });

      const total = leads.length;
      const convertedCount = leads.filter((l) => l.status === 'converted').length;
      const attemptsSumAll = leads.reduce((s, l) => s + (l.attempts || 0), 0);
      const convertedAttemptsSum = leads.filter((l) => l.status === 'converted').reduce((s, l) => s + (l.attempts || 0), 0);
      const dayCount = new Set(leads.map((l) => istDayKey(l.createdAt))).size || 1;

      return res.json({
        success: true,
        data: {
          dateLabel, hourly, topAssignee, topConverter, topOverall, mostAttempts, mostAttemptedLead,
          conversionRate: total ? Math.round((convertedCount / total) * 100) : 0,
          avgAttemptsPerLead: total ? round1(attemptsSumAll / total) : 0,
          avgAttemptsPerConverted: convertedCount ? round1(convertedAttemptsSum / convertedCount) : 0,
          avgLeadsPerDay: round1(total / dayCount),
          dayCount
        }
      });
    }

    if (tab === 'dayWise') {
      const dayMap = {};
      leads.forEach((l) => {
        const key = istDayKey(l.createdAt);
        if (!dayMap[key]) dayMap[key] = { date: key, label: istDayLabel(l.createdAt), total: 0, converted: 0 };
        dayMap[key].total++;
        if (l.status === 'converted') dayMap[key].converted++;
      });
      const daywise = Object.values(dayMap)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((d) => ({ ...d, conversionRate: d.total ? Math.round((d.converted / d.total) * 100) : 0 }));
      return res.json({ success: true, data: { dateLabel, daywise } });
    }

    if (tab === 'hourly') {
      const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: hourSlotLabel(h), total: 0, contacted: 0, converted: 0 }));
      leads.forEach((l) => {
        const h = istHourOf(l.createdAt);
        hourly[h].total++;
        if (l.attempts > 0) hourly[h].contacted++;
        if (l.status === 'converted') hourly[h].converted++;
      });
      const totalAll = leads.length || 1;
      return res.json({
        success: true,
        data: { dateLabel, hourly: hourly.map((h) => ({ ...h, pct: Number(((h.total / totalAll) * 100).toFixed(2)) })) }
      });
    }

    if (tab === 'uncontacted') {
      const uncontacted = leads
        .filter((l) => !(l.attempts > 0))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const records = uncontacted.slice(0, pageSize).map((l) => ({
        _id: l._id, name: l.name, phone: l.phone, source: l.source || '—',
        employeeName: empNameOf(l), createdAt: l.createdAt,
        daysSince: Math.max(0, Math.floor((Date.now() - new Date(l.createdAt).getTime()) / 86400000))
      }));
      return res.json({ success: true, data: { dateLabel, total: uncontacted.length, records } });
    }

    if (tab === 'notConnected') {
      const notConnected = leads.filter((l) => l.status === 'not_connected');
      const records = notConnected.slice(0, pageSize).map((l) => ({
        _id: l._id, employeeName: empNameOf(l), name: l.name, phone: l.phone,
        status: l.status, attempts: l.attempts || 0, lastCallAt: l.lastCallAt || null
      }));
      return res.json({ success: true, data: { dateLabel, total: notConnected.length, records } });
    }

    if (tab === 'sources') {
      const sourceMap = {};
      leads.forEach((l) => {
        const src = l.source || 'Unknown';
        if (!sourceMap[src]) sourceMap[src] = { source: src, total: 0, converted: 0, lost: 0 };
        sourceMap[src].total++;
        if (l.status === 'converted') sourceMap[src].converted++;
        if (l.status === 'lost') sourceMap[src].lost++;
      });
      const records = Object.values(sourceMap)
        .map((s) => ({ ...s, conversionRate: s.total ? Math.round((s.converted / s.total) * 100) : 0 }))
        .sort((a, b) => b.total - a.total);
      return res.json({ success: true, data: { dateLabel, total: records.length, records } });
    }

    if (tab === 'leadList') {
      const leadsList = leads.slice(0, pageSize).map((l) => ({
        _id: l._id, employeeName: empNameOf(l), tlName: empTLOf(l), phone: l.phone, name: l.name,
        status: l.status, source: l.source || '—', attempts: l.attempts || 0,
        followUpDate: l.followUpDate || null, createdAt: l.createdAt, lastCallNote: l.lastCallNote || ''
      }));
      return res.json({ success: true, data: { dateLabel, total: leads.length, leads: leadsList } });
    }

    return res.json({ success: true, data: { dateLabel, total: leads.length } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/reports/employees-periodic — Employee Reports page
router.get('/employees-periodic', protect, isManager, async (req, res) => {
  try {
    const { startDate, endDate, employeeId, status, tlName, tab = 'summary' } = req.query;

    const start = startDate ? istDateStrStart(startDate) : istDayStart(-29);
    const end = endDate ? istDateStrEnd(endDate) : new Date();

    const empFilter = { role: 'employee' };
    if (employeeId) empFilter._id = employeeId;
    if (tlName) empFilter.tlName = tlName;
    if (status === 'active') empFilter.isActive = true;
    else if (status === 'inactive') empFilter.isActive = false;

    const employeesList = await User.find(empFilter).sort({ name: 1 }).lean();
    const employeeIds = employeesList.map((e) => e._id);

    const callFilter = { timestamp: { $gte: start, $lte: end }, employeeId: { $in: employeeIds } };
    const leadFilter = { createdAt: { $gte: start, $lte: end }, assignedTo: { $in: employeeIds } };

    const [calls, leads] = await Promise.all([
      CallLog.find(callFilter).select('employeeId duration').lean(),
      Lead.find(leadFilter).select('assignedTo status').lean(),
    ]);

    const statsMap = {};
    employeesList.forEach((e) => {
      statsMap[e._id.toString()] = {
        employeeId: e._id.toString(), employeeName: e.name, email: e.email, phone: e.phone || '',
        tlName: e.tlName || '', isActive: e.isActive, dailyTarget: e.dailyTarget || 0,
        totalCalls: 0, connectedCalls: 0, totalDuration: 0, leadsAssigned: 0, leadsConverted: 0
      };
    });
    calls.forEach((c) => {
      const s = statsMap[c.employeeId?.toString()];
      if (!s) return;
      s.totalCalls++;
      s.totalDuration += c.duration || 0;
      if ((c.duration || 0) > 0) s.connectedCalls++;
    });
    leads.forEach((l) => {
      const s = statsMap[l.assignedTo?.toString()];
      if (!s) return;
      s.leadsAssigned++;
      if (l.status === 'converted') s.leadsConverted++;
    });

    const dayCount = Math.max(1, Math.round((end - start) / 86400000) + 1);

    const perfList = Object.values(statsMap).map((s) => {
      const conversionRate = s.leadsAssigned ? Math.round((s.leadsConverted / s.leadsAssigned) * 100) : 0;
      const targetTotal = s.dailyTarget * dayCount;
      const targetAchievement = s.dailyTarget > 0 ? Math.round((s.totalCalls / targetTotal) * 100) : null;
      return { ...s, conversionRate, targetTotal, targetAchievement, totalTalktime: fmtDuration(s.totalDuration) };
    });

    const dateLabel = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' to ' + end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    if (tab === 'analysis') {
      const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: hourSlotLabel(h), calls: 0, leads: 0 }));
      calls.forEach((c) => { hourly[istHourOf(c.timestamp)].calls++; });
      leads.forEach((l) => { hourly[istHourOf(l.createdAt)].leads++; });

      let topDialer = null, topConverter = null, bestTarget = null, needsAttention = null;
      perfList.forEach((e) => {
        if (!topDialer || e.totalCalls > topDialer.count) topDialer = { employeeName: e.employeeName, count: e.totalCalls };
        if (!topConverter || e.leadsConverted > topConverter.count) topConverter = { employeeName: e.employeeName, count: e.leadsConverted };
        if (e.targetAchievement != null) {
          if (!bestTarget || e.targetAchievement > bestTarget.pct) bestTarget = { employeeName: e.employeeName, pct: e.targetAchievement };
          if (!needsAttention || e.targetAchievement < needsAttention.pct) needsAttention = { employeeName: e.employeeName, pct: e.targetAchievement };
        }
      });

      const empCount = employeesList.length || 1;
      return res.json({
        success: true,
        data: {
          dateLabel, hourly, topDialer, topConverter, bestTarget, needsAttention,
          avgCallsPerEmployee: Math.round(calls.length / empCount),
          avgLeadsPerEmployee: Math.round(leads.length / empCount),
          dayCount
        }
      });
    }

    if (tab === 'dayWise') {
      const dayMap = {};
      calls.forEach((c) => {
        const key = istDayKey(c.timestamp);
        if (!dayMap[key]) dayMap[key] = { date: key, label: istDayLabel(c.timestamp), calls: 0, leadsCreated: 0, leadsConverted: 0 };
        dayMap[key].calls++;
      });
      leads.forEach((l) => {
        const key = istDayKey(l.createdAt);
        if (!dayMap[key]) dayMap[key] = { date: key, label: istDayLabel(l.createdAt), calls: 0, leadsCreated: 0, leadsConverted: 0 };
        dayMap[key].leadsCreated++;
        if (l.status === 'converted') dayMap[key].leadsConverted++;
      });
      const daywise = Object.values(dayMap).sort((a, b) => b.date.localeCompare(a.date));
      return res.json({ success: true, data: { dateLabel, daywise } });
    }

    if (tab === 'hourly') {
      const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: hourSlotLabel(h), calls: 0, leads: 0 }));
      calls.forEach((c) => { hourly[istHourOf(c.timestamp)].calls++; });
      leads.forEach((l) => { hourly[istHourOf(l.createdAt)].leads++; });
      const totalAll = (calls.length + leads.length) || 1;
      return res.json({
        success: true,
        data: { dateLabel, hourly: hourly.map((h) => ({ ...h, pct: Number((((h.calls + h.leads) / totalAll) * 100).toFixed(2)) })) }
      });
    }

    if (tab === 'target') {
      const records = perfList
        .filter((e) => e.dailyTarget > 0)
        .sort((a, b) => (a.targetAchievement ?? 0) - (b.targetAchievement ?? 0));
      return res.json({ success: true, data: { dateLabel, records } });
    }

    if (tab === 'attention') {
      const records = perfList
        .filter((e) => !e.isActive || e.totalCalls === 0 || (e.dailyTarget > 0 && e.targetAchievement < 50))
        .map((e) => ({
          ...e,
          reason: !e.isActive
            ? 'Inactive account'
            : e.totalCalls === 0
              ? 'No activity this period'
              : `Below 50% of target (${e.targetAchievement}%)`
        }));
      return res.json({ success: true, data: { dateLabel, records } });
    }

    if (tab === 'directory') {
      return res.json({ success: true, data: { dateLabel, employees: perfList } });
    }

    const activeCount = employeesList.filter((e) => e.isActive).length;
    return res.json({
      success: true,
      data: {
        dateLabel,
        kpis: {
          totalEmployees: employeesList.length,
          activeEmployees: activeCount,
          totalCalls: calls.length,
          totalLeadsAssigned: leads.length
        },
        statusPie: [
          { name: 'Active', value: activeCount, color: '#16A34A' },
          { name: 'Inactive', value: employeesList.length - activeCount, color: '#DC2626' }
        ].filter((d) => d.value > 0),
        employeePerformance: perfList.sort((a, b) => b.totalCalls - a.totalCalls)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

function csvEsc(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }

// GET /api/reports/employees/export — full-field CSV of every employee
// (base User fields + performance aggregates, including total talktime),
// streamed row-by-row rather than buffered. Also registered in the
// Downloads Center. Must be declared before any /employees-periodic-style
// param routes, though none currently conflict with this literal path.
router.get('/employees/export', protect, isManager, async (req, res) => {
  let job = null;
  try {
    const { startDate, endDate, status, tlName } = req.query;
    const start = startDate ? istDateStrStart(startDate) : istDayStart(-29);
    const end = endDate ? istDateStrEnd(endDate) : new Date();

    const empFilter = { role: 'employee' };
    if (tlName) empFilter.tlName = tlName;
    if (status === 'active') empFilter.isActive = true;
    else if (status === 'inactive') empFilter.isActive = false;

    const employeesList = await User.find(empFilter).sort({ name: 1 }).lean();
    const employeeIds = employeesList.map((e) => e._id);

    const [callAgg, leadAgg] = await Promise.all([
      CallLog.aggregate([
        { $match: { timestamp: { $gte: start, $lte: end }, employeeId: { $in: employeeIds } } },
        { $group: {
          _id: '$employeeId',
          totalCalls: { $sum: 1 },
          connectedCalls: { $sum: { $cond: [{ $gt: ['$duration', 0] }, 1, 0] } },
          totalDuration: { $sum: { $ifNull: ['$duration', 0] } }
        }}
      ]),
      Lead.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end }, assignedTo: { $in: employeeIds } } },
        { $group: {
          _id: '$assignedTo',
          leadsAssigned: { $sum: 1 },
          leadsConverted: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } }
        }}
      ])
    ]);
    const callMap = new Map(callAgg.map((c) => [c._id.toString(), c]));
    const leadMap = new Map(leadAgg.map((l) => [l._id.toString(), l]));
    const dayCount = Math.max(1, Math.round((end - start) / 86400000) + 1);

    const filename = `employees_${startDate ? startDate.slice(0, 10) : 'all'}_${endDate ? endDate.slice(0, 10) : 'now'}.csv`;
    try {
      job = await createPendingDownloadJob({ ownerId: req.user._id, label: 'Employee Directory Export', filename });
    } catch {}

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const header = [
      'Name', 'Email', 'Phone', 'Role', 'Team Lead', 'Daily Target', 'Active',
      'Total Calls', 'Connected Calls', 'Total Talktime',
      'Leads Assigned', 'Leads Converted', 'Conversion Rate (%)', 'Target Achievement (%)',
      'Joined At'
    ].join(',') + '\n';
    res.write(header);
    let jobBuf = [header];
    let jobBytes = Buffer.byteLength(header, 'utf8');
    let jobOverflowed = false;

    for (const e of employeesList) {
      const c = callMap.get(e._id.toString()) || { totalCalls: 0, connectedCalls: 0, totalDuration: 0 };
      const l = leadMap.get(e._id.toString()) || { leadsAssigned: 0, leadsConverted: 0 };
      const target = e.dailyTarget || 0;
      const targetTotal = target * dayCount;
      const targetAchievement = target > 0 ? Math.round((c.totalCalls / targetTotal) * 100) : '';
      const conversionRate = l.leadsAssigned ? Math.round((l.leadsConverted / l.leadsAssigned) * 100) : 0;

      const line = [
        csvEsc(e.name),
        e.email || '',
        e.phone || '',
        e.role || '',
        csvEsc(e.tlName),
        target,
        e.isActive ? 'Yes' : 'No',
        c.totalCalls,
        c.connectedCalls,
        fmtDuration(c.totalDuration),
        l.leadsAssigned,
        l.leadsConverted,
        conversionRate,
        targetAchievement,
        new Date(e.createdAt).toLocaleDateString('en-IN')
      ].join(',') + '\n';
      res.write(line);

      if (!jobOverflowed) {
        jobBytes += Buffer.byteLength(line, 'utf8');
        if (jobBytes > 8 * 1024 * 1024) { jobOverflowed = true; jobBuf = null; }
        else jobBuf.push(line);
      }
    }
    res.end();

    if (job) {
      try {
        job = jobOverflowed
          ? await failDownloadJob(job._id, 'Export too large to store for re-download — the direct download completed successfully.')
          : await completeDownloadJob(job._id, jobBuf.join(''));
      } catch {}
    }
  } catch (err) {
    if (job) { try { await failDownloadJob(job._id, err.message); } catch {} }
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
    else res.end();
  }
});

// GET /api/reports/client — client report by phone number
router.get('/client', protect, isManager, async (req, res) => {
  try {
    const { phone, duration = 'all', tab = 'summary', page = 1, limit = 50 } = req.query;
    if (!phone) return res.status(400).json({ success: false, error: 'phone required' });

    const digits = phone.replace(/\D/g, '');
    if (!digits) return res.status(400).json({ success: false, error: 'Enter a valid phone number' });

    const filter = { contactNumber: { $regex: digits, $options: 'i' } };

    if (duration !== 'all') {
      const now = new Date();
      const start = new Date();
      if (duration === 'today') { start.setHours(0, 0, 0, 0); }
      else if (duration === 'yesterday') { start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0); now.setHours(0, 0, 0, 0); }
      else if (duration === 'week') { start.setDate(start.getDate() - 7); }
      else if (duration === 'month') { start.setMonth(start.getMonth() - 1); }
      filter.timestamp = { $gte: start, $lte: now };
    }

    const calls = await CallLog.find(filter)
      .populate('employeeId', 'name phone tlName')
      .sort({ timestamp: -1, _id: -1 })
      .lean();

    const byType = { incoming: [], outgoing: [], missed: [], rejected: [] };
    calls.forEach((c) => { if (byType[c.callType]) byType[c.callType].push(c); });

    const totalDuration = calls.reduce((s, c) => s + (c.duration || 0), 0);
    const connectedCalls = calls.filter((c) => (c.duration || 0) > 0).length;
    const notPickupByClient = byType.outgoing.filter((c) => !c.duration || c.duration === 0).length;
    const neverAttended = byType.missed.filter((c) => !byType.outgoing.find((o) => o.contactNumber === c.contactNumber)).length;

    if (calls.length === 0) {
      return res.json({
        success: true,
        data: { phone, noResults: true }
      });
    }

    if (tab === 'summary') {
      const empSummary = {};
      calls.forEach((c) => {
        const id = c.employeeId?._id?.toString() || c.employeeId?.toString();
        if (!id) return;
        if (!empSummary[id]) empSummary[id] = {
          employeeId: id, employeeName: empName(c), employeePhone: empPhone(c), tlName: empTL(c),
          totalCalls: 0, totalDuration: 0,
          incomingTotal: 0, incomingConnected: 0, incomingDuration: 0,
          outgoingTotal: 0, outgoingConnected: 0, outgoingDuration: 0,
          missed: 0, rejected: 0, neverAttended: 0, notPickupByClient: 0,
          lastSyncTime: c.timestamp
        };
        const e = empSummary[id];
        e.totalCalls++;
        e.totalDuration += c.duration || 0;
        if (c.callType === 'incoming') {
          e.incomingTotal++;
          e.incomingDuration += c.duration || 0;
          if ((c.duration || 0) > 0) e.incomingConnected++;
        } else if (c.callType === 'outgoing') {
          e.outgoingTotal++;
          e.outgoingDuration += c.duration || 0;
          if ((c.duration || 0) > 0) e.outgoingConnected++;
          else e.notPickupByClient++;
        } else if (c.callType === 'missed') {
          e.missed++;
          e.neverAttended++;
        } else if (c.callType === 'rejected') {
          e.rejected++;
        }
        if (new Date(c.timestamp) > new Date(e.lastSyncTime)) e.lastSyncTime = c.timestamp;
      });

      return res.json({
        success: true,
        data: {
          phone,
          summary: {
            incoming: { calls: byType.incoming.length, duration: fmtDuration(byType.incoming.reduce((s, c) => s + (c.duration || 0), 0)) },
            outgoing: { calls: byType.outgoing.length, duration: fmtDuration(byType.outgoing.reduce((s, c) => s + (c.duration || 0), 0)) },
            missed:   { calls: byType.missed.length },
            rejected: { calls: byType.rejected.length },
            total:    { calls: calls.length, duration: fmtDuration(totalDuration) }
          },
          sidebarStats: { neverAttended, notPickupByClient, connectedCalls },
          pieData: [
            { name: 'Incoming', value: byType.incoming.length, color: '#34C759' },
            { name: 'Outgoing', value: byType.outgoing.length, color: '#FF9500' },
            { name: 'Missed',   value: byType.missed.length,   color: '#FF3B30' },
            { name: 'Rejected', value: byType.rejected.length, color: '#7C3AED' }
          ].filter((d) => d.value > 0),
          employeeSummary: Object.values(empSummary).map((e) => ({
            ...e,
            totalDuration:    fmtDuration(e.totalDuration),
            incomingDuration: fmtDuration(e.incomingDuration),
            outgoingDuration: fmtDuration(e.outgoingDuration)
          }))
        }
      });
    }

    const pageNum = parseInt(page), pageSize = parseInt(limit);
    return res.json({
      success: true,
      data: {
        total: calls.length,
        calls: calls.slice((pageNum - 1) * pageSize, pageNum * pageSize).map(c => ({
          ...c,
          employeeName:  empName(c),
          employeePhone: empPhone(c),
          employeeTL:    empTL(c),
        })),
        pages: Math.ceil(calls.length / pageSize)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
