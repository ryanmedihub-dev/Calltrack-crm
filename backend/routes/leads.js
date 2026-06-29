const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const CallLog = require('../models/CallLog');
const { protect, isManager } = require('../middleware/auth');
const normalizePhone = require('../lib/normalizePhone');
const { logAction } = require('../lib/audit');

// POST /api/leads — create lead (any authenticated user)
router.post('/', protect, async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone) || req.body.phone;
    if (!phone) return res.status(400).json({ success: false, error: 'Phone required' });

    // Handle existing phone gracefully
    const existing = await Lead.findOne({ phone });
    if (existing) {
      const ownedBySelf  = existing.assignedTo?.toString() === req.user._id.toString();
      const isUnassigned = !existing.assignedTo;
      if (ownedBySelf) return res.json({ success: true, data: existing, message: 'Already in your leads' });
      if (isUnassigned) {
        existing.assignedTo = req.user._id;
        existing.changelog.push({ changedBy: req.user._id, changedByName: req.user.name, action: 'assigned', details: { source: 'manual' } });
        await existing.save();
        return res.json({ success: true, data: existing, message: 'Lead claimed' });
      }
      return res.status(409).json({ success: false, error: 'Lead is already assigned to another team member' });
    }

    const lead = await Lead.create({
      ...req.body,
      phone,
      assignedTo: req.body.assignedTo || req.user._id,
      changelog: [{
        changedBy:     req.user._id,
        changedByName: req.user.name,
        action:        'created',
        details:       { source: 'manual' }
      }]
    });
    await logAction(req, 'lead.create', { entity: 'Lead', entityId: lead._id, details: { name: lead.name, phone: lead.phone } });
    return res.status(201).json({ success: true, data: lead, message: 'Lead created' });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, error: 'Phone number already exists' });
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/leads — all leads with filters + search
router.get('/', protect, isManager, async (req, res) => {
  try {
    const { status, assignedTo, search, tags, page = 1, limit = 20, sortBy = 'createdAt', sortDir = '-1' } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (tags) filter.tags = { $in: tags.split(',') };
    if (search) {
      filter.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: parseInt(sortDir) };
    const [leads, total] = await Promise.all([
      Lead.find(filter).populate('assignedTo', 'name email phone').sort(sort).skip(skip).limit(parseInt(limit)),
      Lead.countDocuments(filter)
    ]);
    return res.json({ success: true, data: { leads, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/leads/tags — unique tags (must be before /:id)
router.get('/tags', protect, isManager, async (req, res) => {
  try {
    const tags = await Lead.distinct('tags');
    return res.json({ success: true, data: tags.filter(Boolean) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/leads/assigned — current employee's leads (must be before /:id)
router.get('/assigned', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [leads, total] = await Promise.all([
      Lead.find({ assignedTo: req.user._id }).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Lead.countDocuments({ assignedTo: req.user._id })
    ]);
    return res.json({ success: true, data: { leads, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/leads/bulk-upload (must be before /:id routes)
const VALID_STATUSES = new Set([
  'new','contacted','not_connected','interested',
  'not_interested','follow_up','booking_done','converted','lost',
]);
router.post('/bulk-upload', protect, async (req, res) => {
  try {
    const { leads: rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No leads provided' });
    }
    if (rows.length > 1000) {
      return res.status(400).json({ success: false, error: 'Maximum 1000 leads per upload' });
    }

    let inserted = 0, skipped = 0, errors = 0;

    for (const row of rows) {
      try {
        const name   = (row.name  || '').trim();
        const phone  = normalizePhone((row.phone || '').toString().trim()) || (row.phone || '').replace(/\D/g, '');
        const status = VALID_STATUSES.has(row.status) ? row.status : 'new';

        if (!name || !phone) { errors++; continue; }

        const exists = await Lead.exists({ phone });
        if (exists) { skipped++; continue; }

        await Lead.create({
          name,
          phone,
          status,
          source:     'bulk_upload',
          assignedTo: req.user._id,
          changelog: [{
            changedBy:     req.user._id,
            changedByName: req.user.name,
            action:        'created',
            details:       { source: 'bulk_upload' }
          }]
        });
        inserted++;
      } catch (rowErr) {
        if (rowErr.code === 11000) skipped++;
        else errors++;
      }
    }

    return res.json({ success: true, inserted, skipped, errors });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/leads/bulk-assign (must be before /:id routes)
router.post('/bulk-assign', protect, isManager, async (req, res) => {
  try {
    const { leadIds, employeeId } = req.body;
    if (!Array.isArray(leadIds) || !leadIds.length) return res.status(400).json({ success: false, error: 'leadIds array required' });
    const result = await Lead.updateMany({ _id: { $in: leadIds } }, { $set: { assignedTo: employeeId || null } });
    return res.json({ success: true, data: { modified: result.modifiedCount }, message: `${result.modifiedCount} leads assigned` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/leads/bulk-transfer (must be before /:id routes)
router.post('/bulk-transfer', protect, isManager, async (req, res) => {
  try {
    const { leadIds, toEmployeeId } = req.body;
    if (!Array.isArray(leadIds) || !leadIds.length) return res.status(400).json({ success: false, error: 'leadIds array required' });
    const result = await Lead.updateMany({ _id: { $in: leadIds } }, { $set: { assignedTo: toEmployeeId } });
    return res.json({ success: true, data: { modified: result.modifiedCount }, message: `${result.modifiedCount} leads transferred` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/leads/bulk-delete (must be before /:id routes)
router.delete('/bulk-delete', protect, isManager, async (req, res) => {
  try {
    const { leadIds } = req.body;
    if (!Array.isArray(leadIds) || !leadIds.length) return res.status(400).json({ success: false, error: 'leadIds array required' });
    const result = await Lead.deleteMany({ _id: { $in: leadIds } });
    return res.json({ success: true, data: { deleted: result.deletedCount }, message: `${result.deletedCount} leads deleted` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/leads/from-call (must be before /:id routes)
router.post('/from-call', protect, async (req, res) => {
  try {
    const { callId, name, phone, email, source, assignedTo, status = 'new' } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: 'Phone required' });
    const existing = await Lead.findOne({ phone });
    if (existing) {
      if (callId) {
        await CallLog.findByIdAndUpdate(callId, { leadId: existing._id });
        await Lead.findByIdAndUpdate(existing._id, {
          $addToSet: { callLogs: callId },
          $push: {
            changelog: {
              changedBy: req.user._id,
              changedByName: req.user.name,
              action: 'call_linked',
              details: { callId, source: 'from_call' }
            }
          }
        });
      }
      return res.json({ success: true, data: existing, message: 'Lead already exists, linked to call' });
    }
    const lead = await Lead.create({
      name: name || phone,
      phone: normalizePhone(phone) || phone,
      email,
      source: source || 'Call',
      assignedTo: assignedTo || req.user._id,
      status,
      capturedBy: req.user.name,
      callLogs: callId ? [callId] : [],
      changelog: [{
        changedBy:     req.user._id,
        changedByName: req.user.name,
        action:        'created',
        details:       { source: 'from_call', callId }
      }]
    });
    if (callId) await CallLog.findByIdAndUpdate(callId, { leadId: lead._id });
    return res.status(201).json({ success: true, data: lead, message: 'Lead created from call' });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, error: 'Phone already exists' });
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/leads/export — streaming CSV export (manager)
router.get('/export', protect, isManager, async (req, res) => {
  try {
    const { status, assignedTo, startDate, endDate, search, tags } = req.query;
    const filter = {};
    if (status)     filter.status     = status;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (tags)       filter.tags = { $in: tags.split(',') };
    if (search) {
      filter.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const ed = new Date(endDate); ed.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = ed;
      }
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.write('Name,Phone,Email,Status,Assigned To,Source,Tags,Attempts,Connected Calls,Last Call At,Follow Up Date,Created At\n');

    const cursor = Lead.find(filter).populate('assignedTo', 'name').sort({ createdAt: -1 }).lean().cursor();
    const esc = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
    for await (const doc of cursor) {
      res.write([
        esc(doc.name),
        doc.phone || '',
        doc.email || '',
        doc.status || '',
        esc(doc.assignedTo?.name),
        esc(doc.source),
        esc((doc.tags || []).join('; ')),
        doc.attempts || 0,
        doc.connectedCallCount || 0,
        doc.lastCallAt ? new Date(doc.lastCallAt).toLocaleDateString('en-IN') : '',
        doc.followUpDate ? new Date(doc.followUpDate).toLocaleDateString('en-IN') : '',
        new Date(doc.createdAt).toLocaleDateString('en-IN')
      ].join(',') + '\n');
    }

    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/leads/:id — single lead with call history and changelog
router.get('/:id', protect, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('assignedTo', 'name email phone')
      .populate({
        path: 'callLogs',
        populate: { path: 'employeeId', select: 'name phone' }
      });
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });

    // Also fetch any calls by phone not yet linked (for backwards compatibility)
    const linkedIds = new Set((lead.callLogs || []).map((c) => c._id.toString()));
    const callsByNumber = await CallLog.find({ contactNumber: lead.phone })
      .populate('employeeId', 'name phone')
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    const extraCalls = callsByNumber.filter((c) => !linkedIds.has(c._id.toString())).map((c) => ({
      ...c,
      employeeName:  c.employeeId?.name  || 'Unknown',
      employeePhone: c.employeeId?.phone || '',
    }));

    // Enrich linked call logs
    const linkedCalls = (lead.callLogs || []).map((c) => {
      const obj = c.toObject ? c.toObject() : c;
      return {
        ...obj,
        employeeName:  obj.employeeId?.name  || 'Unknown',
        employeePhone: obj.employeeId?.phone || '',
      };
    });

    const allCalls = [...linkedCalls, ...extraCalls];

    return res.json({ success: true, data: { lead, calls: allCalls } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/leads/:id — update lead
router.put('/:id', protect, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
    const isOwner = lead.assignedTo && lead.assignedTo.toString() === req.user._id.toString();
    if (req.user.role !== 'manager' && !isOwner) return res.status(403).json({ success: false, error: 'Access denied' });

    const {
      name, phone, email,
      source, tags, status, assignedTo, followUpDate,
      lastCallNote, lastCallSummary
    } = req.body;

    const payload = req.user.role === 'manager'
      ? { name, phone, email, source, tags, status, assignedTo, followUpDate, lastCallNote, lastCallSummary }
      : { status, followUpDate, lastCallNote, lastCallSummary };

    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
    if (payload.phone) payload.phone = normalizePhone(payload.phone) || payload.phone;

    // Track status change in changelog
    const changelogEntry = {
      changedBy:     req.user._id,
      changedByName: req.user.name,
      action:        'updated',
      details:       payload
    };
    if (payload.status && payload.status !== lead.status) {
      changelogEntry.action = 'status_changed';
      changelogEntry.details = { from: lead.status, to: payload.status, ...payload };
    }

    const updated = await Lead.findByIdAndUpdate(
      req.params.id,
      { $set: payload, $push: { changelog: changelogEntry } },
      { new: true }
    ).populate('assignedTo', 'name email phone');

    await logAction(req, 'lead.update', { entity: 'Lead', entityId: req.params.id, details: payload });
    return res.json({ success: true, data: updated, message: 'Lead updated' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/leads/:id
router.delete('/:id', protect, isManager, async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
    await logAction(req, 'lead.delete', { entity: 'Lead', entityId: req.params.id, details: { name: lead.name } });
    return res.json({ success: true, data: null, message: 'Lead deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/leads/:id/note — add a note entry to the lead's changelog
router.post('/:id/note', protect, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, error: 'Note text required' });
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
    const isOwner = lead.assignedTo && lead.assignedTo.toString() === req.user._id.toString();
    if (req.user.role !== 'manager' && !isOwner) return res.status(403).json({ success: false, error: 'Access denied' });
    lead.changelog.push({
      changedBy:     req.user._id,
      changedByName: req.user.name,
      action:        'note_added',
      details:       { text }
    });
    await lead.save();
    return res.json({ success: true, data: lead, message: 'Note added' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/leads/:id/link-call
router.patch('/:id/link-call', protect, isManager, async (req, res) => {
  try {
    const { callId } = req.body;
    await CallLog.findByIdAndUpdate(callId, { leadId: req.params.id });
    const call = await CallLog.findById(callId).populate('employeeId', 'name phone');
    if (call) {
      await Lead.findByIdAndUpdate(req.params.id, {
        $inc: { attempts: 1 },
        $set: {
          lastCallAt:            call.timestamp,
          lastCallType:          call.callType,
          lastCallDuration:      call.duration,
          lastCallEmployee:      call.employeeId?.name  || 'Unknown',
          lastCallEmployeePhone: call.employeeId?.phone || '',
        },
        $addToSet: { callLogs: callId },
        $push: {
          changelog: {
            changedBy:     req.user._id,
            changedByName: req.user.name,
            action:        'call_linked',
            details:       { callId, callType: call.callType, duration: call.duration, timestamp: call.timestamp }
          }
        }
      });
    }
    return res.json({ success: true, message: 'Call linked to lead' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
