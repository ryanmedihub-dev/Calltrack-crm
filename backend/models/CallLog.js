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
  leadId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
  synced:        { type: Boolean, default: true },
  createdAt:     { type: Date, default: Date.now }
});

callLogSchema.index({ employeeId: 1, timestamp: -1 });
callLogSchema.index({ timestamp: -1 });
callLogSchema.index({ contactNumber: 1 });
// Supports the "first ever contact" lookup used by the calls CSV export
// (New/Repeat column) — an indexed { $sort: timestamp, $limit: 1 } per
// contact number instead of scanning every historical call for that number.
callLogSchema.index({ contactNumber: 1, timestamp: 1 });
callLogSchema.index({ leadId: 1 });
// Prevents duplicate entries when the mobile retries a sync
callLogSchema.index({ employeeId: 1, contactNumber: 1, timestamp: 1 }, { unique: true });

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
