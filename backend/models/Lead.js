const mongoose = require('mongoose');
const { ENGAGEMENT_KEYS } = require('../lib/engagement');

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
  // When and how the current owner was set. `first_call` = the lead's first attempt claimed it
  // (lib/applyCallToLead.js); `manual` = a manager set it. Informational — nothing reads it
  // to make a decision.
  assignedAt:  { type: Date, default: null },
  assignedVia: { type: String, enum: ['first_call', 'manual', null], default: null },
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

  // Highest engagement band ever reached on this lead, derived from its calls. Monotonic:
  // see lib/engagement.js for why it only moves up. Parallel to `status`, never a substitute.
  engagement:          { type: String, enum: ENGAGEMENT_KEYS, default: null },
  engagementScore:     { type: Number, default: 0 },
  engagementUpdatedAt: { type: Date, default: null },
  // The band of the MOST RECENT call, which can be lower than `engagement`. Kept separately so
  // a manager can see "was hot, last call was a 5-second no-answer" — the monotonic field alone
  // hides that.
  lastCallEngagement:  { type: String, enum: ENGAGEMENT_KEYS, default: null },

  followUpDate:    { type: Date },
  tagAssignedDate: { type: Date },
  createdAt:       { type: Date, default: Date.now }
});

// These two were bare { status: 1 } / { assignedTo: 1 }. Both were already redundant as
// prefixes of the compound indexes further down, so extending each with `createdAt` costs
// nothing in index count and removes a blocking in-memory sort from the lead report's row
// tabs (notConnected / leadList), which filter on status or assignee and sort by createdAt.
leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ assignedTo: 1, createdAt: -1 });
leadSchema.index({ phone: 1 });
// `source` is filtered with a case-insensitive regex by both the lead report and the call
// report (which resolves source -> lead ids first). An unanchored regex cannot seek, but with
// this index Mongo scans index keys instead of every lead document — and Lead documents are
// fat (changelog, callLogs, extraDetails), so the difference is large.
leadSchema.index({ source: 1, createdAt: -1 });
leadSchema.index({ tags: 1 });
leadSchema.index({ createdAt: -1 });
// The pool listing, polled by every agent's phone every 12s — easily the hottest query in the
// system once the tab is in use. Without the sort key in the index, each poll re-sorts the
// entire unassigned set in memory.
leadSchema.index({ assignedTo: 1, pooledAt: -1 });
// The pool listing's sort since it became least-worked-first. Key order is
// equality (assignedTo) -> EVERY sort key in order -> filter (status), which is the only
// arrangement that lets Mongo read rows already ordered:
//   - `status` is an $in (a multi-range), so putting it before the sort keys forces a blocking
//     in-memory sort of the whole pool on every poll — measured at 4,823 docs examined and
//     ~160ms server-side, versus 30 docs and ~3ms this way. It sits last, where it is still
//     checked straight off the index key without fetching the document.
//   - `createdAt` must be here even though it is only a tiebreaker: omit any sort key and the
//     index can no longer provide the ordering, and the blocking sort comes straight back.
leadSchema.index({ assignedTo: 1, attempts: 1, pooledAt: -1, createdAt: -1, status: 1 }, { name: 'pool_attempts_order' });
// Backs the "attended today" counter on the pool stats endpoint.
leadSchema.index({ claimedAt: -1 });
// Backs the recycle sweep, which runs every few minutes for the life of the process against
// every claimed lead — this must stay an index range scan, never a collection scan.
leadSchema.index({ recycleLocked: 1, claimedAt: 1 });
// Backs GET /api/leads/retry-queue's `{assignedTo: {$ne: null}, status: {$in: [...]}}` filter —
// an owner-panel query expected to run against the whole leads collection as it grows.
leadSchema.index({ assignedTo: 1, status: 1 });
// The retry-queue priority tiers each pair `status` with one date field, so these two let each
// $or branch resolve as an index range instead of scanning every lead of that status:
//   P0 — status 'interested' + followUpDate in the past
//   P1/P3 — status 'contacted'/'not_connected' + a lastCallAt cutoff
// NOTE: no { createdAt: 1 } here, and no { employeeId: 1, timestamp: 1 } on CallLog — the
// existing { createdAt: -1 } / { employeeId: 1, timestamp: -1 } already serve those. Index key
// direction only matters for sort order; a range filter walks an index equally well either way,
// so the ascending twins would be pure write-amplification on a collection this size.
leadSchema.index({ status: 1, followUpDate: 1 });
leadSchema.index({ status: 1, lastCallAt: 1 });
leadSchema.index({ engagementScore: -1, createdAt: -1 });
leadSchema.index({ engagement: 1, createdAt: -1 });

module.exports = mongoose.model('Lead', leadSchema);
