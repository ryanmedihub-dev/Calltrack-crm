const mongoose = require('mongoose');

const callScriptSchema = new mongoose.Schema({
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:     { type: String, required: true },
  category:  { type: String, default: 'Custom' },
  content:   { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

callScriptSchema.index({ managerId: 1, createdAt: -1 });

module.exports = mongoose.model('CallScript', callScriptSchema);
