import './src/config/ReactotronConfig';
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ActivityIndicator, AppRegistry, AppState,
  NativeModules, PermissionsAndroid, Platform, DeviceEventEmitter, Modal,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen       from './src/screens/LoginScreen';
import SimSetupScreen    from './src/screens/SimSetupScreen';
import MiuiSetupScreen   from './src/screens/MiuiSetupScreen';
import PostCallScreen    from './src/screens/PostCallScreen';
import CallHistoryScreen from './src/screens/CallHistoryScreen';
import AnalyticsScreen   from './src/screens/AnalyticsScreen';
import FollowupsScreen   from './src/screens/FollowupsScreen';
import LeadsScreen       from './src/screens/LeadsScreen';
import MoreScreen        from './src/screens/MoreScreen';
import TabBar            from './src/components/TabBar';
import ErrorBoundary     from './src/components/ErrorBoundary';
import AddNoteModal      from './src/components/AddNoteModal';

import * as Notifications from 'expo-notifications';
import { requestCallPermissions, requestOverlayPermission } from './src/services/phoneStateService';
import { applyTrackedSim } from './src/services/simService';
import { getPendingFollowUps } from './src/utils/callNotes';
import { syncCallLogs, processPendingQueue, getPendingCount, flushPendingNoteUpdates } from './src/services/callLogService';
import { setLogoutCallback } from './src/lib/api';

const { CallLogModule } = NativeModules;

const PENDING_CALL_KEY = 'calltrack_pending_post_call';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

async function scheduleFollowUpNotifications() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.data?.type === 'followup') {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
    const followUps = await getPendingFollowUps();
    for (const fu of followUps) {
      if (!fu.followUp?.date) continue;
      const d    = new Date(fu.followUp.date);
      const hour = d.getHours() || 9;
      const fireAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0, 0);
      if (fireAt.getTime() <= Date.now()) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `followup_${fu.key}`,
        content: {
          title: `📅 Follow-up: ${fu.contactName || fu.contactNumber || 'Contact'}`,
          body:  fu.note ? `Note: ${fu.note}` : 'Time to follow up',
          data:  { type: 'followup', key: fu.key },
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
      });
    }
  } catch (err) {
    console.warn('Notification schedule error:', err);
  }
}

async function requestNotificationPermission() {
  if (Platform.OS !== 'android') return;
  try {
    if (Platform.Version >= 33) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
  } catch {}
  try { await Notifications.requestPermissionsAsync(); } catch {}
}

// Fire an immediate notification that tapping opens the remarks form.
async function firePostCallNotification(call) {
  try {
    const name = call.contactName && call.contactName !== 'Unknown'
      ? call.contactName
      : call.contactNumber;
    const typeLabel = call.callType ? call.callType.charAt(0).toUpperCase() + call.callType.slice(1) : 'Call';
    const durSec = call.duration || 0;
    const durStr = durSec > 0
      ? ` · ${Math.floor(durSec / 60)}m ${durSec % 60}s`
      : '';

    await Notifications.scheduleNotificationAsync({
      identifier: `postcall_${Date.now()}`,
      content: {
        title: `📞 ${typeLabel} ended — Add Remarks`,
        body:  `${name}${durStr} — Tap to log outcome`,
        data:  { type: 'postcall' },
        sound: true,
      },
      trigger: null, // fire immediately
    });
  } catch {}
}

