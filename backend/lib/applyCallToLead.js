const Lead = require('../models/Lead');
const CallLog = require('../models/CallLog');
const { deriveEngagement, AUTO_STATUSES, STATUS_FROM_SCORE_EXPR } = require('./engagement');

// The whole call -> lead rule, in one place. Called from POST /api/calls/sync for every
// synced call whose number matches a Lead.
//
// THE RULE (as specified by the owner — keep it this simple):
//   - First attempt on the lead, or the lead has no owner  -> the caller becomes the owner.
//   - Any later attempt                                     -> owner unchanged.
//   - Either way, the lead's call data is updated from the call.
//   - No sweep, no pool, no retry, no system reassignment anywhere else.
//
// WHAT COUNTS AS AN ATTEMPT
// An outgoing call (any duration — dialling is the attempt), or an incoming call that
// connected. A missed or rejected incoming call is the customer ringing an agent who did
// not pick up: it is linked to the lead and shown in its history, but it is not the agent's
// attempt and must never make them the owner.
function countsAsAttempt(call) {
  if (call.callType === 'outgoing') return true;
  if (call.callType === 'incoming') return (call.duration || 0) > 0;
  return false;
}

function ms(d) { return d ? new Date(d).getTime() : 0; }

/**
 * @param {object} args
 * @param {object} args.log           CallLog document (fresh from CallLog.find in /sync)
 * @param {object} args.lead          Lead document matched by phone
 * @param {object} args.user          req.user (the agent who synced the call)
 * @param {string|Date|undefined} args.followUpDate  from the sync payload, if any
 */
async function applyCallToLead({ log, lead, user, followUpDate }) {
  if (!log.leadId) return linkNewCall({ log, lead, user, followUpDate });
  if (String(log.leadId) !== String(lead._id)) return; // linked to a different lead by a manager — leave it
  return propagateUpdates({ log, lead, user, followUpDate });
}

// ── First time this call meets its lead ─────────────────────────────────────
async function linkNewCall({ log, lead, user, followUpDate }) {
  // Claim the call first, conditionally. Two overlapping syncs of the same call (Save's
  // forced sync + the routine resync) both see leadId: null; only one can win this write, so
  // the attempt is counted exactly once.
  const claim = await CallLog.updateOne(
    { _id: log._id, leadId: null },
    { $set: { leadId: lead._id, leadSyncedAt: log.notesUpdatedAt || null, leadSyncedDuration: log.duration || 0 } }
  );
  if (!claim.modifiedCount) return; // the other sync got it

  const band = deriveEngagement(log);
  const isAttempt = countsAsAttempt(log);
  const note = (log.notes || '').trim();

  const set = {
    lastCallAt:            log.timestamp,
    lastCallType:          log.callType,
    lastCallDuration:      log.duration || 0,
    lastCallEmployee:      user.name,
    lastCallEmployeePhone: user.phone || '',
    lastCallEngagement:    band.key,
  };
  if (note) set.lastCallNote = note;
  if (log.callStatus) set.lastCallSummary = log.callStatus;
  if (followUpDate) set.followUpDate = new Date(followUpDate);

  const inc = {};
  if (isAttempt) inc.attempts = 1;
  if ((log.duration || 0) > 0) inc.connectedCallCount = 1;

  const linkEntry = {
    changedBy: user._id, changedByName: user.name, action: 'call_linked',
    details: { callType: log.callType, duration: log.duration || 0, timestamp: log.timestamp, notes: note || null, engagement: band.key },
  };

  const baseUpdate = {
    $set: set,
    $max: { engagementScore: band.score },
    $addToSet: { callLogs: log._id },
  };
  if (Object.keys(inc).length) baseUpdate.$inc = inc; // an empty $inc is a Mongo error

  let assigned = false;
  if (isAttempt) {
    // Claim the LEAD in the same single write that counts the attempt: matches only while
    // attempts is still 0 or nobody owns it. Race-free — two agents syncing their first call
    // to the same lead at once cannot both become owner; whoever's write lands first wins.
    const claimed = await Lead.updateOne(
      { _id: lead._id, $or: [{ attempts: { $in: [0, null] } }, { assignedTo: null }] },
      {
        ...baseUpdate,
        $set: { ...set, assignedTo: user._id, assignedAt: new Date(), assignedVia: 'first_call' },
        $push: { changelog: { $each: [linkEntry, {
          changedBy: user._id, changedByName: user.name, action: 'assigned_on_first_call',
          details: { to: user._id, toName: user.name, previousAssignedTo: lead.assignedTo || null },
        }] } },
      }
    );
    assigned = claimed.modifiedCount > 0;
  }

  if (!assigned) {
    // Later attempt, or a missed/rejected call: update the data, never the owner.
    await Lead.updateOne({ _id: lead._id }, { ...baseUpdate, $push: { changelog: linkEntry } });
  }

  await settleEngagementAndStatus(lead._id, band, log.timestamp);
}

