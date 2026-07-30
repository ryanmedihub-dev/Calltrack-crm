const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const CallLog = require('../models/CallLog');
const User = require('../models/User');
const { protect, isManager } = require('../middleware/auth');
const normalizePhone = require('../lib/normalizePhone');
const { logAction } = require('../lib/audit');
const { createPendingDownloadJob, completeDownloadJob, failDownloadJob, MAX_CONTENT_BYTES } = require('../lib/downloadJobs');
const { resolveEmployeeIdsForTL } = require('../lib/tlFilter');
const fmtDuration = require('../lib/formatDuration');
const { createLeadFromCall } = require('../lib/leadFromCall');

// Human-readable description for a single changelog entry, used by GET /logs
function describeChangelogEntry(action, details) {
  details = details || {};
  switch (action) {
    case 'created':
      return details.source ? `Lead created via ${details.source}` : 'Lead created';
    case 'status_changed':
      return details.from || details.to
        ? `Status changed from "${details.from || 'unknown'}" to "${details.to || 'unknown'}"`
        : 'Status changed';
    case 'assigned':
      return details.source === 'bulk_upload_replace'
        ? 'Assigned during bulk upload'
        : 'Lead assigned to a team member';
    case 'call_linked':
      return details.callType ? `Call linked (${details.callType})` : 'Call linked to lead';
    case 'note_added':
      return details.text ? `Note added: "${details.text}"` : 'Note added';
    case 'updated':
      return 'Lead details updated';
    default:
      return 'Lead activity';
  }
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
function resolveDateRange(range, startDate, endDate) {
  switch (range) {
    case 'yesterday': return getISTDateBounds(-1);
    case 'thisWeek':  return getISTWeekBounds();
    case 'custom':    return getISTCustomBounds(startDate, endDate);
    case 'today':
    default:          return getISTDateBounds(0);
  }
}

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
    const { status, assignedTo, search, tags, page = 1, limit = 20, sortBy = 'createdAt', sortDir = '-1', range, startDate, endDate } = req.query;
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
    if (range) {
      const { start, end } = resolveDateRange(range, startDate, endDate);
      filter.createdAt = { $gte: start, $lt: end };
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

// GET /api/leads/logs — activity/audit trail across all leads' changelogs (must be before /:id)
router.get('/logs', protect, isManager, async (req, res) => {
  try {
    const { search, action, employee, page = 1, limit = 40 } = req.query;
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 40);
    const skip = (pageNum - 1) * limitNum;

    const leadMatch = {};
    if (search) {
      leadMatch.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const changelogMatch = {};
    if (action) changelogMatch['changelog.action'] = action;
    if (employee && mongoose.Types.ObjectId.isValid(employee)) {
      changelogMatch['changelog.changedBy'] = new mongoose.Types.ObjectId(employee);
    }

    const [result] = await Lead.aggregate([
      { $match: leadMatch },
      { $unwind: '$changelog' },
      ...(Object.keys(changelogMatch).length ? [{ $match: changelogMatch }] : []),
      { $sort: { 'changelog.changedAt': -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limitNum },
            { $project: {
              _id:         '$changelog._id',
              leadId:      '$_id',
              leadName:    '$name',
              leadPhone:   '$phone',
              action:      '$changelog.action',
              timestamp:   '$changelog.changedAt',
              performedBy: '$changelog.changedByName',
              details:     '$changelog.details',
            } },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    const total = result?.total?.[0]?.count || 0;
    const logs = (result?.data || []).map((l) => ({
      ...l,
      description: describeChangelogEntry(l.action, l.details),
    }));

    return res.json({ success: true, data: { logs, total, page: pageNum, pages: Math.ceil(total / limitNum) } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/leads/bulk-upload (must be before /:id routes)
// Powers the multi-step "Import Leads" wizard: field-mapped rows arrive already
// normalized by the frontend; this route only handles assignment + duplicate policy + insert.
const VALID_STATUSES = new Set([
  'new','contacted','not_connected','interested',
  'not_interested','follow_up','booking_done','converted','lost',
]);
const MAX_BULK_UPLOAD = 5000;

router.post('/bulk-upload', protect, async (req, res) => {
  try {
    const {
      leads: rows,
      assignment = { mode: 'employee', employeeIds: [], autoSplit: false },
      duplicateStrategy = 'skip', // 'skip' | 'replace'
      defaultStatus = 'new',
      tags: globalTags = []
    } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No leads provided' });
    }
    if (rows.length > MAX_BULK_UPLOAD) {
      return res.status(400).json({ success: false, error: `Maximum ${MAX_BULK_UPLOAD} leads per upload` });
    }

    const status = VALID_STATUSES.has(defaultStatus) ? defaultStatus : 'new';

    // Resolve assignment targets up front
    let employeeIds = [];
    if (assignment.mode === 'employee') {
      const ids = Array.isArray(assignment.employeeIds) ? assignment.employeeIds : [];
      const validEmployees = await User.find({ _id: { $in: ids }, role: 'employee' }).select('_id').lean();
      employeeIds = validEmployees.map((e) => e._id.toString());
      if (!employeeIds.length) {
        return res.status(400).json({ success: false, error: 'Select at least one valid employee to assign leads to' });
      }
    }
    const tagOnly = assignment.mode === 'tag' ? String(assignment.tag || '').trim() : '';

    let inserted = 0, updated = 0, skipped = 0, errors = 0;
    let cursor = 0; // round-robin pointer across employeeIds

    for (const row of rows) {
      try {
        const name  = (row.name || '').trim();
        const phone = normalizePhone((row.phone || '').toString().trim()) || (row.phone || '').replace(/\D/g, '');
        if (!name || !/^[6-9]\d{9}$/.test(phone)) { errors++; continue; }

        const rowTags = Array.isArray(row.tags) ? row.tags.map((t) => String(t).trim()).filter(Boolean) : [];
        const mergedTags = [...new Set([...rowTags, ...globalTags, ...(tagOnly ? [tagOnly] : [])])];

        const assignedTo = assignment.mode === 'employee'
          ? (assignment.autoSplit ? employeeIds[cursor++ % employeeIds.length] : employeeIds[0])
          : null; // tag-only mode leaves the lead unassigned for manual pickup

        const existing = await Lead.findOne({ phone });

        if (existing) {
          if (duplicateStrategy === 'replace') {
            existing.assignedTo = assignedTo || existing.assignedTo;
            existing.tags = [...new Set([...(existing.tags || []), ...mergedTags])];
            existing.changelog.push({
              changedBy: req.user._id,
              changedByName: req.user.name,
              action: 'assigned',
              details: { source: 'bulk_upload_replace' }
            });
            await existing.save();
            updated++;
          } else {
            // 'skip' (Keep existing and ignore new assignments) — leave the lead untouched
            skipped++;
          }
          continue;
        }

        await Lead.create({
          name,
          phone,
          email: row.email || undefined,
          source: row.source || 'bulk_upload',
          tags: mergedTags,
          status,
          assignedTo,
          changelog: [{
            changedBy: req.user._id,
            changedByName: req.user.name,
            action: 'created',
            details: { source: 'bulk_upload' }
          }]
        });
        inserted++;
      } catch (rowErr) {
        if (rowErr.code === 11000) skipped++;
        else errors++;
      }
    }

    return res.json({ success: true, data: { inserted, updated, skipped, errors, total: rows.length } });
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
    const { callId, name, phone, email, source, assignedTo, status = 'new', lastCallNote, followUpDate } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: 'Phone required' });

    // Look up the originating call (if we have it) so the very first attempt is
    // reflected in the lead's call stats, not just future syncs.
    let call = null;
    if (callId) call = await CallLog.findById(callId).catch(() => null);
    const alreadyCounted = call && call.leadId; // this call was already linked/counted elsewhere

    const existing = await Lead.findOne({ phone });
    if (existing) {
      const update = {
        $set: {
          ...(lastCallNote  && { lastCallNote: lastCallNote.trim() }),
          ...(status        && { lastCallSummary: status }),
          ...(followUpDate  && { followUpDate: new Date(followUpDate) }),
        },
        $push: {
          changelog: {
            changedBy:     req.user._id,
            changedByName: req.user.name,
            action:        'call_linked',
            details:       { callId, source: 'from_call' }
          }
        }
      };
      if (callId) update.$addToSet = { callLogs: callId };

      // Count the attempt here only if this call hasn't already been counted
      // (e.g. via /api/calls/sync auto-linking) — avoids double counting.
      if (!alreadyCounted) {
        update.$inc = { attempts: 1, ...(call && call.duration > 0 ? { connectedCallCount: 1 } : {}) };
        update.$set.lastCallAt            = call ? call.timestamp : new Date();
        update.$set.lastCallType          = call ? call.callType   : undefined;
        update.$set.lastCallDuration      = call ? (call.duration || 0) : 0;
        update.$set.lastCallEmployee      = req.user.name;
        update.$set.lastCallEmployeePhone = req.user.phone || '';
        Object.keys(update.$set).forEach((k) => update.$set[k] === undefined && delete update.$set[k]);
      }

      const updated = await Lead.findByIdAndUpdate(existing._id, update, { new: true });
      if (callId) await CallLog.findByIdAndUpdate(callId, { leadId: existing._id });
      return res.json({ success: true, data: updated, message: 'Lead already exists, linked to call' });
    }

    const lead = await createLeadFromCall({
      actor: req.user, call, name, phone, email, source, assignedTo, status,
      note: lastCallNote, followUpDate,
    });
    if (callId) await CallLog.findByIdAndUpdate(callId, { leadId: lead._id });
    return res.status(201).json({ success: true, data: lead, message: 'Lead created from call' });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, error: 'Phone already exists' });
    return res.status(500).json({ success: false, error: err.message });
  }
});

function csvEsc(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }

// GET /api/leads/export — CSV export (manager); also registered in the Downloads Center.
// Streams the response row-by-row instead of buffering the whole file in memory —
// see the matching comment on GET /api/calls/export for the same rationale.
router.get('/export', protect, isManager, async (req, res) => {
  let job = null;
  try {
    const { status, assignedTo, startDate, endDate, search, tags, tlName } = req.query;
    const filter = {};
    if (status)     filter.status     = status;
    if (assignedTo) filter.assignedTo = assignedTo;
    else if (tlName) filter.assignedTo = { $in: await resolveEmployeeIdsForTL(tlName) };
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
    const filename = `leads_${startDate ? startDate.slice(0, 10) : 'all'}_${endDate ? endDate.slice(0, 10) : 'now'}.csv`;

    try {
      job = await createPendingDownloadJob({ ownerId: req.user._id, label: 'Leads Export', filename });
    } catch {}

    // Resolve assignee names/TLs via one lookup instead of populate() on the
    // cursor — populate() re-queries User per row as the cursor iterates,
    // which turns a large export into thousands of extra round-trips.
    const assignedToIds = await Lead.distinct('assignedTo', filter);
    const employees = await User.find({ _id: { $in: assignedToIds } }, 'name tlName').lean();
    const employeeMap = new Map(employees.map((e) => [String(e._id), e]));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const header = [
      'Name', 'Phone', 'Email', 'Status', 'Assigned To', 'Assigned TL', 'Source', 'Tags',
      'Captured By', 'Imported By', 'Attempts', 'Connected Calls',
      'Last Call At', 'Last Call Type', 'Last Call Duration', 'Last Call Remarks', 'Last Call Summary',
      'Last Call Employee', 'Last Call Employee Phone',
      'Follow Up Date', 'Created At'
    ].join(',') + '\n';
    res.write(header);

    let jobBuf = [header];
    let jobBytes = Buffer.byteLength(header, 'utf8');
    let jobOverflowed = false;

    // Batch rows into ~64KB chunks before flushing — see matching comment on
    // GET /api/calls/export for why (cuts res.write() call count drastically).
    const FLUSH_BYTES = 64 * 1024;
    let outBuf = '';

    const cursor = Lead.find(filter).sort({ createdAt: -1 }).lean().cursor();
    for await (const doc of cursor) {
      const employee = employeeMap.get(String(doc.assignedTo));
      const line = [
        csvEsc(doc.name),
        doc.phone || '',
        doc.email || '',
        doc.status || '',
        csvEsc(employee?.name),
        csvEsc(employee?.tlName),
        csvEsc(doc.source),
        csvEsc((doc.tags || []).join('; ')),
        csvEsc(doc.capturedBy),
        csvEsc(doc.importedBy),
        doc.attempts || 0,
        doc.connectedCallCount || 0,
        doc.lastCallAt ? new Date(doc.lastCallAt).toLocaleDateString('en-IN') : '',
        csvEsc(doc.lastCallType),
        fmtDuration(doc.lastCallDuration),
        csvEsc(doc.lastCallNote),
        csvEsc(doc.lastCallSummary),
        csvEsc(doc.lastCallEmployee),
        doc.lastCallEmployeePhone || '',
        doc.followUpDate ? new Date(doc.followUpDate).toLocaleDateString('en-IN') : '',
        new Date(doc.createdAt).toLocaleDateString('en-IN')
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
      .sort({ timestamp: -1, _id: -1 })
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
    if (!callId) return res.status(400).json({ success: false, error: 'callId required' });
    const call = await CallLog.findById(callId).populate('employeeId', 'name phone');
    if (!call) return res.status(404).json({ success: false, error: 'Call not found' });
    await CallLog.findByIdAndUpdate(callId, { leadId: req.params.id });
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
    return res.json({ success: true, message: 'Call linked to lead' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;