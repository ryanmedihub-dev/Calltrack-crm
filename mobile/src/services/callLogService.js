import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, DeviceEventEmitter } from 'react-native';
import api from '../lib/api';
import { getItem, setItem, removeItem, getAllKeys } from '../lib/storage';

const LAST_SYNC_KEY   = 'last_sync_timestamp';
const PENDING_QUEUE_KEY = 'calltrack_pending_queue';

// Native call-log timestamps drift from what the app recorded at call time (Android's
// ContentResolver can be 30s–2min off), so "same call" can't be an equality test on timestamp.
const SAME_CALL_WINDOW_MS = 180_000;

// Single definition of call identity, used everywhere this file needs to decide whether two
// records describe the same physical call (local upsert, sync merge, pending-queue dedup).
// Previously each site re-implemented this slightly differently, which is how a call could be
// deduped in one place and duplicated in another.
export function isSameCall(a, b) {
  if (!a || !b) return false;
  // clientCallId is a deterministic hash of number+timestamp computed natively, so when both
  // sides carry one it's an exact identity and the fuzzy fallback below is unnecessary.
  if (a.clientCallId && b.clientCallId) return a.clientCallId === b.clientCallId;

  const da = (a.contactNumber || '').replace(/\D/g, '');
  const db = (b.contactNumber || '').replace(/\D/g, '');
  if (!da || !db) return false;
  // Suffix match: the same number surfaces as 9876543210 / +919876543210 / 09876543210
  // depending on which code path recorded it.
  if (!(da.endsWith(db) || db.endsWith(da))) return false;

  const ta = new Date(a.timestamp).getTime();
  const tb = new Date(b.timestamp).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return false;
  return Math.abs(ta - tb) < SAME_CALL_WINDOW_MS;
}

// ------------------------------------------------------------------
// Native Android call log reading via ContentResolver bridge.
// Falls back to local MMKV-backed logs if the native module is
// unavailable (e.g. iOS or older builds without the native module).
// ------------------------------------------------------------------

// Returns null only when the native module is unavailable/failed. An empty array means
// "the tracked SIM genuinely has no calls" — that must NOT fall through to the local fallback,
// which isn't SIM-filtered and used to re-sync other SIMs' calls.
async function readNativeCallLogs(sinceTimestamp) {
  const { CallLogModule } = NativeModules;
  if (!CallLogModule?.getCallLogsSince) return null;
  try {
    // Pass tracked SIM's subscriptionId + slotIndex (fallback for MIUI devices that
    // store slot index instead of subscription ID in the call log table)
    const trackedSimRaw  = await AsyncStorage.getItem('tracked_sim_id');
    const trackedSlotRaw = await AsyncStorage.getItem('tracked_sim_slot');
    const subscriptionId = trackedSimRaw  ? parseInt(trackedSimRaw,  10) : -1;
    const slotIndex      = trackedSlotRaw ? parseInt(trackedSlotRaw, 10) : -1;

    const logs = await CallLogModule.getCallLogsSince(sinceTimestamp, subscriptionId, slotIndex);
    return Array.isArray(logs) ? logs : [];
  } catch {
    return null;
  }
}

function readLocalCallLogs_fallback(sinceTimestamp) {
  try {
    const raw = getItem('local_call_logs');
    const all = raw ? JSON.parse(raw) : [];
    return all.filter((c) => new Date(c.timestamp).getTime() > sinceTimestamp);
  } catch {
    return [];
  }
}

// Called from the app when a call ends — saves to local storage.
// Upserts rather than unshifts: remarking the same call twice used to append a second entry,
// and the sync merge's Array.find() would then pick whichever copy came first (usually the
// older one), silently reverting the newer remark.
export function saveCallLog(entry) {
  try {
    const raw  = getItem('local_call_logs');
    const logs = raw ? JSON.parse(raw) : [];
    const record = {
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
      // Client-authored edit clock. The server compares this against its own stored value to
      // decide whether an incoming sync is newer than an edit made elsewhere (e.g. dashboard).
      notesUpdatedAt: entry.notesUpdatedAt || new Date().toISOString(),
    };
    const idx = logs.findIndex((l) => isSameCall(l, record));
    if (idx === -1) logs.unshift(record);
    else logs[idx] = { ...logs[idx], ...record };
    setItem('local_call_logs', JSON.stringify(logs.slice(0, 500)));
  } catch {}
}

