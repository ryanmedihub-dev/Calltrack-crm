// Generic two-layer cache used by every cached read endpoint (see lib/reportCache.js for the
// report-tab-specific wrapper around this same engine).
//
// L1 (in-process, 10s): hot keys never touch the network. PM2 cluster mode means each worker
// keeps its own L1, so this alone doesn't fix the "N copies of the same cache" problem — L2 does.
// L2 (Redis, caller-supplied TTL): shared across every worker.
// Single-flight lock: on an L2 miss, the first worker to grab a short-lived Redis lock runs the
// producer and writes the result; every other concurrent caller (in this worker or another)
// polls for that result instead of also hitting Mongo. A stuck/dead lock holder is never a hang
// — a loser gives up polling after ~3s and just runs the producer itself.
//
// Fail-open: every Redis call funnels through lib/redis.js, which already no-ops when Redis is
// down. If `redis.isEnabled()` is false this whole thing degrades to L1-only, exactly as it
// behaved before Redis existed.
const redis = require('./redis');

const L1_TTL_MS = 10 * 1000;
const L1_MAX_ENTRIES = 500;
const LOCK_TTL_SEC = 30;
const LOCK_POLL_MS = 100;
const LOCK_POLL_MAX_MS = 3000;

const l1 = new Map();

function keyOf(parts) {
  return parts.map((p) => (p && typeof p === 'object' ? JSON.stringify(p) : String(p))).join('|');
}

function pruneL1() {
  const now = Date.now();
  for (const [k, v] of l1) if (v.expires <= now) l1.delete(k);
  // Map iterates in insertion order, so the front of the map is the oldest entry.
  while (l1.size > L1_MAX_ENTRIES) l1.delete(l1.keys().next().value);
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

/**
 * Run `producer()` at most once per `parts` key per `ttlSec` window, shared across every
 * PM2 worker via Redis (falling back to per-worker-only caching when Redis is unavailable).
 * @param {Array} parts       anything stringifiable; together they identify the result
 * @param {number} ttlSec     L2 (Redis) TTL in seconds
 * @param {() => Promise<any>} producer
 */
function cached(parts, ttlSec, producer) {
  const k = keyOf(parts);
  const l1Hit = l1.get(k);
  if (l1Hit && l1Hit.expires > Date.now()) return l1Hit.value;

  const run = (async () => {
    const rKey = redis.key('cache', k);

    if (!redis.isEnabled()) return producer();

    const fromRedis = await redis.get(rKey);
    if (fromRedis !== null) return fromRedis;

    const lockKey = redis.key('lock', k);
    const won = await redis.client.set(lockKey, '1', 'EX', LOCK_TTL_SEC, 'NX').catch(() => null);
    if (won === 'OK') {
      try {
        const value = await producer();
        await redis.set(rKey, value, ttlSec);
        return value;
      } finally {
        await redis.del(lockKey);
      }
    }

    // Lost the race — poll for the winner's result rather than also running the producer.
    const deadline = Date.now() + LOCK_POLL_MAX_MS;
    while (Date.now() < deadline) {
      await sleep(LOCK_POLL_MS);
      const val = await redis.get(rKey);
      if (val !== null) return val;
    }
    // Winner is slow, or died mid-flight and its lock hasn't expired yet — a stuck lock holder
    // must never become a hang for everyone else.
    return producer();
  })().catch((err) => {
    // A rejected producer is never cached, in either layer — L2 was never written above, and
    // this drops the failed promise from L1 so the very next call retries instead of replaying
    // the same rejection for the rest of the TTL window.
    l1.delete(k);
    throw err;
  });

  l1.set(k, { value: run, expires: Date.now() + L1_TTL_MS });
  pruneL1();
  return run;
}

// Evicts every cached entry whose key starts with `prefixParts` (L1 synchronously, L2 via
// SCAN). Call this at the end of a successful write handler, after the DB write resolves.
function invalidate(prefixParts) {
  const prefix = keyOf(prefixParts);
  for (const k of l1.keys()) {
    if (k === prefix || k.startsWith(`${prefix}|`)) l1.delete(k);
  }
  // Mirrors the `|`-joined key format above so this can't glob-match an unrelated key that
  // merely shares a textual prefix (e.g. invalidating "employees" must not also drop
  // "employeesTlNames" if such a key ever existed).
  return redis.delPattern(`cache:${prefix}|*`).then(() => redis.del(redis.key('cache', prefix)));
}

// Wipes every entry from L1 (this worker only) — Redis entries are left to expire on their own
// TTL. Exists for tests/local dev resets, not for production invalidation (use `invalidate`).
function clearL1() {
  l1.clear();
}

module.exports = { cached, invalidate, keyOf, clearL1 };
