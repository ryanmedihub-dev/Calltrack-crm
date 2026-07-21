const mongoose = require('mongoose');

const downloadJobSchema = new mongoose.Schema({
  owner:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  label:      { type: String, required: true },
  filename:   { type: String, required: true },
  mimeType:   { type: String, default: 'text/csv' },
  // Empty/0 while status is 'processing' — the row is created before the file
  // content exists so the Downloads page has something to show immediately.
  content:    { type: String, default: '' },
  sizeBytes:  { type: Number, default: 0 },
  status:     { type: String, enum: ['processing', 'ready', 'failed'], default: 'ready' },
  error:      { type: String, default: null },
  createdAt:  { type: Date, default: Date.now },
  expiresAt:  { type: Date, required: true },
});

downloadJobSchema.index({ owner: 1, createdAt: -1 });
// Exact-timestamp TTL: Mongo's background monitor deletes the doc once wall-clock
// time passes the value stored in expiresAt (not N seconds after insertion).
downloadJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('DownloadJob', downloadJobSchema);
