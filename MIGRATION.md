# Migration — remark last-write-wins + Live Data lead pool

Run these in order. Steps 1–3 are backend/infra and can go out ahead of the app; step 4 is the
new APK.

---

## 1. Backfill `pooledAt` for existing unassigned leads

Every lead that is already unassigned becomes a pool member the moment this deploys (pool
membership *is* `assignedTo: null`). Without a `pooledAt` they'd all sort last, so seed it from
`createdAt`:

```js
db.leads.updateMany(
  { assignedTo: null, pooledAt: null },
  [{ $set: { pooledAt: "$createdAt" } }]
)
```

Aggregation-pipeline form (note the `[ ... ]`) — it copies each document's own `createdAt`
rather than stamping one fixed value across all of them.

Safe to re-run: the filter excludes rows that already have a `pooledAt`.

## 2. Build the two new indexes

Both are declared in `backend/models/Lead.js` and Mongoose will create them on boot, but on a
large collection do it explicitly in the background first so the app doesn't block:

```js
db.leads.createIndex({ assignedTo: 1, pooledAt: -1 }, { background: true })
db.leads.createIndex({ claimedAt: -1 },               { background: true })
```

`{ assignedTo, pooledAt }` backs the pool listing — the hottest query in the system once agents
use the tab (every phone polls it every 12s). Without the sort key in the index every poll
re-sorts the entire unassigned set in memory.

## 3. New env vars (`backend/.env`)

Both have been added to `.env` as empty placeholders — fill them in before pointing Meta at the
webhook:

```
META_WEBHOOK_TOKEN=<long random string>   # shared secret, sent as X-Webhook-Token
META_VERIFY_TOKEN=<value from Meta's webhook setup>
```

**Both default closed.** While `META_WEBHOOK_TOKEN` is unset, `POST /api/lead-pool/meta-webhook`
returns 503 and accepts nothing — it never falls open to anonymous writes.

## 3b. Meta "extra details" (Part D)

`extraDetails` and `metaRef` are additive — no backfill needed. Existing leads simply have an
empty `extraDetails` array and render no details section.

Mongoose creates the sparse index on `metaRef.leadgenId` on boot; on a large collection build it
explicitly first:

```js
db.leads.createIndex({ "metaRef.leadgenId": 1 }, { sparse: true, background: true })
```

Sparse so the overwhelming majority of leads (no Meta provenance) stay out of the index.

**Duplicate-phone behaviour changed slightly.** A re-delivered webhook still never re-pools or
re-assigns an existing lead, but it now fills in `extraDetails` *when the existing lead has
none*. The `$or: [{ $size: 0 }, { $exists: false }]` guard means an existing set of answers is
never overwritten, so repeated deliveries are idempotent.

## 4. Ship a new APK

The mobile fixes (remark last-write-wins, popup retry schedule, immediate sync-on-save) need a
new build.

The backend is **backwards-compatible with the currently-installed app**: a sync payload with no
`notesUpdatedAt` falls back to the call's own timestamp, so an old client always *loses* a remark
race against a newer dashboard edit rather than clobbering it. That's the safe direction, but
until the new APK is out, old clients will keep losing their own remark races the way they do
today.

## 5. Pause the Live Data / lead pool feature

The open lead pool is paused but not removed — see `backend/config/features.js`. Nothing to
migrate: the flag defaults to `false` (closed) and every route/table it gates stays in the code.

```
FEATURE_LEAD_POOL=false                  # backend/.env
NEXT_PUBLIC_FEATURE_LEAD_POOL=false      # dashboard/.env.local
```

Mobile's copy is hardcoded in `mobile/src/constants.js` (`FEATURES.LEAD_POOL`) rather than
env-driven — same reason `src/lib/api.js` hardcodes `API_URL` there (EAS builds don't reliably
surface `Constants.expoConfig`). Flipping the mobile flag needs a new build; the backend and
dashboard flags take effect on restart/redeploy alone.

The recycle sweep (`LEAD_POOL_RECYCLE_SWEEP`) is derived from `LEAD_POOL` and can't be enabled
independently — see the comment in `config/features.js` for why. The auto-assign sweep keeps
running regardless of this flag.

## 6. Engagement bands (call duration → derived status)

Additive schema changes — no backfill is required for the app to boot or for new calls to work,
but existing rows won't have an `engagement` until backfilled:

