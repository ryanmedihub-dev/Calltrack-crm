import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ActivityIndicator, AppRegistry, AppState,
  NativeModules, PermissionsAndroid, Platform
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen       from './src/screens/LoginScreen';
import SimSetupScreen    from './src/screens/SimSetupScreen';
import PostCallScreen    from './src/screens/PostCallScreen';
import CallHistoryScreen from './src/screens/CallHistoryScreen';
import AnalyticsScreen   from './src/screens/AnalyticsScreen';
import FollowupsScreen   from './src/screens/FollowupsScreen';
import LeadsScreen       from './src/screens/LeadsScreen';
import MoreScreen        from './src/screens/MoreScreen';
import TabBar            from './src/components/TabBar';
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
  // screen: null | "login" | "sim_select" | "main" | "postcall"
  const [screen, setScreen]           = useState(null);
  const [tab, setTab]                 = useState('calls');
  const [pendingCall, setPendingCall] = useState(null);
  const [noteCall, setNoteCall]       = useState(null);
  const [followUpBadge, setFollowUpBadge] = useState(0);
  const [pendingCount, setPendingCount]   = useState(0);
  const appState       = useRef(AppState.currentState);
  const syncTimer      = useRef(null);
  const pollTimer      = useRef(null);
  // Ref mirrors pendingCall state — avoids stale closure inside setInterval
  const pendingCallRef = useRef(null);

  // ── Auth restore ──────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('token')
      .then((t) => setScreen(t ? 'main' : 'login'))
      .catch(() => setScreen('login'));
  }, []);

  // ── Register logout callback ──────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'main') return;
    setLogoutCallback(() => {
      clearInterval(syncTimer.current);
      clearInterval(pollTimer.current);
      setScreen('login');
      setTab('calls');
    });
  }, [screen]);

  // ── Keep pendingCallRef in sync with state ───────────────────────────────
  useEffect(() => {
    pendingCallRef.current = pendingCall;
  }, [pendingCall]);

  // ── Main setup once logged in ─────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'main') return;

    requestCallPermissions();
    requestNotificationPermission();
    requestOverlayPermission();
    applyTrackedSim();

    // Helper: show post-call screen only when no call is already being handled
    const showPostCall = (data) => {
      if (pendingCallRef.current) return; // already showing one
      setPendingCall(data);
      setScreen('postcall');
    };

    // Real-time event from PhoneStateReceiver via DeviceEventEmitter
    const unsub = onCallEnded((data) => {
      showPostCall(data);
    });

    processPendingQueue().then(() => getPendingCount().then(setPendingCount));
    refreshFollowUpBadge();

    // When app returns from background, immediately check for any missed call event
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        doSync();
        refreshFollowUpBadge();
        // Check SharedPreferences for a call that was missed while backgrounded
        CallLogModule?.getPendingCall?.().then((pending) => {
          if (pending?.callType) showPostCall(pending);
        }).catch(() => {});
      }
      appState.current = nextState;
    });

    syncTimer.current = setInterval(doSync, 60_000);

    // Poll every 3 seconds as a safety net for devices where
    // DeviceEventEmitter delivery is unreliable (Xiaomi / MIUI).
    // Does NOT call setScreen inside a state-updater — uses the ref instead.
    pollTimer.current = setInterval(async () => {
      try {
        const pending = await CallLogModule?.getPendingCall?.();
        if (pending?.callType) showPostCall(pending);
      } catch {}
    }, 3000);

    return () => {
      unsub();
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

  // ── Loading ───────────────────────────────────────────────────────────────
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

  // ── SIM setup (shown once on every login so user confirms tracked SIM) ────────
  if (screen === 'sim_select') {
    return (
      <SafeAreaProvider>
        <SimSetupScreen onDone={() => setScreen('main')} />
      </SafeAreaProvider>
    );
  }

  // ── Post-call full-screen ─────────────────────────────────────────────────
  if (screen === 'postcall' && pendingCall) {
    return (
      <SafeAreaProvider>
        <PostCallScreen
          call={pendingCall}
          onDone={() => {
            pendingCallRef.current = null; // clear ref immediately so poll doesn't re-trigger
            CallLogModule?.clearPendingCall?.();
            setPendingCall(null);
            setScreen('main');
          }}
        />
      </SafeAreaProvider>
    );
  }

  // ── Main app ──────────────────────────────────────────────────────────────
  const handleLogout = () => {
    clearInterval(syncTimer.current);
    clearInterval(pollTimer.current);
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
              {pendingCount} call{pendingCount !== 1 ? 's' : ''} pending sync — will retry when online
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

AppRegistry.registerComponent('main', () => App);
export default App;