function App() {
  const [screen, setScreen]               = useState(null);
  const [tab, setTab]                     = useState('calls');
  const [pendingCall, setPendingCall]     = useState(null);
  const [noteCall, setNoteCall]           = useState(null);
  const [followUpBadge, setFollowUpBadge] = useState(0);
  const [pendingCount, setPendingCount]   = useState(0);

  const appState       = useRef(AppState.currentState);
  const syncTimer      = useRef(null);
  const pollTimer      = useRef(null);
  const pendingCallRef = useRef(null);
  const screenRef      = useRef(null);
  const isHandlingRef  = useRef(false);
  const isCheckingRef  = useRef(false);
  const setupDoneRef   = useRef(false);

  useEffect(() => { pendingCallRef.current = pendingCall; }, [pendingCall]);
  useEffect(() => { screenRef.current = screen; }, [screen]);

  useEffect(() => {
    AsyncStorage.getItem('token')
      .then((t) => setScreen(t ? 'main' : 'login'))
      .catch(() => setScreen('login'));
  }, []);

  useEffect(() => {
    if (screen !== 'main') return;
    if (setupDoneRef.current) return;
    setupDoneRef.current = true;

    requestCallPermissions();
    requestNotificationPermission();
    requestOverlayPermission();
    applyTrackedSim();
    CallLogModule?.startCallTrackService?.();

    setLogoutCallback(() => {
      clearInterval(syncTimer.current);
      clearInterval(pollTimer.current);
      setupDoneRef.current = false;
      setScreen('login');
      setTab('calls');
    });

    // ─── Store call + fire notification (NO immediate modal) ─────────────────
    // Native (CallTrackService.kt) already filters by tracked SIM before emitting.
    // Only store + notify once per call (duplicate guard for the 4s poll).
    const notifyPostCall = async (data) => {
      if (pendingCallRef.current) return; // modal already open
      if (isHandlingRef.current) return;

      const existing = await AsyncStorage.getItem(PENDING_CALL_KEY).catch(() => null);
      if (existing) return; // already stored for this call

      try { await AsyncStorage.setItem(PENDING_CALL_KEY, JSON.stringify(data)); } catch {}
      await firePostCallNotification(data);
    };

    // ─── Open remarks modal from stored call (triggered by notification tap / foreground) ──
    const openStoredPostCall = async () => {
      if (pendingCallRef.current) return;
      if (isHandlingRef.current) return;
      try {
        const stored = await AsyncStorage.getItem(PENDING_CALL_KEY);
        if (!stored) return;
        const parsed = JSON.parse(stored);
        isHandlingRef.current = true;
        setPendingCall(parsed);
      } catch {}
    };

    // ─── Poll: only detects NEW native pending calls (does NOT open modal) ───
    const pollNativePending = async () => {
      if (isCheckingRef.current) return;
      if (pendingCallRef.current) return;
      isCheckingRef.current = true;
      try {
        const native = await CallLogModule?.getPendingCall?.();
        if (native?.callType) {
          await notifyPostCall(native);
        }
      } catch {}
      finally { isCheckingRef.current = false; }
    };

    // Path 1: Direct event from ContentObserver (app is alive during call).
    // Trigger sync immediately (not just the popup) so the call log shows up
    // on the dashboard right away instead of waiting for the 60s timer —
    // syncCallLogs()'s in-flight/cooldown guard makes this safe to call
    // alongside every other trigger.
    const callEndedSub = DeviceEventEmitter.addListener('onCallEnded', (data) => {
      notifyPostCall(data);
      doSync();
    });

    // Path 2: Native onResume signal (app was killed, native stored the call)
    const pendingSub = DeviceEventEmitter.addListener('onPendingCallAvailable', () => {
      pollNativePending();
    });

    // Path 3: Notification tapped → open the remarks form
    const notifResponseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.notification.request.content.data?.type === 'postcall') {
        openStoredPostCall();
      }
    });

    // Path 4: App comes to foreground → open any stored pending call
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        doSync();
        refreshFollowUpBadge();
        pollNativePending();
        openStoredPostCall();
        setTimeout(() => openStoredPostCall(), 1000);
      }
      appState.current = nextState;
    });

    // Path 5: Poll for native pending call only (does NOT open modal). Native now queues
    // pending calls instead of a single overwritable slot, so a slower poll can no longer
    // lose one — it just delays that call's popup by a few seconds.
    pollTimer.current = setInterval(pollNativePending, 10000);
    syncTimer.current = setInterval(doSync, 60_000);

    processPendingQueue().then(() => getPendingCount().then(setPendingCount));
    flushPendingNoteUpdates();
    refreshFollowUpBadge();
    pollNativePending();
    setTimeout(() => pollNativePending(), 1500);

    return () => {
      callEndedSub.remove();
      pendingSub.remove();
      notifResponseSub.remove();
      appStateSub.remove();
      clearInterval(syncTimer.current);
      clearInterval(pollTimer.current);
    };
  }, [screen]);

  const doSync = async () => {
    try { await syncCallLogs(); } catch {}
    flushPendingNoteUpdates();
  };

  const refreshFollowUpBadge = async () => {
    const list = await getPendingFollowUps();
    setFollowUpBadge(list.length);
    scheduleFollowUpNotifications();
  };

  const dismissPostCall = async () => {
    pendingCallRef.current = null;
    isHandlingRef.current  = false;
    setPendingCall(null);
    CallLogModule?.clearPendingCall?.();
    try { await AsyncStorage.removeItem(PENDING_CALL_KEY); } catch {}
  };

  if (screen === null) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: '#F8F9FB', justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#1A6BFF" />
        </View>
      </SafeAreaProvider>
    );
  }

  if (screen === 'login') {
    return (
      <SafeAreaProvider>
        <LoginScreen onLogin={() => setScreen('sim_select')} />
      </SafeAreaProvider>
    );
  }

  if (screen === 'sim_select') {
    return (
      <SafeAreaProvider>
        <SimSetupScreen onDone={async () => {
          const done = await AsyncStorage.getItem('miui_setup_done');
          setScreen(done ? 'main' : 'miui_setup');
        }} />
      </SafeAreaProvider>
    );
  }

  if (screen === 'miui_setup') {
    return (
      <SafeAreaProvider>
        <MiuiSetupScreen onDone={() => setScreen('main')} />
      </SafeAreaProvider>
    );
  }

  const handleLogout = () => {
    clearInterval(syncTimer.current);
    clearInterval(pollTimer.current);
    setupDoneRef.current = false;
    CallLogModule?.stopCallTrackService?.();
    setScreen('login');
    setTab('calls');
  };

  const handleNoteClose = () => {
    setNoteCall(null);
    refreshFollowUpBadge();
  };

  const badges = { followups: followUpBadge || undefined };

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: '#F8F9FB' }}>
        {pendingCount > 0 && (
          <View style={{ backgroundColor: '#F59E0B', paddingHorizontal: 16, paddingVertical: 6 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
              {pendingCount} call{pendingCount !== 1 ? 's' : ''} pending sync
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          {tab === 'calls'     && <CallHistoryScreen onAddNote={setNoteCall} onFollowUp={setNoteCall} />}
          {tab === 'analytics' && <AnalyticsScreen />}
          {tab === 'followups' && <FollowupsScreen  onAddNote={setNoteCall} />}
          {tab === 'leads'     && <LeadsScreen />}
          {tab === 'more'      && <MoreScreen onLogout={handleLogout} />}
        </View>
        <TabBar active={tab} onChange={setTab} badges={badges} />
      </View>

      {/* ── Post-call remarks modal (overlay — doesn't replace the main app) ── */}
      <Modal
        visible={!!pendingCall}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={dismissPostCall}
      >
        {pendingCall && (
          <PostCallScreen
            call={pendingCall}
            onDone={dismissPostCall}
          />
        )}
      </Modal>

      <AddNoteModal call={noteCall} visible={!!noteCall} onClose={handleNoteClose} />
    </SafeAreaProvider>
  );
}

AppRegistry.registerComponent('main', () => AppWithErrorBoundary);

function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;
