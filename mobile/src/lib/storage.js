import { MMKV } from 'react-native-mmkv';

// Synchronous, JSI-backed storage for hot-path keys (pending queues, local call logs, notes) —
// read/written every sync cycle and every note save, where AsyncStorage's bridge round trip and
// JSON (de)serialization overhead were measurably slowing things down.
export const storage = new MMKV({ id: 'calltrack' });

export function getItem(key) {
  return storage.getString(key) ?? null;
}

export function setItem(key, value) {
  storage.set(key, value);
}

export function removeItem(key) {
  storage.delete(key);
}

export function getAllKeys() {
  return storage.getAllKeys();
}
