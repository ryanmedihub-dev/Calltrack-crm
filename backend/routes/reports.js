const express = require('express');
const router = express.Router();
const CallLog = require('../models/CallLog');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { protect, isManager } = require('../middleware/auth');

function fmtDuration(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Returns the UTC timestamp of IST midnight for today (offsetDays=0) or any offset.
function istDayStart(offsetDays = 0) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  nowIST.setUTCHours(0, 0, 0, 0);
  nowIST.setUTCDate(nowIST.getUTCDate() + offsetDays);
  return new Date(nowIST.getTime() - IST_OFFSET_MS);
}

// GET /api/reports/periodic — full periodic report
router.get('/periodic', protect, isManager, async (req, res) => {
  try {
    const {
      startDate, endDate, employeeId, callType,
      tab = 'summary', page = 1, limit = 100
    } = req.query;

    const start = startDate
      ? (() => { const d = new Date(startDate); d.setHours(0, 0, 0, 0); return d; })()
      : istDayStart(0);
    const end = endDate
      ? (() => { const d = new Date(endDate); d.setHours(23, 59, 59, 999); return d; })()
      : new Date();

    const filter = { timestamp: { $gte: start, $lte: end } };
    if (employeeId) filter.employeeId = employeeId;
    if (callType) filter.callType = callType;

    const calls = await CallLog.find(filter).sort({ timestamp: -1 }).lean();

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
      const id = c.employeeId.toString();
      if (!empSummary[id]) empSummary[id] = {
        employeeId: id, employeeName: c.employeeName,
        totalCalls: 0, totalDuration: 0,
        incoming: 0, incomingConnected: 0, incomingDuration: 0,
        outgoing: 0, outgoingConnected: 0, outgoingDuration: 0,
        missed: 0, rejected: 0, neverAttended: 0, notPickupByClient: 0,
        connectedCalls: 0, lastSyncTime: c.timestamp
      };
      const e = empSummary[id];
      e.totalCalls++;
      e.totalDuration += c.duration || 0;
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

    // Add neverAttended to employee summary
    const empMissedNums = {};
    const empOutgoingNums = {};
    byType.missed.forEach((c) => {
      const id = c.employeeId.toString();
      if (!empMissedNums[id]) empMissedNums[id] = new Set();
      empMissedNums[id].add(c.contactNumber);
    });
    byType.outgoing.forEach((c) => {
      const id = c.employeeId.toString();
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

    const employeeSummaryList = Object.values(empSummary).map((e) => ({
      ...e,
      totalDuration: fmtDuration(e.totalDuration),
      incomingDuration: fmtDuration(e.incomingDuration),
      outgoingDuration: fmtDuration(e.outgoingDuration)
    }));

    // Summary tab
    if (tab === 'summary') {
      return res.json({
        success: true,
        data: {
          dateLabel: start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
            (startDate !== endDate ? ' to ' + end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''),
          summary: {
            incoming: { calls: byType.incoming.length, duration: fmtDuration(incomingDuration) },
            outgoing: { calls: byType.outgoing.length, duration: fmtDuration(outgoingDuration) },
            missed: { calls: byType.missed.length, duration: '—' },
            rejected: { calls: byType.rejected.length, duration: '—' },
            total: { calls: calls.length, duration: fmtDuration(totalDuration) }
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
            { name: 'Missed', value: byType.missed.length, color: '#FF3B30' },
            { name: 'Rejected', value: byType.rejected.length, color: '#7C3AED' }
          ].filter(d => d.value > 0),
          employeeSummary: employeeSummaryList
        }
      });
    }

    // Day-wise analysis
    if (tab === 'daywise') {
      const dayMap = {};
      calls.forEach((c) => {
        const day = new Date(c.timestamp).toLocaleDateString('en-GB');
        if (!dayMap[day]) dayMap[day] = { date: day, totalCalls: 0, incoming: 0, outgoing: 0, missed: 0, rejected: 0, duration: 0 };
        dayMap[day].totalCalls++;
        dayMap[day].duration += c.duration || 0;
        if (byType[c.callType]) dayMap[day][c.callType]++;
      });
      const daywise = Object.values(dayMap).map(d => ({ ...d, duration: fmtDuration(d.duration) }));
      return res.json({ success: true, data: { daywise } });
    }

    // Hourly analysis
    if (tab === 'hourly') {
      const hourly = Array.from({ length: 24 }, (_, h) => ({
        hour: h, label: `${String(h).padStart(2,'0')}:00`,
        totalCalls: 0, incoming: 0, outgoing: 0, missed: 0, rejected: 0, duration: 0
      }));
      calls.forEach((c) => {
        const h = new Date(c.timestamp).getHours();
        hourly[h].totalCalls++;
        hourly[h].duration += c.duration || 0;
        if (hourly[h][c.callType] !== undefined) hourly[h][c.callType]++;
      });
      return res.json({ success: true, data: { hourly: hourly.map(h => ({ ...h, duration: fmtDuration(h.duration) })) } });
    }

    // Never attended
    if (tab === 'neverAttended') {
      const numMap = {};
      byType.missed.forEach((c) => {
        if (!numMap[c.contactNumber]) numMap[c.contactNumber] = {
          contactNumber: c.contactNumber, contactName: c.contactName || 'Unknown',
          missedCount: 0, lastMissedAt: c.timestamp, employees: new Set()
        };
        numMap[c.contactNumber].missedCount++;
        numMap[c.contactNumber].employees.add(c.employeeName);
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

    // Not pickup by client
    if (tab === 'notPickupByClient') {
      const pageNum = parseInt(page), pageSize = parseInt(limit);
      const records = notPickupByClientCalls.map((c) => ({
        _id: c._id, contactNumber: c.contactNumber, contactName: c.contactName || 'Unknown',
        employeeName: c.employeeName, timestamp: c.timestamp, callType: c.callType
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

    // Unique clients
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
        cl.employees.add(c.employeeName);
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

    // Call history
    if (tab === 'callHistory') {
      const pageNum = parseInt(page), pageSize = parseInt(limit);
      const total = await CallLog.countDocuments(filter);
      const historyCalls = await CallLog.find(filter)
        .sort({ timestamp: -1 })
        .skip((pageNum - 1) * pageSize)
        .limit(pageSize)
        .lean();
      return res.json({
        success: true,
        data: {
          total,
          calls: historyCalls,
          pages: Math.ceil(total / pageSize),
          page: pageNum
        }
      });
    }

    // Analysis tab — employee-wise breakdown
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

// GET /api/reports/client — client report by phone number
router.get('/client', protect, isManager, async (req, res) => {
  try {
    const { phone, duration = 'all', tab = 'summary', page = 1, limit = 50 } = req.query;
    if (!phone) return res.status(400).json({ success: false, error: 'phone required' });

    const filter = { contactNumber: { $regex: phone.replace(/\D/g, ''), $options: 'i' } };

    if (duration !== 'all') {
      const now = new Date();
      const start = new Date();
      if (duration === 'today') { start.setHours(0, 0, 0, 0); }
      else if (duration === 'yesterday') { start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0); now.setHours(0, 0, 0, 0); }
      else if (duration === 'week') { start.setDate(start.getDate() - 7); }
      else if (duration === 'month') { start.setMonth(start.getMonth() - 1); }
      filter.timestamp = { $gte: start, $lte: now };
    }

    const calls = await CallLog.find(filter).sort({ timestamp: -1 }).lean();
    const byType = { incoming: [], outgoing: [], missed: [], rejected: [] };
    calls.forEach((c) => { if (byType[c.callType]) byType[c.callType].push(c); });

    const totalDuration = calls.reduce((s, c) => s + (c.duration || 0), 0);
    const connectedCalls = calls.filter((c) => (c.duration || 0) > 0).length;
    const notPickupByClient = byType.outgoing.filter((c) => !c.duration || c.duration === 0).length;
    const neverAttended = byType.missed.filter((c) => !byType.outgoing.find((o) => o.contactNumber === c.contactNumber)).length;

    if (tab === 'summary') {
      const empSummary = {};
      calls.forEach((c) => {
        const id = c.employeeId.toString();
        if (!empSummary[id]) empSummary[id] = {
          employeeId: id, employeeName: c.employeeName, employeePhone: c.employeePhone || '',
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
            missed: { calls: byType.missed.length },
            rejected: { calls: byType.rejected.length },
            total: { calls: calls.length, duration: fmtDuration(totalDuration) }
          },
          sidebarStats: { neverAttended, notPickupByClient, connectedCalls },
          pieData: [
            { name: 'Incoming', value: byType.incoming.length, color: '#34C759' },
            { name: 'Outgoing', value: byType.outgoing.length, color: '#FF9500' },
            { name: 'Missed', value: byType.missed.length, color: '#FF3B30' },
            { name: 'Rejected', value: byType.rejected.length, color: '#7C3AED' }
          ].filter((d) => d.value > 0),
          employeeSummary: Object.values(empSummary).map((e) => ({
            ...e,
            totalDuration: fmtDuration(e.totalDuration),
            incomingDuration: fmtDuration(e.incomingDuration),
            outgoingDuration: fmtDuration(e.outgoingDuration)
          }))
        }
      });
    }

    // Call history tab
    const pageNum = parseInt(page), pageSize = parseInt(limit);
    return res.json({
      success: true,
      data: {
        total: calls.length,
        calls: calls.slice((pageNum - 1) * pageSize, pageNum * pageSize),
        pages: Math.ceil(calls.length / pageSize)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
