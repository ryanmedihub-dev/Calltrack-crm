// Short-TTL in-process memo for the read-only report aggregations.
//
// Report pages are re-filtered and re-polled far more often than call/lead data actually
// changes, and every miss costs a full index scan + group over the whole date range. Within
// the TTL an identical (route, params) request replays the previous result instead of
// re-running Mongo.
//
// The *promise* is cached, not the resolved value, so two managers opening the same report
// at once — or one user double-clicking Refresh — collapse into a single aggregation rather
// than two concurrent scans of the same range. A rejection is evicted immediately so a
// transient Mongo error is never served for the rest of the window.
//
// Deliberately in-process and tiny: reports tolerate a few seconds of staleness, and a shared
// cache (Redis) would be a new runtime dependency for a win this size. On a multi-instance
// deploy each instance simply keeps its own copy.
const TTL_MS = 45 * 1000;
const MAX_ENTRIES = 400;

const store = new Map();

function keyOf(parts) {
  return parts
    .map((p) => (p && typeof p === 'object' ? JSON.stringify(p) : String(p)))
    .join('|');
}

function prune() {
  const now = Date.now();
  for (const [k, v] of store) if (v.expires <= now) store.delete(k);
  // Map iterates in insertion order, so the front of the map is the oldest entry.
  while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value);
}

/**
 * Run `producer()` at most once per `parts` key per TTL window.
 * @param {Array} parts  anything stringifiable; together they identify the result
 * @param {() => Promise<any>} producer
 */
function memo(parts, producer) {
  const key = keyOf(parts);
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const value = producer().catch((err) => {
    store.delete(key);
    throw err;
  });
  store.set(key, { value, expires: Date.now() + TTL_MS });
  prune();
  return value;
}

function clear() {
  store.clear();
}

module.exports = { memo, clear, TTL_MS };
