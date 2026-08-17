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

---

## Rollback

- Steps 1–2 are additive (a new field and two indexes); nothing reads them destructively, so
  rolling the code back leaves harmless extra data.
- The `/sync` route changed from `$set`/`$setOnInsert` operators to an aggregation-pipeline
  update. Reverting the code reverts the write behaviour immediately — no data shape changed,
  only which value wins on conflict.
- `CallLog.notesUpdatedAt/By/ByName` were introduced in an earlier change and are only added to,
  never required.

---

## Credential rotation — do this regardless

`backend/seed.js` contained a hardcoded MongoDB Atlas connection string, with username and
password in plaintext, that overrode `process.env.MONGO_URI`. The line has been removed.

**Deleting the line does not un-leak the credential.** If this repo has ever been pushed to a
remote, shared, or committed to history, that username/password must be rotated in Atlas —
it remains readable in the git history until then.
