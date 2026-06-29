import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';

const PREFIX = 'callnote_';

function makeKey(call) {
  const date = new Date(call.timestamp).toISOString().split('T')[0];
  const num  = (call.contactNumber || '').replace(/\D/g, '');
  return `${PREFIX}${num}_${date}_${call.callType}`;
}

export async function getNote(call) {
  try {
    const raw = await AsyncStorage.getItem(makeKey(call));
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
  await AsyncStorage.setItem(makeKey(call), JSON.stringify(enriched));
}

export async function getAllNotes() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const noteKeys = keys.filter((k) => k.startsWith(PREFIX));
    const pairs = await AsyncStorage.multiGet(noteKeys);
    return pairs.reduce((acc, [key, val]) => {
      if (val) acc[key] = JSON.parse(val);
      return acc;
    }, {});
  } catch {
    return {};
  }
}

// Returns all notes that have a followUp date set and not marked done.
// Tries backend first so data survives reinstall; falls back to AsyncStorage.
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

  // Offline fallback — local AsyncStorage
  const all = await getAllNotes();
  return Object.entries(all)
    .filter(([, v]) => v.followUp && !v.followUp.done)
    .map(([key, v]) => ({ key, ...v }));
}
