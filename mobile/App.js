import './src/config/ReactotronConfig';
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ActivityIndicator, AppRegistry, AppState,
  NativeModules, PermissionsAndroid, Platform, DeviceEventEmitter
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
import { requestCallPermissions, requestOverlayPermission, onCallEnded } from './src/services/phoneStateService';
import { applyTrackedSim } from './src/services/simService';
import { getPendingFollowUps } from './src/utils/callNotes';
import { syncCallLogs, processPendingQueue, getPendingCount } from './src/services/callLogService';
import { setLogoutCallback } from './src/lib/api';

const { CallLogModule } = NativeModules;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
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
      const d = new Date(fu.followUp.date);
      const hour = d.getHours() || 9;
      const fireAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0, 0);
      if (fireAt.getTime() <= Date.now()) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `followup_${fu.key}`,
        content: {
          title: `📅 Follow-up: ${fu.contactName || fu.contactNumber || 'Contact'}`,
          body: fu.note ? `Note: ${fu.note}` : 'Time to follow up',
          data: { type: 'followup', key: fu.key },
          sound: true,
        },
        trigger: { date: fireAt },
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
  const setupDoneRef   = useRef(false);

  useEffect(() => { pendingCallRef.current = pendingCall; }, [pendingCall]);
  useEffect(() => { screenRef.current = screen; }, [screen]);

  // ── Auth restore ──────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('token')
      .then((t) => setScreen(t ? 'main' : 'login'))
      .catch(() => setScreen('login'));
  }, []);

  // ── Main setup ────────────────────────────────────────────────────────────
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

    // ── SINGLE GATE — sab paths yahan se jaate hain ───────────────────────
    const showPostCall = (data) => {
      if (pendingCallRef.current) return;
      if (isHandlingRef.current) return;
      isHandlingRef.current = true;

      setPendingCall(data);
      setScreen('postcall');

      if (AppState.currentState !== 'active') {
        CallLogModule?.bringAppToForeground?.();
      }

      setTimeout(() => { isHandlingRef.current = false; }, 2000);
    };

    // SharedPreferences se pending call fetch karke show karo
    const checkAndShowPending = async () => {
      if (screenRef.current === 'postcall') return;
      if (pendingCallRef.current) return;
      if (isHandlingRef.current) return;
      try {
        const pending = await CallLogModule?.getPendingCall?.();
        if (pending?.callType) showPostCall(pending);
      } catch {}
    };

    // ── Path 1: DeviceEventEmitter (app foreground mein thi) ─────────────
    const unsub = onCallEnded((data) => showPostCall(data));

    // ── Path 2: MainActivity.onResume ne fire kiya ────────────────────────
    // MIUI ne app kill ki → PhoneStateReceiver ne SharedPreferences mein
    // pending save kiya → app restart hui → onResume ne yeh event fire kiya
    const pendingSub = DeviceEventEmitter.addListener(
      'onPendingCallAvailable',
      () => checkAndShowPending()
    );

    // ── Path 3: AppState resume (background se foreground aaya) ──────────
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        doSync();
        refreshFollowUpBadge();
        checkAndShowPending();
      }
      appState.current = nextState;
    });

    // ── Path 4: Poll every 2s (final safety net) ──────────────────────────
    pollTimer.current = setInterval(checkAndShowPending, 2000);

    syncTimer.current = setInterval(doSync, 60_000);

    processPendingQueue().then(() => getPendingCount().then(setPendingCount));
    refreshFollowUpBadge();

    // Startup check — already pending tha toh turant dikha do
    checkAndShowPending();

    return () => {
      unsub();
      pendingSub.remove();
      appStateSub.remove();
      clearInterval(syncTimer.current);
      clearInterval(pollTimer.current);
    };
  }, [screen]);

  const doSync = async () => {
    try { await syncCallLogs(); } catch {}
  };

  const refreshFollowUpBadge = async () => {
    const list = await getPendingFollowUps();
    setFollowUpBadge(list.length);
    scheduleFollowUpNotifications();
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

  if (screen === 'postcall' && pendingCall) {
    return (
      <SafeAreaProvider>
        <PostCallScreen
          call={pendingCall}
          onDone={() => {
            pendingCallRef.current = null;
            isHandlingRef.current  = false;
            setPendingCall(null);
            CallLogModule?.clearPendingCall?.();
            setScreen('main');
          }}
        />
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

      <AddNoteModal
        call={noteCall}
        visible={!!noteCall}
        onClose={handleNoteClose}
      />
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
