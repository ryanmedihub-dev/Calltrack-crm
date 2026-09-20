// How long the post-call popup stays alive before auto-skipping itself, and how long a
// stored-but-not-yet-shown pending call is allowed to sit before being treated as stale.
// Shared between PostCallScreen.js (the timer that closes the popup) and App.js (the
// persisted-pending-call expiry) so both agree on the same window.
export const AUTO_SKIP_MS = 2 * 60 * 1000;

// Mirrors backend/config/features.js. Hardcoded rather than env-driven: EAS builds don't
// reliably surface Constants.expoConfig, same reason src/lib/api.js hardcodes API_URL.
export const FEATURES = {
  LEAD_POOL: false,
  // The post-call status picker is replaced by server-derived engagement bands — see
  // ENGAGEMENT_BANDS below and backend/lib/engagement.js. Kept behind a flag (code intact,
  // not deleted) rather than removed, same convention as every other switch in this file.
  MANUAL_STATUS_PICKER: false,
};

// Mirrors backend/lib/engagement.js's BANDS — thresholds must only ever change in both places
// together. Used to show the agent a read-only "HOT — 6m 12s" preview in the post-call popup;
// the server is still the source of truth (this is a preview of what the sync is about to send,
// not a value the client submits).
export const ENGAGEMENT_BANDS = [
  { key: 'NOT_CONNECTED',   label: 'Not Connected',   minSec: 0,   maxSec: 0,   color: '#94A3B8', bg: '#F1F5F9' },
  { key: 'LOW',             label: 'Low',             minSec: 1,   maxSec: 30,  color: '#64748B', bg: '#F1F5F9' },
  { key: 'CONTACTED',       label: 'Contacted',       minSec: 30,  maxSec: 60,  color: '#1A6BFF', bg: '#EBF2FF' },
  { key: 'ENGAGED',         label: 'Engaged',         minSec: 60,  maxSec: 120, color: '#0EA5E9', bg: '#E0F2FE' },
  { key: 'INTERESTED',      label: 'Interested',      minSec: 120, maxSec: 180, color: '#16A34A', bg: '#DCFCE7' },
  { key: 'WARM',            label: 'Warm',             minSec: 180, maxSec: 300, color: '#D97706', bg: '#FEF3C7' },
  { key: 'HOT',             label: 'Hot',             minSec: 300, maxSec: 480, color: '#EA580C', bg: '#FFEDD5' },
  { key: 'HIGH_ENGAGEMENT', label: 'High Engagement', minSec: 480, maxSec: Infinity, color: '#DC2626', bg: '#FEE2E2' },
];

// Local mirror of backend deriveEngagement() — missed/rejected never connected, whatever
// duration the device reports; both incoming and outgoing count.
export function deriveEngagementLocal(callType, duration) {
  if (callType === 'missed' || callType === 'rejected') return ENGAGEMENT_BANDS[0];
  const sec = Math.max(0, Math.floor(Number(duration) || 0));
  if (sec <= 0) return ENGAGEMENT_BANDS[0];
  for (const band of ENGAGEMENT_BANDS) {
    if (sec >= band.minSec && sec < band.maxSec) return band;
  }
  return ENGAGEMENT_BANDS[ENGAGEMENT_BANDS.length - 1];
}
