import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';

const STEPS = [
  {
    num: '1',
    title: 'Open Security App',
    desc: 'Go to your phone\'s Settings → Apps → Manage Apps → CallTrack.',
    action: null,
  },
  {
    num: '2',
    title: 'Enable Autostart',
    desc: 'Tap "Autostart" and toggle it ON. This lets CallTrack start when you reboot.',
    action: null,
  },
  {
    num: '3',
    title: 'Set Battery Saver to No restrictions',
    desc: 'Tap "Battery Saver" → select "No restrictions" so MIUI won\'t kill the app.',
    action: null,
  },
  {
    num: '4',
    title: 'Grant Display pop-up windows permission',
    desc: 'Tap "Other permissions" → enable "Display pop-up windows while running in background".',
    action: 'miui_perm',
  },
];

export default function MiuiSetupScreen({ onDone }) {
  const [step, setStep] = useState(0);

  const isLast = step === STEPS.length - 1;

  const handleNext = async () => {
    if (isLast) {
      await AsyncStorage.setItem('miui_setup_done', '1');
      onDone();
    } else {
      setStep((s) => s + 1);
    }
  };

  const openMiuiPerms = () => {
    Linking.openURL('miui://settings/manage_applications').catch(() => {
      Linking.openURL('package:' + 'com.calltrack.app').catch(() => {});
    });
  };

  const s = STEPS[step];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.badge}>MIUI / HyperOS Setup</Text>
        </View>

        <Text style={styles.headline}>One-time Setup</Text>
        <Text style={styles.sub}>
          Xiaomi / Redmi devices can stop background apps. Complete these steps so
          CallTrack always detects your calls.
        </Text>

        {/* Progress dots */}
        <View style={styles.dotsRow}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]} />
          ))}
        </View>

        {/* Step card */}
        <View style={styles.card}>
          <View style={styles.stepNumWrap}>
            <Text style={styles.stepNum}>{s.num}</Text>
          </View>
          <Text style={styles.stepTitle}>{s.title}</Text>
          <Text style={styles.stepDesc}>{s.desc}</Text>

          {s.action === 'miui_perm' && (
            <TouchableOpacity style={styles.linkBtn} onPress={openMiuiPerms}>
              <Text style={styles.linkBtnText}>Open App Settings</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Navigation */}
        <View style={styles.navRow}>
          {step > 0 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => s - 1)}>
              <Text style={styles.backTxt}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.nextBtn, step === 0 && { flex: 1 }]} onPress={handleNext}>
            <Text style={styles.nextTxt}>{isLast ? 'Done' : 'Next'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={async () => {
          await AsyncStorage.setItem('miui_setup_done', '1');
          onDone();
        }}>
          <Text style={styles.skip}>Skip — I'll do this later</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, paddingBottom: 40 },

  headerRow: { alignItems: 'flex-start', marginBottom: 16 },
  badge: {
    fontSize: 11, fontWeight: '700', color: '#F47B15',
    backgroundColor: '#FFF4E8', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, overflow: 'hidden', letterSpacing: 0.5,
  },

  headline: { fontSize: 26, fontWeight: '800', color: '#111', marginBottom: 8 },
  sub: { fontSize: 14, color: '#666', lineHeight: 21, marginBottom: 24 },

  dotsRow: { flexDirection: 'row', gap: 8, marginBottom: 28 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' },
  dotActive: { backgroundColor: '#1A6BFF', width: 24 },
  dotDone: { backgroundColor: '#22C55E' },

  card: {
    backgroundColor: '#F8F9FB', borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: '#E9EBF0', marginBottom: 28,
  },
  stepNumWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1A6BFF', justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  stepNum: { fontSize: 20, fontWeight: '800', color: '#fff' },
  stepTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 10 },
  stepDesc: { fontSize: 14, color: '#555', lineHeight: 22 },

  linkBtn: {
    marginTop: 16, backgroundColor: '#1A6BFF', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  linkBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  navRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  backBtn: {
    flex: 1, height: 50, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#D1D5DB',
    justifyContent: 'center', alignItems: 'center',
  },
  backTxt: { fontSize: 15, fontWeight: '600', color: '#444' },
  nextBtn: {
    flex: 2, height: 50, borderRadius: 12,
    backgroundColor: '#1A6BFF', justifyContent: 'center', alignItems: 'center',
  },
  nextTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },

  skip: { textAlign: 'center', fontSize: 13, color: '#9CA3AF', textDecorationLine: 'underline' },
});
