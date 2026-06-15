const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String },
  action:   { type: String, required: true },
  entity:   { type: String },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  details:  { type: Object },
  ip:       { type: String },
  createdAt:{ type: Date, default: Date.now }
});

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
