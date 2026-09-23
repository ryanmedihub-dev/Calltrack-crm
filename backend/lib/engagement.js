// Talk-time band derived purely from a call's duration and type. Drives Lead.status directly:
// the lead's status is the band of its BEST call so far (see lib/applyCallToLead.js).
//
// WHY A NUMERIC SCORE ALONGSIDE THE KEY
// Status must only ever move UP. An agent who has a 6-minute call (HOT) and then a 10-second
// callback (LOW) has not cooled the lead off. Storing an ordinal lets the write be a plain $max,
// with no read-then-decide race.
//
// Mirrored in the ryan-crm repo at src/lib/owner/engagementBands.js (Owner panel employee KPIs
// sum these bands). Keep both in sync.
const BANDS = [
  { key: 'NOT_CONNECTED',   score: 0, status: 'not_connected',   label: 'Not Connected',          minSec: 0,   maxSec: 0   },
  { key: 'LOW',             score: 1, status: 'low',             label: 'Low',                    minSec: 1,   maxSec: 30  },
  { key: 'CONTACTED',       score: 2, status: 'contacted',       label: 'Contacted',              minSec: 30,  maxSec: 60  },
  { key: 'ENGAGED',         score: 3, status: 'engaged',         label: 'Engaged',                minSec: 60,  maxSec: 120 },
  { key: 'INTERESTED',      score: 4, status: 'interested',      label: 'Interested',             minSec: 120, maxSec: 180 },
  { key: 'WARM',            score: 5, status: 'warm',            label: 'Warm / Strong Interest', minSec: 180, maxSec: 300 },
  { key: 'HOT',             score: 6, status: 'hot',             label: 'Hot',                    minSec: 300, maxSec: 480 },
  { key: 'HIGH_ENGAGEMENT', score: 7, status: 'high_engagement', label: 'High Engagement',        minSec: 480, maxSec: Infinity },
];

const ENGAGEMENT_KEYS = BANDS.map((b) => b.key);
const BAND_BY_KEY     = new Map(BANDS.map((b) => [b.key, b]));
const BAND_BY_SCORE   = new Map(BANDS.map((b) => [b.score, b]));

// The Lead.status values a call is allowed to write. `new` = never called.
const TALKTIME_STATUSES = BANDS.map((b) => b.status);
const AUTO_STATUSES     = ['new', ...TALKTIME_STATUSES];

// Set by a person. A call never overwrites these.
const MANUAL_STATUSES = ['follow_up', 'not_interested', 'booking_done', 'converted', 'lost'];

// The full Lead.status enum, in display order. Single source for the model, bulk upload,
// report labels and workforce stats — import this rather than retyping the list.
const ALL_LEAD_STATUSES = [...AUTO_STATUSES, ...MANUAL_STATUSES];

const STATUS_LABELS = {
  new: 'New',
  ...Object.fromEntries(BANDS.map((b) => [b.status, b.label])),
  follow_up: 'Follow Up',
  not_interested: 'Not Interested',
  booking_done: 'Booking Done',
  converted: 'Converted',
  lost: 'Lost',
};

// Boundaries are [minSec, maxSec): exactly 30s is CONTACTED, exactly 60s is ENGAGED.
// A missed or rejected call never connected, whatever duration the device reports.
// Incoming and outgoing both count — an inbound call that ran 7 minutes is a hot lead.
function deriveEngagement(call) {
  const type = call && call.callType;
  if (type === 'missed' || type === 'rejected') return BANDS[0];

  const sec = Math.max(0, Math.floor(Number(call && call.duration) || 0));
  if (sec <= 0) return BANDS[0];

  for (const band of BANDS) {
    if (sec >= band.minSec && sec < band.maxSec) return band;
  }
  return BANDS[BANDS.length - 1];
}

function bandByScore(score) {
  return BAND_BY_SCORE.get(Number(score)) || BANDS[0];
}

// Mongo $switch: engagementScore -> Lead.status. Used inside pipeline updates.
const STATUS_FROM_SCORE_EXPR = {
  $switch: {
    branches: BANDS.map((b) => ({ case: { $eq: ['$engagementScore', b.score] }, then: b.status })),
    default: 'not_connected',
  },
};

module.exports = {
  BANDS, ENGAGEMENT_KEYS, BAND_BY_KEY, deriveEngagement, bandByScore,
  TALKTIME_STATUSES, AUTO_STATUSES, MANUAL_STATUSES, ALL_LEAD_STATUSES, STATUS_LABELS,
  STATUS_FROM_SCORE_EXPR,
};
