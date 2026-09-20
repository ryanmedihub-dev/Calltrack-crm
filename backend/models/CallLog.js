const mongoose = require('mongoose');

const callLogSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  callType: {
    type: String,
    enum: ['incoming', 'outgoing', 'missed', 'rejected'],
    required: true
  },
  contactNumber: { type: String, required: true },
  contactName:   { type: String, default: 'Unknown' },
  duration:      { type: Number, default: 0 },
  timestamp:     { type: Date, required: true },
  notes:         { type: String },
  callStatus:    { type: String, default: null },
  // Audit trail for remark edits — set every time `notes`/`callStatus` are changed through
  // PATCH /api/calls/:id/notes (dashboard inline edit or the mobile note modal), so reports
  // can show *when* a remark was last touched and by whom, not just its current text.
  // Null on calls whose remark was only ever set at sync time and never edited since.
  notesUpdatedAt:     { type: Date, default: null },
  notesUpdatedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notesUpdatedByName: { type: String, default: null },
  // Stable id generated once on-device (deterministic hash of number+timestamp) — lets sync
  // dedup on an id that never drifts across resyncs, instead of an exact timestamp match.
  clientCallId:  { type: String, default: null },
  leadId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
  synced:        { type: Boolean, default: true },
  createdAt:     { type: Date, default: Date.now }
});

callLogSchema.index({ employeeId: 1, timestamp: -1 });
callLogSchema.index({ timestamp: -1 });
callLogSchema.index({ contactNumber: 1 });
// Supports the "first ever contact" lookup used by the call history report
// (New/Repeat column) — matches on contactNumber with timestamp covered by
// the same index instead of scanning every historical call for that number.
callLogSchema.index({ contactNumber: 1, timestamp: 1 });
// Was a bare { leadId: 1 }. The call report's `source` filter resolves to a list of lead ids
// and then intersects it with the report's date range — with timestamp on the index that stays
// one ordered range walk per lead id, and the report's `sort({ timestamp: -1 })` comes free
// instead of a blocking sort. Every bare-leadId lookup still uses the prefix.
callLogSchema.index({ leadId: 1, timestamp: -1 });
// Legacy dedup key, now partial — scoped to only the rows that predate clientCallId
// (still null). Left unconditional, this collided with fresh inserts of a pre-existing
// call once it started carrying a clientCallId: the new upsert filter (below) no longer
// matches the old null-clientCallId row, so it's treated as an insert, and that insert's
// (employeeId, contactNumber, timestamp) exactly matches the old row — silently rejected
// by this index with every note/status update on that call lost. See migration script
// backend/scripts/migrateClientCallId.js, which must run once against the live DB (a
// schema change alone does not retroactively alter an already-built index).
callLogSchema.index(
  { employeeId: 1, contactNumber: 1, timestamp: 1 },
  { unique: true, partialFilterExpression: { clientCallId: null } }
);
// Primary dedup key going forward — partial so legacy rows without a clientCallId never
// collide with each other on `null`.
callLogSchema.index(
  { employeeId: 1, clientCallId: 1 },
  { unique: true, partialFilterExpression: { clientCallId: { $type: 'string' } } }
);

const CallLog = mongoose.model('CallLog', callLogSchema);

// Mongoose builds indexes in the background and swallows the error by default —
// this index previously failed to build silently (pre-existing duplicate data
// violated the uniqueness constraint) and nobody noticed. The /sync route no
// longer depends on this index for dedup, but surface build failures loudly so
// a missing index is never silently invisible again.
CallLog.on('index', (err) => {
  if (err) console.error('[CallLog] index build failed:', err.message);
});

module.exports = CallLog;
