import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import api from '../lib/api';

const LAST_SYNC_KEY   = 'last_sync_timestamp';
const PENDING_QUEUE_KEY = 'calltrack_pending_queue';

// ------------------------------------------------------------------
// Native Android call log reading via ContentResolver bridge.
// Falls back to local AsyncStorage logs if the native module is
// unavailable (e.g. iOS or older builds without the native module).
// ------------------------------------------------------------------

async function readNativeCallLogs(sinceTimestamp) {
  const { CallLogModule } = NativeModules;
  if (!CallLogModule?.getCallLogsSince) return [];
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
    return [];
  }
}

async function readLocalCallLogs_fallback(sinceTimestamp) {
  try {
    const raw = await AsyncStorage.getItem('local_call_logs');
    const all = raw ? JSON.parse(raw) : [];
    return all.filter((c) => new Date(c.timestamp).getTime() > sinceTimestamp);
  } catch {
    return [];
  }
}

// Called from the app when a call ends — saves to local storage
export async function saveCallLog(entry) {
  try {
    const raw  = await AsyncStorage.getItem('local_call_logs');
    const logs = raw ? JSON.parse(raw) : [];
    logs.unshift({ ...entry, timestamp: entry.timestamp || new Date().toISOString() });
    await AsyncStorage.setItem('local_call_logs', JSON.stringify(logs.slice(0, 500)));
  } catch {}
}

// ── Offline pending queue ──────────────────────────────────────────

async function addToPendingQueue(calls) {
  try {
    const raw     = await AsyncStorage.getItem(PENDING_QUEUE_KEY);
    const pending = raw ? JSON.parse(raw) : [];
    const merged  = [...pending, ...calls];
    await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(merged.slice(0, 500)));
  } catch {}
}

export async function processPendingQueue() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_QUEUE_KEY);
    if (!raw) return { synced: 0 };
    const pending = JSON.parse(raw);
    if (!pending.length) return { synced: 0 };

    const res = await api.post('/api/calls/sync', { calls: pending });
    await AsyncStorage.removeItem(PENDING_QUEUE_KEY);
    return { synced: res.data.data?.synced || 0 };
  } catch {
    return { synced: 0 };
  }
}

export async function getPendingCount() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_QUEUE_KEY);
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

export function syncCallLogs() {
  if (syncInFlight) return syncInFlight;
  if (Date.now() - lastSyncAt < MIN_SYNC_INTERVAL_MS) {
    return Promise.resolve({ synced: 0, message: 'Synced recently' });
  }
  syncInFlight = doSyncCallLogs().finally(() => { syncInFlight = null; });
  return syncInFlight;
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
  if (nativeLogs.length === 0) nativeLogs = await readLocalCallLogs_fallback(sinceTimestamp);
  if (nativeLogs.length === 0) return { synced: 0, message: 'No new calls to sync' };

  // Build list of local logs enriched by AfterCallModal (notes/status/followUp).
  // Use fuzzy phone+timestamp matching (±3 min) instead of exact-minute key to handle
  // native call log timestamp drift (Android ContentResolver can be 30s–2min off).
  let localLogs = [];
  try {
    const raw = await AsyncStorage.getItem('local_call_logs');
    localLogs = raw ? JSON.parse(raw) : [];
  } catch {}

  const mergedLogs = nativeLogs.map((log) => {
    const logPhone = (log.contactNumber || '').replace(/\D/g, '');
    const logTs    = new Date(log.timestamp).getTime();
    const enriched = localLogs.find((local) => {
      const localPhone = (local.contactNumber || '').replace(/\D/g, '');
      const samePhone  = localPhone.endsWith(logPhone) || logPhone.endsWith(localPhone);
      return samePhone && Math.abs(new Date(local.timestamp).getTime() - logTs) < 180_000;
    });
    if (!enriched) return log;
    return {
      ...log,
      notes:      enriched.notes      || log.notes,
      callStatus: enriched.status     || enriched.callStatus || log.callStatus,
    };
  });

  try {
    const res = await api.post('/api/calls/sync', { calls: mergedLogs });
    await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
    const result = { synced: res.data.data?.synced || 0, message: res.data.message };
    if (__DEV__ && console.tron) {
      console.tron.display({
        name: '✅ Sync Complete',
        value: { synced: result.synced },
        important: false,
      });
    }
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

export async function queueNoteUpdate(callId, patch) {
  try {
    const raw   = await AsyncStorage.getItem(NOTE_QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    const next  = queue.filter((q) => q.callId !== callId); // latest edit wins
    next.push({ callId, patch, queuedAt: Date.now() });
    await AsyncStorage.setItem(NOTE_QUEUE_KEY, JSON.stringify(next.slice(-200)));
  } catch {}
}

export async function flushPendingNoteUpdates() {
  try {
    const raw = await AsyncStorage.getItem(NOTE_QUEUE_KEY);
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
    await AsyncStorage.setItem(NOTE_QUEUE_KEY, JSON.stringify(remaining));
  } catch {}
}

export async function getLastSyncTime() {
  const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
  return raw ? new Date(parseInt(raw, 10)) : null;
}

// Retry mechanism: flush any pending enrich entries saved by AfterCallModal before sync.
// Each key holds { contactNumber, timestampApprox, notes, status, tags }.
// On successful PATCH the key is deleted; on failure it stays for the next flush attempt.
export async function flushPendingEnriches() {
  try {
    const allKeys    = await AsyncStorage.getAllKeys();
    const enrichKeys = allKeys.filter((k) => k.startsWith('calltrack_pending_enrich_'));
    if (!enrichKeys.length) return;

    const userRaw = await AsyncStorage.getItem('user');
    const userId  = userRaw ? JSON.parse(userRaw)._id : null;
    if (!userId) return;

    const feedRes   = await api.get(`/api/calls/employee/${userId}`, { params: { page: 1, limit: 200 } });
    const feedCalls = feedRes.data.data?.calls || [];

    for (const key of enrichKeys) {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) { await AsyncStorage.removeItem(key); continue; }
        const enrich = JSON.parse(raw);

        const callDigits = (enrich.contactNumber || '').replace(/\D/g, '');
        const callTs     = new Date(enrich.timestampApprox).getTime();

        const matched = feedCalls.find((c) => {
          const cDigits   = (c.contactNumber || '').replace(/\D/g, '');
          const samePhone = cDigits.endsWith(callDigits) || callDigits.endsWith(cDigits);
          return samePhone && Math.abs(new Date(c.timestamp).getTime() - callTs) < 180_000;
        });

        if (matched) {
          await api.patch(`/api/calls/${matched._id}/notes`, {
            notes:      enrich.notes   || undefined,
            callStatus: enrich.status  || undefined,
          });
          await AsyncStorage.removeItem(key);
        }
      } catch {}
    }
  } catch {}
}
