// How long the post-call popup stays alive before auto-skipping itself, and how long a
// stored-but-not-yet-shown pending call is allowed to sit before being treated as stale.
// Shared between PostCallScreen.js (the timer that closes the popup) and App.js (the
// persisted-pending-call expiry) so both agree on the same window.
export const AUTO_SKIP_MS = 2 * 60 * 1000;