// Patch the locally cached copy of a call. AddNoteModal PATCHes the server directly, but if
// the local cache still holds the remark captured at call time, the very next syncCallLogs()
// re-sends that stale text and the server overwrites the newer edit — which is why an edit
// appeared to "sometimes" revert (it depended on whether a sync happened to run afterwards).
export function updateLocalCallLog(call, patch) {
  try {
    const raw  = getItem('local_call_logs');
    const logs = raw ? JSON.parse(raw) : [];
    const stamped = { ...patch, notesUpdatedAt: patch.notesUpdatedAt || new Date().toISOString() };
    const idx = logs.findIndex((l) => isSameCall(l, call));
    if (idx === -1) {
      // Remark added to a call that never went through the post-call form (edited straight
      // from Call History), so there's no local row yet — seed one so the next sync carries it.
      logs.unshift({
        clientCallId:  call.clientCallId,
        contactNumber: call.contactNumber,
        contactName:   call.contactName,
        callType:      call.callType,
        duration:      call.duration,
        timestamp:     call.timestamp || new Date().toISOString(),
        ...stamped,
      });
    } else {
      logs[idx] = { ...logs[idx], ...stamped };
    }
    setItem('local_call_logs', JSON.stringify(logs.slice(0, 500)));
  } catch {}
}

// ── Offline pending queue ──────────────────────────────────────────

function addToPendingQueue(calls) {
  try {
    const raw     = getItem(PENDING_QUEUE_KEY);
    const pending = raw ? JSON.parse(raw) : [];
    // A repeatedly-failing sync re-queues the same day's calls on every attempt. Concatenating
    // blindly grew the queue with hundreds of copies of the same calls, blew past the 500 cap,
    // and started evicting entries that had genuinely never reached the server. Collapsing on
    // insert keeps the queue bounded by the number of *distinct* unsent calls.
    const merged = [...pending];
    for (const call of calls) {
      const idx = merged.findIndex((p) => isSameCall(p, call));
      if (idx === -1) merged.push(call);
      else merged[idx] = call; // the newer attempt carries the fresher remark
    }
    setItem(PENDING_QUEUE_KEY, JSON.stringify(merged.slice(-500)));
  } catch {}
}

export async function processPendingQueue() {
  try {
    const raw = getItem(PENDING_QUEUE_KEY);
    if (!raw) return { synced: 0 };
    const pending = JSON.parse(raw);
    if (!pending.length) return { synced: 0 };

    const res = await api.post('/api/calls/sync', { calls: pending });
    removeItem(PENDING_QUEUE_KEY);
    return { synced: res.data.data?.synced || 0 };
  } catch {
    return { synced: 0 };
  }
}

export async function getPendingCount() {
  try {
    const raw = getItem(PENDING_QUEUE_KEY);
    if (!raw) return 0;
    return JSON.parse(raw).length;
  } catch {
    return 0;
  }
}

// ── Main sync ─────────────────────────────────────────────────────
//
// syncCallLogs() is triggered from several independent places (a 60s timer,
// the app-foreground handler, each screen's mount effect, pull-to-refresh) with
// no coordination between them. On a slow connection a single sync can still be
// in flight when the next trigger fires, so without a guard here every one of
// those triggers fires its own overlapping POST /api/calls/sync — each one
// separately flipping its caller's "syncing" UI state, which is what shows up
// as the app "blinking". Collapsing concurrent callers onto one in-flight
// promise, plus a short cooldown between attempts, fixes that at the source.
const MIN_SYNC_INTERVAL_MS = 15000;
let syncInFlight = null;
let lastSyncAt = 0;
// Serializes forced syncs so two rapid Saves can't launch overlapping passes.
let forcedTail = Promise.resolve();

