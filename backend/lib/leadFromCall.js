const Lead = require('../models/Lead');
const normalizePhone = require('./normalizePhone');
const { BANDS } = require('./engagement');

// Shared "create a new Lead from a call" field mapping — used by both
// POST /api/leads/from-call (leads.js) and the server-side lead find-or-create
// step in POST /api/calls/sync (callLogs.js), so a lead created either way
// looks identical regardless of which route triggered it.
async function createLeadFromCall({
  actor, call, name, phone, email, source, assignedTo, status, note, followUpDate,
  engagement, engagementScore, lastCallEngagement, engagementUpdatedAt,
}) {
  return Lead.create({
    name: name || phone,
    phone: normalizePhone(phone) || phone,
    email,
    source: source || 'Call',
    assignedTo: assignedTo || actor._id,
    // A lead born from a call is that caller's first attempt, so the same rule as any other
    // first-call claim in lib/applyCallToLead.js applies.
    assignedAt: new Date(),
    assignedVia: 'first_call',
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
    // Defaults to NOT_CONNECTED (see lib/engagement.js) when the caller (POST /api/leads/from-call,
    // which predates the engagement feature) doesn't pass these.
    engagement: engagement || BANDS[0].key,
    engagementScore: engagementScore != null ? engagementScore : BANDS[0].score,
    lastCallEngagement: lastCallEngagement || BANDS[0].key,
    engagementUpdatedAt: engagementUpdatedAt || new Date(),
    changelog: [{
      changedBy: actor._id,
      changedByName: actor.name,
      action: 'created',
      details: { source: 'from_call', callId: call ? call._id : undefined }
    }]
  });
}

module.exports = { createLeadFromCall };
