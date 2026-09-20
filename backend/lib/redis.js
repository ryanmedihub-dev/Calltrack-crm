const Redis = require('ioredis');

// Single shared connection per worker. ioredis is the right client here (long-lived process
// on a VPS, not a serverless function) — the connection is reused for the life of the worker.
//
// FAIL-OPEN IS THE WHOLE DESIGN. Redis here is a speed layer over MongoDB, never a source of
// truth. If Redis is down, slow or misconfigured, every helper below falls through to the
// producer and the API keeps working at its old speed. It must never turn a cache miss into
// a 500.

const REDIS_URL = process.env.REDIS_URL || '';
// Bump this on any deploy that changes a cached payload's shape — it invalidates every key at
// once without a FLUSHDB, which would also wipe anything else on the instance.
const CACHE_VERSION = process.env.CACHE_VERSION || 'v1';
const PREFIX = `cb:${CACHE_VERSION}:`;

let client = null;
let healthy = false;

if (REDIS_URL) {
  client = new Redis(REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false, // fail fast instead of queueing while down
    connectTimeout: 3000,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });
  client.on('ready', () => { healthy = true; console.log('[redis] ready'); });
  client.on('end',   () => { healthy = false; });
  client.on('error', (err) => {
    healthy = false;
    // Throttle: a down Redis emits this continuously and would flood the logs.
    if (!client._loggedErrAt || Date.now() - client._loggedErrAt > 30000) {
      client._loggedErrAt = Date.now();
      console.error('[redis] error:', err.message);
    }
  });
} else {
  console.warn('[redis] REDIS_URL not set — caching disabled, all reads go straight to Mongo');
}

const isEnabled = () => !!client && healthy;
const key = (...parts) => PREFIX + parts.map((p) => (p && typeof p === 'object' ? JSON.stringify(p) : String(p))).join(':');

async function get(k) {
  if (!isEnabled()) return null;
  try { const raw = await client.get(k); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

async function set(k, value, ttlSec) {
  if (!isEnabled()) return;
  try { await client.set(k, JSON.stringify(value), 'EX', ttlSec); } catch {}
}

async function del(...keys) {
  if (!isEnabled() || !keys.length) return;
  try { await client.del(...keys); } catch {}
}

// Deletes by pattern using SCAN, never KEYS — KEYS blocks the whole Redis instance and this
// runs on user-facing write paths.
async function delPattern(pattern) {
  if (!isEnabled()) return;
  try {
    let cursor = '0';
    do {
      const [next, found] = await client.scan(cursor, 'MATCH', PREFIX + pattern, 'COUNT', 200);
      cursor = next;
      if (found.length) await client.del(...found);
    } while (cursor !== '0');
  } catch {}
}

module.exports = { client, isEnabled, key, get, set, del, delPattern, PREFIX, CACHE_VERSION };