function startSync() {
  const p = doSyncCallLogs().finally(() => { if (syncInFlight === p) syncInFlight = null; });
  syncInFlight = p;
  return p;
}

// `force` is for deliberate user actions (Save, Skip, pull-to-refresh) where "a sync ran 5s
// ago" is no reason to silently no-op something the user is watching for. Passive triggers
// (60s timer, foreground handler, mount effects) must never pass it — the cooldown is what
// stops those from overlapping, which is what caused the UI "blinking".
export function syncCallLogs(force = false) {
  if (!force) {
    if (syncInFlight) return syncInFlight;
    if (Date.now() - lastSyncAt < MIN_SYNC_INTERVAL_MS) {
      return Promise.resolve({ synced: 0, message: 'Synced recently' });
    }
    return startSync();
  }

  // A forced sync must reflect local storage as of *now*. Returning an already-in-flight sync
  // would report success for a pass whose payload was snapshotted before the user's edit —
  // the whole reason the caller forced it. So wait that pass out, then run a fresh one.
  const next = forcedTail
    .catch(() => {})
    .then(() => (syncInFlight ? syncInFlight.catch(() => {}) : null))
    .then(() => startSync());
  forcedTail = next.catch(() => {});
  return next;
}

async function doSyncCallLogs() {
  lastSyncAt = Date.now();
  if (__DEV__ && console.tron) {
    console.tron.log('🔄 syncCallLogs triggered');
  }

  // Only sync today's calls — midnight local time
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sinceTimestamp = todayStart.getTime();

  let nativeLogs = await readNativeCallLogs(sinceTimestamp);
  if (nativeLogs === null) nativeLogs = readLocalCallLogs_fallback(sinceTimestamp);
  if (nativeLogs.length === 0) return { synced: 0, message: 'No new calls to sync' };

  // Build list of local logs enriched by AfterCallModal (notes/status/followUp).
  // Use fuzzy phone+timestamp matching (±3 min) instead of exact-minute key to handle
  // native call log timestamp drift (Android ContentResolver can be 30s–2min off).
  let localLogs = [];
  try {
    const raw = getItem('local_call_logs');
    localLogs = raw ? JSON.parse(raw) : [];
  } catch {}

  const mergedLogs = nativeLogs.map((log) => {
    const enriched = localLogs.find((local) => isSameCall(local, log));
    if (!enriched) return log;

    // `hasRemark` distinguishes "the user cleared this remark" (empty string — a real edit the
    // server must apply) from "this sync simply carries no remark for this call" (field
    // absent). Without it an empty string is indistinguishable from no data and gets dropped,
    // which is why clearing a remark was impossible.
    const hasRemark = enriched.notes !== undefined && enriched.notes !== null;

    return {
      ...log,
      ...(hasRemark ? { notes: enriched.notes, hasRemark: true } : {}),
      callStatus: enriched.status ?? enriched.callStatus ?? log.callStatus,
      notesUpdatedAt: enriched.notesUpdatedAt,
      // Marks that this call was actually submitted through the post-call form (Save was
      // tapped), as opposed to just being picked up by a routine background sync — the
      // backend uses this to decide whether an unmatched call should create a new lead.
      submittedViaPostCall: !!(enriched.submittedViaPostCall || log.submittedViaPostCall),
    };
  });

  try {
    const res = await api.post('/api/calls/sync', { calls: mergedLogs });
    setItem(LAST_SYNC_KEY, Date.now().toString());
    const result = { synced: res.data.data?.synced || 0, message: res.data.message };
    if (__DEV__ && console.tron) {
      console.tron.display({
        name: '✅ Sync Complete',
        value: { synced: result.synced },
        important: false,
      });
    }
    // Screens that fetch their list once on mount (CallHistoryScreen, etc.) can listen
    // for this to refresh promptly instead of only showing fresh data on next mount —
    // `result.synced` only counts brand-new rows, so this fires even when a sync only
    // updated existing rows (e.g. a note/status attached after the bare call already synced).
    DeviceEventEmitter.emit('calltrack:synced', result);
    return result;
  } catch (err) {
    await addToPendingQueue(mergedLogs);
    throw err;
  }
}

