import {
  NativeModules, DeviceEventEmitter, AppState,
  PermissionsAndroid, Platform, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { CallLogModule } = NativeModules;

export async function requestCallPermissions() {
  if (Platform.OS !== 'android') return false;
  try {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
    ]);
    return (
      result[PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE] === PermissionsAndroid.RESULTS.GRANTED &&
      result[PermissionsAndroid.PERMISSIONS.READ_CALL_LOG]    === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch {
    return false;
  }
}

// Request SYSTEM_ALERT_WINDOW permission — re-prompts if permission still not granted
export async function requestOverlayPermission() {
  if (Platform.OS !== 'android') return true;
  try {
    const hasPermission = await CallLogModule?.checkOverlayPermission?.();
    if (hasPermission) {
      // Permission now granted — clear the "asked" flag so future installs work cleanly
      await AsyncStorage.removeItem('overlay_perm_asked');
      return true;
    }

    const alreadyAsked = await AsyncStorage.getItem('overlay_perm_asked');
    // On Xiaomi / MIUI / HyperOS canDrawOverlays can return false even after granting.
    // Always re-show the dialog when the permission is still reported as missing so the
    // user can retry; the flag only suppresses it for a single session.
    if (alreadyAsked === 'session') return false;

    await AsyncStorage.setItem('overlay_perm_asked', 'session');
    Alert.alert(
      'Allow Pop-up Overlay',
      'To show the after-call popup, please enable "Display over other apps" for CallTrack.\n\nOn Xiaomi / Redmi: Settings → Apps → Manage Apps → CallTrack → Other permissions → Display over other apps.',
      [
        { text: 'Open Settings', onPress: () => CallLogModule?.openOverlaySettings?.() },
        { text: 'Later', style: 'cancel' },
      ]
    );
    return false;
  } catch {
    return false;
  }
}

// Wraps the DeviceEventEmitter listener.
// When the native 'onCallEnded' fires and the app is not in the foreground,
// immediately bring the app forward so the modal is visible to the user.
export function onCallEnded(callback) {
  const sub = DeviceEventEmitter.addListener('onCallEnded', (data) => {
    if (AppState.currentState !== 'active') {
      // App is in background — bring it to front before handing data to JS
      CallLogModule?.bringAppToForeground?.();
    }
    callback(data);
  });
  return () => sub.remove();
}
