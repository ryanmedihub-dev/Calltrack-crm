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
  city:        { type: String },

  // Open-lead-pool timing. Membership itself is NOT a stored flag — "in the pool" means
  // `assignedTo: null`, so a lead can never be simultaneously pooled and owned, and every
  // already-unassigned lead joins the pool with no migration. These two fields carry only
  // the timing that nothing else on the document records.
  pooledAt:  { type: Date, default: null },
  claimedAt: { type: Date, default: null },
  claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // How many times this lead has been returned to the pool by the recycler. Capped by
  // MAX_RECYCLES, after which the lead stays with whoever holds it.
  recycleCount:  { type: Number, default: 0 },
  lastRecycledAt:{ type: Date,   default: null },
  // Set once recycleCount hits the cap, or manually by a manager who wants a lead to stop
  // circulating. Checked as its own flag rather than re-deriving from recycleCount every sweep,
  // so a manager can pin a lead without inflating its recycle history.
  recycleLocked: { type: Boolean, default: false },

  // Form answers that have no first-class column — Meta lead forms carry different questions
  // per campaign, so this is deliberately schema-less. Stored as an ordered ARRAY of
  // {label, value}, not an object: Meta returns fields in the order they were asked, and that
  // is the order that reads naturally to an agent scanning the lead mid-dial. A plain object
  // would let Mongo/JS key ordering decide, and a Map would sort them.
  extraDetails: [{
    _id:   false,
    label: { type: String },
    value: { type: String },
  }],

  // Provenance for a lead that came from an ad platform. Kept separate from extraDetails so it
  // is never rendered as a qualification answer to an agent.
  metaRef: {
    leadgenId:   { type: String, index: true, sparse: true },
    formId:      { type: String },
    pageId:      { type: String },
    adId:        { type: String },
    createdTime: { type: Date },
  },
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
// The pool listing, polled by every agent's phone every 12s — easily the hottest query in the
// system once the tab is in use. Without the sort key in the index, each poll re-sorts the
// entire unassigned set in memory.
leadSchema.index({ assignedTo: 1, pooledAt: -1 });
// Backs the "attended today" counter on the pool stats endpoint.
leadSchema.index({ claimedAt: -1 });
// Backs the recycle sweep, which runs every few minutes for the life of the process against
// every claimed lead — this must stay an index range scan, never a collection scan.
leadSchema.index({ recycleLocked: 1, claimedAt: 1 });
// Backs GET /api/leads/retry-queue's `{assignedTo: {$ne: null}, status: {$in: [...]}}` filter —
// an owner-panel query expected to run against the whole leads collection as it grows.
leadSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('Lead', leadSchema);