// ── Call already linked; the agent's Save (or a healed duration) arrived later ──
async function propagateUpdates({ log, lead, user, followUpDate }) {
  const notesChanged   = ms(log.notesUpdatedAt) > ms(log.leadSyncedAt);
  const durationHealed = (log.duration || 0) > (log.leadSyncedDuration || 0);
  if (!notesChanged && !durationHealed) return; // routine resync, nothing new — no write

  // Only the lead's most recent call may overwrite its "last call" fields. Editing the remark
  // on yesterday's call must not replace today's remark on the lead.
  const isLatestCall = ms(log.timestamp) >= ms(lead.lastCallAt);

  const set = {};
  const update = {};

  if (notesChanged) {
    if (isLatestCall) {
      set.lastCallNote = (log.notes || '').trim();
      if (log.callStatus) set.lastCallSummary = log.callStatus;
    }
    // The follow-up is only taken on a Save (notesChanged), never on a routine resync —
    // otherwise a follow-up a manager changed on the dashboard would be overwritten back by
    // the app re-sending the same call all day.
    if (followUpDate) set.followUpDate = new Date(followUpDate);
    update.$push = { changelog: {
      changedBy: user._id, changedByName: user.name, action: 'call_note_updated',
      details: { notes: (log.notes || '').trim() || null, followUpDate: followUpDate || null, callTimestamp: log.timestamp },
    } };
  }

  let band = null;
  if (durationHealed) {
    band = deriveEngagement(log);
    update.$max = { engagementScore: band.score };
    if (isLatestCall) {
      set.lastCallDuration = log.duration || 0;
      set.lastCallEngagement = band.key;
    }
    // First time this call shows any duration: it connected after all.
    if (!(log.leadSyncedDuration > 0)) update.$inc = { connectedCallCount: 1 };
  }

  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(update).length) await Lead.updateOne({ _id: lead._id }, update);

  await CallLog.updateOne(
    { _id: log._id },
    { $set: { leadSyncedAt: log.notesUpdatedAt || log.leadSyncedAt || null, leadSyncedDuration: Math.max(log.duration || 0, log.leadSyncedDuration || 0) } }
  );

  if (band) await settleEngagementAndStatus(lead._id, band, log.timestamp);
}

// Label follows the $max'd score (a string can't be $max'd), then status follows the label —
// but only for statuses the system owns (AUTO_STATUSES). Two small filtered writes; each is a
// no-op unless it changes something.
async function settleEngagementAndStatus(leadId, band, at) {
  await Lead.updateOne(
    { _id: leadId, $or: [{ engagement: null }, { engagementScore: { $lte: band.score } }] },
    { $set: { engagement: band.key, engagementUpdatedAt: at } }
  );
  await Lead.updateOne(
    { _id: leadId, status: { $in: AUTO_STATUSES } },
    [{ $set: { status: STATUS_FROM_SCORE_EXPR } }]
  );
}

module.exports = { applyCallToLead, countsAsAttempt, AUTO_STATUSES };