// ── Pending note/follow-up updates (offline retry for AddNoteModal) ─
//
// AddNoteModal PATCHes /api/calls/:id/notes immediately on Save for
// "webhook-like" instant sync, but a plain try/catch around that call means
// an update made while offline was previously just lost. Queue it here by
// call id (exact match, no fuzzy phone/timestamp matching needed since the
// call is already a synced backend record with a real _id) and flush it
// from the same triggers that already drive syncCallLogs().
const NOTE_QUEUE_KEY = 'calltrack_pending_note_updates';

export function queueNoteUpdate(callId, patch) {
  try {
    const raw   = getItem(NOTE_QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    const next  = queue.filter((q) => q.callId !== callId); // latest edit wins
    next.push({ callId, patch, queuedAt: Date.now() });
    setItem(NOTE_QUEUE_KEY, JSON.stringify(next.slice(-200)));
  } catch {}
}

export async function flushPendingNoteUpdates() {
  try {
    const raw = getItem(NOTE_QUEUE_KEY);
    if (!raw) return;
    const queue = JSON.parse(raw);
    if (!queue.length) return;

    const remaining = [];
    for (const item of queue) {
      try {
        await api.patch(`/api/calls/${item.callId}/notes`, item.patch);
      } catch {
        remaining.push(item);
      }
    }
    setItem(NOTE_QUEUE_KEY, JSON.stringify(remaining));
  } catch {}
}

export async function getLastSyncTime() {
  const raw = getItem(LAST_SYNC_KEY);
  return raw ? new Date(parseInt(raw, 10)) : null;
}

// Retry mechanism: flush any pending enrich entries saved by AfterCallModal before sync.
// Each key holds { contactNumber, timestampApprox, notes, status, tags, savedAt, clientCallId }.
// On successful PATCH the key is deleted; on failure it stays for the next flush attempt.
//
// Entries expire after 24h. They used to live forever, so a days-old remark could suddenly
// re-apply itself over a much newer one the moment the fuzzy phone+time window finally
// matched some unrelated call to the same number.
const ENRICH_TTL_MS = 24 * 60 * 60 * 1000;

export async function flushPendingEnriches() {
  try {
    const enrichKeys = getAllKeys().filter((k) => k.startsWith('calltrack_pending_enrich_'));
    if (!enrichKeys.length) return;

    const userRaw = await AsyncStorage.getItem('user');
    const userId  = userRaw ? JSON.parse(userRaw)._id : null;
    if (!userId) return;

    const feedRes   = await api.get(`/api/calls/employee/${userId}`, { params: { page: 1, limit: 200 } });
    const feedCalls = feedRes.data.data?.calls || [];

    for (const key of enrichKeys) {
      try {
        const raw = getItem(key);
        if (!raw) { removeItem(key); continue; }
        const enrich = JSON.parse(raw);

        // Fall back to the key's own embedded timestamp for entries written before `savedAt`
        // existed, so legacy keys still age out instead of lingering forever.
        const savedAt = enrich.savedAt || parseInt(key.split('_').pop(), 10) || 0;
        if (savedAt && Date.now() - savedAt > ENRICH_TTL_MS) { removeItem(key); continue; }

        const matched =
          (enrich.clientCallId && feedCalls.find((c) => c.clientCallId === enrich.clientCallId)) ||
          feedCalls.find((c) => isSameCall(c, {
            contactNumber: enrich.contactNumber,
            timestamp:     enrich.timestampApprox,
          }));

        if (matched) {
          await api.patch(`/api/calls/${matched._id}/notes`, {
            // Send the remark even when empty — an empty string here is a deliberate clear,
            // and `undefined` would make the server skip the field entirely.
            ...(enrich.notes !== undefined && enrich.notes !== null ? { notes: enrich.notes } : {}),
            ...(enrich.status ? { callStatus: enrich.status } : {}),
            notesUpdatedAt: enrich.notesUpdatedAt || (savedAt ? new Date(savedAt).toISOString() : undefined),
          });
          removeItem(key);
        }
      } catch {}
    }
  } catch {}
}
