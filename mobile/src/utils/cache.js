import AsyncStorage from '@react-native-async-storage/async-storage';

// Simple "show stale data instantly, refresh in background" cache. Screens read
// the cached value on mount to paint immediately (no spinner) instead of blocking
// on a network round trip, then overwrite it once a fresh fetch resolves.
const PREFIX = 'screen_cache_';

export async function getCached(key) {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setCached(key, data) {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch {}
}
