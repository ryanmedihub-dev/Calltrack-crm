// Cache for the read-only report-tab aggregations in routes/reports.js.
//
// Report pages are re-filtered and re-polled far more often than call/lead data actually
// changes, and every miss costs a full index scan + group over the whole date range. Within
// the TTL an identical (route, params) request replays the previous result instead of
// re-running Mongo.
//
// WHAT CHANGED AND WHY
// This used to be a bare in-process Map and stayed that way deliberately — a shared cache was
// called "a new runtime dependency for a win this size". That calculus changes under PM2
// cluster mode: the API runs as N worker processes, so an in-process-only cache is really N
// separate caches, one per worker, each with its own cold-start and its own copy of every hot
// key. The report aggregations this backs are also the most expensive queries in the system.
// So this is now a thin wrapper around lib/cache.js's shared two-layer (in-process + Redis)
// cache — the public API below (`memo(parts, producer)`) is unchanged, and its two call sites
// in routes/reports.js needed no changes at all.
const cache = require('./cache');

const TTL_MS = 45 * 1000; // kept as the name existing code may still read
const TTL_SEC = TTL_MS / 1000;

/**
 * Run `producer()` at most once per `parts` key per TTL window, shared across every PM2 worker.
 * @param {Array} parts  anything stringifiable; together they identify the result
 * @param {() => Promise<any>} producer
 */
function memo(parts, producer) {
  return cache.cached(parts, TTL_SEC, producer);
}

// Evicts every memoized entry whose key starts with `prefixParts` — e.g.
// reportCache.invalidate(['periodic']) after a write that could change any report tab's answer.
memo.invalidate = (prefixParts) => cache.invalidate(prefixParts);

// Kept for compatibility with anything that still imports `clear` directly — clears every
// memoized entry in THIS worker's L1 only (Redis entries expire on their own TTL; SCAN + DEL is
// unnecessary for what `clear()` was ever used for, which is tests/local dev resets). Note this
// clears the whole shared L1, not just report entries — matches the old bare-Map behavior.
function clear() {
  cache.clearL1();
}

module.exports = { memo, clear, TTL_MS };