```js
db.calllogs.createIndex({ engagement: 1, timestamp: -1 }, { background: true })
db.leads.createIndex({ engagementScore: -1, createdAt: -1 }, { background: true })
db.leads.createIndex({ engagement: 1, createdAt: -1 },       { background: true })
```

Then backfill existing rows (dry run first):

```
node backend/scripts/backfillEngagement.js            # report only, writes nothing
node backend/scripts/backfillEngagement.js --apply    # writes
```

Safe to re-run — the second run should report zero changes if the first `--apply` completed.

New env var, defaults closed:

```
FEATURE_AUTO_LEAD_CREATE_ON_CALL=false
```

With this off (the shipped default), calling an unknown number never creates a Lead — only
`engagement`/`engagementScore` on the CallLog itself. Turning it on is a deliberate, separate
decision; see the comment in `config/features.js` for why the default is off.

**`Lead.status` is untouched by this feature.** No existing status value, enum, or the manual
post-call status picker's behavior for app builds that still send `callStatus` changes — it's
simply no longer *read* to drive `Lead.status`. `lib/poolFilter.js`, `routes/retryQueue.js`,
`routes/reports.js`, and `ryan-crm` (a separate repo, reads over HTTP) keep working unmodified.

## 7. Redis (caching + rate limiting)

Optional but recommended once traffic runs under PM2 cluster mode — see `backend/lib/redis.js`.
**Everything in this app fails open**: with `REDIS_URL` unset (the state before this step),
every endpoint behaves exactly as it did before Redis existed. Nothing here is a hard dependency.

On the VPS:

```
sudo apt install redis-server
```

Edit `/etc/redis/redis.conf`:

```
bind 127.0.0.1          # never expose this port publicly
maxmemory 256mb          # size to what the box can spare — this is a cache, not a database
maxmemory-policy allkeys-lru
appendonly no            # persistence is wasted IO for a cache that can be rebuilt from Mongo
```

Restart Redis, then set in `backend/.env`:

```
REDIS_URL=redis://127.0.0.1:6379
CACHE_VERSION=v1
DEBUG_SYNC_SKIPS=0       # set to 1 temporarily to log the sync-fingerprint skip ratio
```

`CACHE_VERSION` namespaces every key this app writes (`cb:<version>:...`). Bump it on any deploy
that changes a cached payload's shape — that invalidates every key at once without a `FLUSHDB`,
which would also wipe anything else sharing the instance.

No manual index/schema step is needed beyond this — Redis here holds nothing that isn't
reconstructable from Mongo, so there's nothing to backfill.

`npm install` in `backend/` picks up the two new dependencies (`ioredis`, `rate-limit-redis`).
**Note on `rate-limit-redis`:** pinned to `^4.3.1`, not the latest major — the current major
requires `express-rate-limit >= 8`, which this repo doesn't run and which would have meant an
unrelated, riskier upgrade just to add caching. `4.3.1` supports `express-rate-limit >= 6`, which
covers the `^7.1.5` already installed here.

---

## Rollback

- Steps 1–2 are additive (a new field and two indexes); nothing reads them destructively, so
  rolling the code back leaves harmless extra data.
- The `/sync` route changed from `$set`/`$setOnInsert` operators to an aggregation-pipeline
  update. Reverting the code reverts the write behaviour immediately — no data shape changed,
  only which value wins on conflict.
- `CallLog.notesUpdatedAt/By/ByName` were introduced in an earlier change and are only added to,
  never required.
- Step 5 (Live Data pause) is a flag flip — set `FEATURE_LEAD_POOL=true` (and its two mirrors) to
  restore the feature instantly, no code change or data migration involved.
- Step 6 (engagement) is additive — `engagement`/`engagementScore`/`lastCallEngagement` on
  `CallLog` and `Lead` are new, nullable fields nothing else reads. Reverting the code leaves
  them in place, unread and harmless.
- Step 7 (Redis) rolls back by unsetting `REDIS_URL` — every cache/rate-limit helper falls back
  to its pre-Redis behavior (in-process cache, in-memory rate-limit store) with no code change.

---

## Credential rotation — do this regardless

`backend/seed.js` contained a hardcoded MongoDB Atlas connection string, with username and
password in plaintext, that overrode `process.env.MONGO_URI`. The line has been removed.

**Deleting the line does not un-leak the credential.** If this repo has ever been pushed to a
remote, shared, or committed to history, that username/password must be rotated in Atlas —
it remains readable in the git history until then.
