const mongoose = require('mongoose');

const changelogSchema = new mongoose.Schema({
  changedAt:     { type: Date, default: Date.now },
  changedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  changedByName: { type: String },
  action:        { type: String }, // 'created', 'call_linked', 'status_changed', 'note_added', 'assigned', 'updated'
  details:       { type: mongoose.Schema.Types.Mixed }
}, { _id: true });

const leadSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  phone:      { type: String, required: true, unique: true },
  email:      { type: String },
  source:     { type: String },
  tags:       [{ type: String }],
  status: {
    type: String,
    enum: ['new', 'contacted', 'not_connected', 'interested', 'not_interested', 'follow_up', 'booking_done', 'converted', 'lost'],
    default: 'new'
  },
  assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  capturedBy:  { type: String },
  importedBy:  { type: String },
  callLogs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CallLog' }],
  changelog: [changelogSchema],
  attempts:             { type: Number, default: 0 },
  lastCallAt:           { type: Date },
  lastCallType:         { type: String },
  lastCallDuration:     { type: Number, default: 0 },
  lastCallNote:         { type: String },
  lastCallSummary:      { type: String },
  lastCallEmployee:     { type: String },
  lastCallEmployeePhone:{ type: String },
  connectedCallCount:   { type: Number, default: 0 },

  followUpDate:    { type: Date },
  tagAssignedDate: { type: Date },
  createdAt:       { type: Date, default: Date.now }
});

leadSchema.index({ status: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ phone: 1 });
leadSchema.index({ tags: 1 });
leadSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Lead', leadSchema);
