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
callLogSchema.index({ leadId: 1 });
// Prevents duplicate entries when the mobile retries a sync
callLogSchema.index({ employeeId: 1, contactNumber: 1, timestamp: 1 }, { unique: true });

module.exports = mongoose.model('CallLog', callLogSchema);
