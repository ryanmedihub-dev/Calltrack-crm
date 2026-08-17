// Expo Config Plugin — persists CallTrack native customizations across expo prebuild runs
const { withAndroidManifest, withMainApplication } = require('@expo/config-plugins');

const withCallTrackNative = (config) => {
  // ── AndroidManifest: permissions + PhoneStateReceiver ─────────────────
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // Permissions
    if (!manifest['uses-permission']) manifest['uses-permission'] = [];
    const perms = manifest['uses-permission'];
    const addPerm = (name) => {
      if (!perms.find((p) => p.$?.['android:name'] === name))
        perms.push({ $: { 'android:name': name } });
    };
    addPerm('android.permission.READ_PHONE_STATE');
    addPerm('android.permission.READ_PHONE_NUMBERS');
    addPerm('android.permission.POST_NOTIFICATIONS');
    addPerm('android.permission.READ_CALL_LOG');
    addPerm('android.permission.FOREGROUND_SERVICE');
    addPerm('android.permission.FOREGROUND_SERVICE_PHONE_CALL');
    addPerm('android.permission.RECEIVE_BOOT_COMPLETED');
    // Without this, Android 14+ silently demotes any notification carrying a full-screen
    // intent into the tray — the post-call prompt stops appearing as a heads-up banner.
    addPerm('android.permission.USE_FULL_SCREEN_INTENT');
    // Lets the app ask to be exempted from battery optimization. Aggressive OEM power
    // managers otherwise freeze the foreground service between calls.
    addPerm('android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS');

    // PhoneStateReceiver
    const app = manifest.application[0];
    if (!app.receiver) app.receiver = [];
    if (!app.receiver.find((r) => r.$?.['android:name'] === '.PhoneStateReceiver')) {
      app.receiver.push({
        $: { 'android:name': '.PhoneStateReceiver', 'android:exported': 'true' },
        'intent-filter': [{
          action: [{ $: { 'android:name': 'android.intent.action.PHONE_STATE' } }]
        }],
      });
    }

    // CallTrackService (persistent foreground service for MIUI background detection)
    if (!app.service) app.service = [];
    if (!app.service.find((s) => s.$?.['android:name'] === '.CallTrackService')) {
      app.service.push({
        $: {
          'android:name':                '.CallTrackService',
          'android:enabled':             'true',
          'android:exported':            'false',
          'android:foregroundServiceType': 'phoneCall',
          'android:stopWithTask':        'false',
        },
      });
    }

    // BootReceiver (restarts CallTrackService after reboot)
    if (!app.receiver.find((r) => r.$?.['android:name'] === '.BootReceiver')) {
      app.receiver.push({
        $: {
          'android:name':     '.BootReceiver',
          'android:enabled':  'true',
          'android:exported': 'true',
        },
        'intent-filter': [{
          action: [{ $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } }],
        }],
      });
    }

    return cfg;
  });

  // ── MainApplication: register CallLogPackage + SimInfoPackage ─────────
  config = withMainApplication(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes('CallLogPackage()')) {
      src = src.replace(
        'val packages = PackageList(this).packages',
        'val packages = PackageList(this).packages\n            packages.add(CallLogPackage())\n            packages.add(SimInfoPackage())'
      );
      cfg.modResults.contents = src;
    }
    return cfg;
  });

  return config;
};

module.exports = withCallTrackNative;
