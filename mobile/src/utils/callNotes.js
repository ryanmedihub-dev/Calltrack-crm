import api from '../lib/api';
import { getItem, setItem, getAllKeys } from '../lib/storage';

const PREFIX = 'callnote_';

function makeKey(call) {
  // clientCallId is generated once natively (deterministic hash of number+timestamp) and the
  // backend echoes it back on every synced CallLog doc, so it's stable before AND after sync —
  // preferring it means the note key never has to migrate when a call gets a server _id.
  if (call.clientCallId) return `${PREFIX}cid_${call.clientCallId}`;
  if (call._id) return `${PREFIX}id_${call._id}`;
  // Legacy fallback for calls captured before clientCallId existed — collides across repeat
  // calls to the same number/day/type, so only used when neither id above is available.
  const date = new Date(call.timestamp).toISOString().split('T')[0];
  const num  = (call.contactNumber || '').replace(/\D/g, '');
  return `${PREFIX}${num}_${date}_${call.callType}`;
}

export async function getNote(call) {
  try {
    const raw = getItem(makeKey(call));
    return raw ? JSON.parse(raw) : { note: '', tags: [], followUp: null };
  } catch {
    return { note: '', tags: [], followUp: null };
  }
}

export async function saveNote(call, data) {
  const enriched = {
    ...data,
    contactName:   call.contactName   || data.contactName   || '',
    contactNumber: call.contactNumber || data.contactNumber || '',
  };
  setItem(makeKey(call), JSON.stringify(enriched));
}

export async function getAllNotes() {
  try {
    const noteKeys = getAllKeys().filter((k) => k.startsWith(PREFIX));
    return noteKeys.reduce((acc, key) => {
      const val = getItem(key);
      if (val) acc[key] = JSON.parse(val);
      return acc;
    }, {});
  } catch {
    return {};
  }
}

// Returns all notes that have a followUp date set and not marked done.
// Tries backend first so data survives reinstall; falls back to local MMKV storage.
export async function getPendingFollowUps() {
  try {
    const res = await api.get('/api/calls/pending-followups');
    if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
      return res.data.data.map((call) => ({
        key:           call._id,
        contactName:   call.contactName   || '',
        contactNumber: call.contactNumber || '',
        followUp:      { date: call.followUpDate, done: false },
        note:          call.notes || '',
        tags:          [],
      }));
    }
  } catch {}

  // Offline fallback — local MMKV storage
  const all = await getAllNotes();
  return Object.entries(all)
    .filter(([, v]) => v.followUp && !v.followUp.done)
    .map(([key, v]) => ({ key, ...v }));
}
