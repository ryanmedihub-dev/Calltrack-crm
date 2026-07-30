const Lead = require('../models/Lead');
const normalizePhone = require('./normalizePhone');

// Shared "create a new Lead from a call" field mapping — used by both
// POST /api/leads/from-call (leads.js) and the server-side lead find-or-create
// step in POST /api/calls/sync (callLogs.js), so a lead created either way
// looks identical regardless of which route triggered it.
async function createLeadFromCall({ actor, call, name, phone, email, source, assignedTo, status, note, followUpDate }) {
  return Lead.create({
    name: name || phone,
    phone: normalizePhone(phone) || phone,
    email,
    source: source || 'Call',
    assignedTo: assignedTo || actor._id,
    status: status || 'new',
    capturedBy: actor.name,
    callLogs: call ? [call._id] : [],
    // Every call that reaches here represents an actual attempted call — count it,
    // even though there's no prior Lead to increment.
    attempts: 1,
    connectedCallCount: call && call.duration > 0 ? 1 : 0,
    lastCallAt: call ? call.timestamp : new Date(),
    lastCallType: call ? call.callType : undefined,
    lastCallDuration: call ? (call.duration || 0) : 0,
    lastCallEmployee: actor.name,
    lastCallEmployeePhone: actor.phone || '',
    lastCallNote: note ? note.trim() : undefined,
    lastCallSummary: status,
    followUpDate: followUpDate ? new Date(followUpDate) : undefined,
    changelog: [{
      changedBy: actor._id,
      changedByName: actor.name,
      action: 'created',
      details: { source: 'from_call', callId: call ? call._id : undefined }
    }]
  });
}

module.exports = { createLeadFromCall };
