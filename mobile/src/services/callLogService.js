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
    // Pass the tracked SIM's subscriptionId so native can filter by SIM
    const trackedSimRaw = await AsyncStorage.getItem('tracked_sim_id');
    const subscriptionId = trackedSimRaw ? parseInt(trackedSimRaw, 10) : -1;

    const logs = await CallLogModule.getCallLogsSince(sinceTimestamp, subscriptionId);
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

export async function syncCallLogs() {
  const lastSyncRaw = await AsyncStorage.getItem(LAST_SYNC_KEY);
  let lastSync      = lastSyncRaw ? parseInt(lastSyncRaw, 10) : 0;

  // First install: cap to last 30 days only
  if (lastSync === 0) {
    lastSync = Date.now() - 30 * 24 * 60 * 60 * 1000;
  }

  let nativeLogs = await readNativeCallLogs(lastSync);
  if (nativeLogs.length === 0) nativeLogs = await readLocalCallLogs_fallback(lastSync);
  if (nativeLogs.length === 0) return { synced: 0, message: 'No new calls to sync' };

  // Build a lookup map from local_call_logs (which has notes/status/followUp saved by AfterCallModal)
  // Key = phone digits + timestamp truncated to the minute → tolerates small timestamp drift
  let enrichedMap = {};
  try {
    const raw = await AsyncStorage.getItem('local_call_logs');
    const localLogs = raw ? JSON.parse(raw) : [];
    localLogs.forEach((local) => {
      const key = `${(local.contactNumber || '').replace(/\D/g, '')}_${
        new Date(local.timestamp).toISOString().slice(0, 16)
      }`;
      enrichedMap[key] = local;
    });
  } catch {}

  // For each native log, attach enriched fields if a matching local entry exists
  const mergedLogs = nativeLogs.map((log) => {
    const key = `${(log.contactNumber || '').replace(/\D/g, '')}_${
      new Date(log.timestamp).toISOString().slice(0, 16)
    }`;
    const enriched = enrichedMap[key];
    if (!enriched) return log;
    return {
      ...log,
      notes:        enriched.notes        || log.notes,
      callStatus:   enriched.status       || enriched.callStatus  || log.callStatus,
      callTags:     enriched.tags         || enriched.callTags    || log.callTags,
      followUpDate: enriched.followUpDate || log.followUpDate,
    };
  });

  try {
    const res = await api.post('/api/calls/sync', { calls: mergedLogs });
    await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
    return { synced: res.data.data?.synced || 0, message: res.data.message };
  } catch (err) {
    await addToPendingQueue(mergedLogs);
    throw err;
  }
}

export async function getLastSyncTime() {
  const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
  return raw ? new Date(parseInt(raw, 10)) : null;
}
