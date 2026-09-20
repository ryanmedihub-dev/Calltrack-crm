// Engagement band derived purely from a call's duration and type. This replaces the manual
// status picker that used to live in the mobile post-call popup.
//
// WHY A SEPARATE FIELD AND NOT Lead.status
// Lead.status is the pipeline enum and is load-bearing in poolFilter.js (pool membership
// whitelist), retryQueue.js (priority tiers) and in the ryan-crm repo, which reads these
// statuses over HTTP. Writing derived values into it would silently re-tier leads in three
// systems at once. `engagement` is a parallel, derived-only track; status stays manual.
//
// WHY A NUMERIC SCORE ALONGSIDE THE LABEL
// Bands must only ever move UP. An agent who has a 6-minute call (HOT) and then a 10-second
// callback (LOW) has not cooled the lead off. Storing an ordinal lets the write be a plain
// $max inside the same update pipeline, with no read-then-decide race.

const BANDS = [
  { key: 'NOT_CONNECTED',   score: 0, label: 'Not Connected',   minSec: 0,   maxSec: 0   },
  { key: 'LOW',             score: 1, label: 'Low',             minSec: 1,   maxSec: 30  },
  { key: 'CONTACTED',       score: 2, label: 'Contacted',       minSec: 30,  maxSec: 60  },
  { key: 'ENGAGED',         score: 3, label: 'Engaged',         minSec: 60,  maxSec: 120 },
  { key: 'INTERESTED',      score: 4, label: 'Interested',      minSec: 120, maxSec: 180 },
  { key: 'WARM',            score: 5, label: 'Warm',            minSec: 180, maxSec: 300 },
  { key: 'HOT',             score: 6, label: 'Hot',             minSec: 300, maxSec: 480 },
  { key: 'HIGH_ENGAGEMENT', score: 7, label: 'High Engagement', minSec: 480, maxSec: Infinity },
];

const ENGAGEMENT_KEYS  = BANDS.map((b) => b.key);
const BAND_BY_KEY      = new Map(BANDS.map((b) => [b.key, b]));
const BAND_BY_SCORE    = new Map(BANDS.map((b) => [b.score, b]));

// Boundaries are [minSec, maxSec): a call of exactly 30s is CONTACTED, not LOW; exactly 60s is
// ENGAGED. Stated explicitly because "30-60 sec" in a spec is ambiguous at both ends.
//
// callType: a missed or rejected call never connected, whatever duration the device reports.
// Both incoming and outgoing count — an inbound call that ran 7 minutes is a hot lead.
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

module.exports = { BANDS, ENGAGEMENT_KEYS, BAND_BY_KEY, deriveEngagement, bandByScore };
