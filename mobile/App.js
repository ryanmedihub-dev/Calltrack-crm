import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ActivityIndicator, AppRegistry, AppState,
  NativeModules, PermissionsAndroid, Platform
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen       from './src/screens/LoginScreen';
import CallHistoryScreen from './src/screens/CallHistoryScreen';
import AnalyticsScreen   from './src/screens/AnalyticsScreen';
import FollowupsScreen   from './src/screens/FollowupsScreen';
import LeadsScreen       from './src/screens/LeadsScreen';
import MoreScreen        from './src/screens/MoreScreen';
import TabBar            from './src/components/TabBar';
import AfterCallModal    from './src/components/AfterCallModal';
import AddNoteModal      from './src/components/AddNoteModal';

import notifee, { TriggerType, AndroidImportance, AndroidCategory } from '@notifee/react-native';
import { requestCallPermissions, requestOverlayPermission, onCallEnded } from './src/services/phoneStateService';
import { applyTrackedSim } from './src/services/simService';
import { getPendingFollowUps } from './src/utils/callNotes';
import { syncCallLogs, processPendingQueue, getPendingCount } from './src/services/callLogService';

const { CallLogModule } = NativeModules;

async function requestNotificationPermission() {
  if (Platform.OS !== 'android') return;
  try {
    if (Platform.Version >= 33) {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
    }
  } catch {}
}

function App() {
  const [screen, setScreen]               = useState(null);
  const [tab, setTab]                     = useState('calls');
  const [pendingCall, setPendingCall]     = useState(null);
  const [noteCall, setNoteCall]           = useState(null);
  const [followUpBadge, setFollowUpBadge] = useState(0);
  const [pendingCount, setPendingCount]   = useState(0);
  const appState  = useRef(AppState.currentState);
  const syncTimer = useRef(null);

  // ── Auth restore ──────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('token')
      .then((t) => setScreen(t ? 'main' : 'login'))
      .catch(() => setScreen('login'));
  }, []);

  // ── Main setup once logged in ─────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'main') return;

    requestCallPermissions();
    requestNotificationPermission();
    requestOverlayPermission();
    applyTrackedSim();

    // Listen for calls that end while app is open
    const unsub = onCallEnded((data) => setPendingCall(data));

    // Flush any calls that failed to sync while offline
    processPendingQueue().then(() => getPendingCount().then(setPendingCount));

    // Check for call that happened while app was closed
    checkPendingCallWithRetry(8, 150);

    // Refresh follow-up badge
    refreshFollowUpBadge();

    // Live sync: when app comes back to foreground
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        checkPendingCallWithRetry(6, 100);
        doSync();
        refreshFollowUpBadge();
      }
      appState.current = nextState;
    });

    // Polling sync every 60 seconds while app is open
    syncTimer.current = setInterval(doSync, 60_000);

    return () => {
      unsub();
      appStateSub.remove();
      clearInterval(syncTimer.current);
    };
  }, [screen]);

  const checkPendingCallWithRetry = async (maxRetries, delayMs) => {
    for (let i = 0; i < maxRetries; i++) {
      await new Promise((r) => setTimeout(r, delayMs));
      try {
        const pending = await CallLogModule?.getPendingCall?.();
        if (pending?.callType) {
          setPendingCall(pending);
          // Clear the pending flag immediately so it doesn't fire again
          await CallLogModule?.clearPendingCall?.().catch(() => {});
          return;
        }
      } catch {}
    }
  };

  const doSync = async () => {
    try { await syncCallLogs(); } catch {}
  };

  const refreshFollowUpBadge = async () => {
    const list = await getPendingFollowUps();
    setFollowUpBadge(list.length);
    scheduleFollowUpNotifications();
  };

  const scheduleFollowUpNotifications = async () => {
    try {
      await notifee.createChannel({
        id:         'followups',
        name:       'Follow-up Reminders',
        importance: AndroidImportance.HIGH,
        sound:      'default',
      });

      const pending = await notifee.getTriggerNotifications();
      for (const n of pending) {
        if (n.notification?.data?.type === 'followup') {
          await notifee.cancelTriggerNotification(n.notification.id);
        }
      }

      const followUps = await getPendingFollowUps();
      for (const fu of followUps) {
        if (!fu.followUp?.date) continue;
        const fireAt = new Date(fu.followUp.date).getTime();
        if (fireAt <= Date.now()) continue;

        await notifee.createTriggerNotification(
          {
            id:    `followup_${fu.key}`,
            title: `📅 Follow-up: ${fu.contactName || fu.contactNumber || 'Contact'}`,
            body:  fu.note ? `Note: ${fu.note}` : `Time to follow up with ${fu.contactNumber}`,
            android: {
              channelId:   'followups',
              importance:  AndroidImportance.HIGH,
              category:    AndroidCategory.REMINDER,
              smallIcon:   'ic_notification',
              pressAction: { id: 'default' },
            },
            data: { type: 'followup', key: fu.key },
          },
          {
            type:      TriggerType.TIMESTAMP,
            timestamp: fireAt,
          }
        );
      }
    } catch (err) {
      console.warn('Notification schedule error:', err);
    }
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
        <LoginScreen onLogin={() => setScreen('main')} />
      </SafeAreaProvider>
    );
  }

  const handleLogout = () => {
    clearInterval(syncTimer.current);
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

      <AfterCallModal
        call={pendingCall}
        onClose={() => setPendingCall(null)}
      />

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
