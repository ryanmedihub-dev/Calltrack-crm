import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { SimInfoModule, CallLogModule } = NativeModules;

const SIM_PREF_KEY  = 'tracked_sim_id';
const SLOT_PREF_KEY = 'tracked_sim_slot';

export async function getAvailableSims() {
  try {
    return await SimInfoModule.getAvailableSims();
  } catch {
    return [];
  }
}

export async function getTrackedSimId() {
  const raw = await AsyncStorage.getItem(SIM_PREF_KEY);
  return raw ? parseInt(raw, 10) : -1;
}

export async function setTrackedSim(subscriptionId, slotIndex = -1) {
  await AsyncStorage.setItem(SIM_PREF_KEY,  String(subscriptionId));
  await AsyncStorage.setItem(SLOT_PREF_KEY, String(slotIndex));
  // Push both values into native SharedPreferences so CallTrackService can filter
  CallLogModule?.setTrackedSim(subscriptionId);
  CallLogModule?.setTrackedSimSlot(slotIndex);
}

// Call this on every app start to restore the saved preference into native SharedPreferences
export async function applyTrackedSim() {
  const id   = await getTrackedSimId();
  const slot = await AsyncStorage.getItem(SLOT_PREF_KEY);
  CallLogModule?.setTrackedSim(id);
  CallLogModule?.setTrackedSimSlot(slot !== null ? parseInt(slot, 10) : -1);
}
