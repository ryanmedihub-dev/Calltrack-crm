import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/shadows';

const C = {
  bg:      Colors.bg,
  primary: Colors.primary,
  text:    Colors.text,
  textSec: Colors.textSec,
  textMuted: Colors.textMuted,
  border:  Colors.border,
  surface: Colors.surface,
  primaryLight: Colors.primaryLight,
};

export default function LoginScreen({ onLogin }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { email: email.trim(), password });
      const { token, user } = res.data.data;
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      onLogin();
    } catch (err) {
      Alert.alert('Login Failed', err.response?.data?.error || 'Connection error. Check your internet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={s.root}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Top hero band */}
      <View style={s.heroBand}>
        <View style={s.heroDec1} />
        <View style={s.heroDec2} />
        <View style={s.logoWrap}>
          <View style={s.logoImgWrap}>
            <Image
              source={require('../../assets/logo.png')}
              style={s.logoImg}
              resizeMode="cover"
            />
          </View>
          <Text style={s.logoText}>CallTrack</Text>
          <Text style={s.tagline}>Employee Portal</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">

        {Platform.OS === 'ios' && (
          <View style={s.iosBanner}>
            <Text style={s.iosBannerText}>
              ⚠️ CallTrack is optimised for Android. Call log sync is not available on iOS.
            </Text>
          </View>
        )}

        {/* Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Sign in to continue</Text>
          <Text style={s.cardSub}>Enter your work credentials</Text>

          <Text style={s.label}>Email address</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="employee@company.com"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[s.label, { marginTop: 16 }]}>Password</Text>
          <View style={s.passWrap}>
            <TextInput
              style={[s.input, { flex: 1, marginBottom: 0 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPass}
            />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(!showPass)}>
              <Text style={s.eyeText}>{showPass ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={s.btnText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
          </TouchableOpacity>
        </View>

        {__DEV__ && <Text style={s.hint}>Demo: employee1@calltrack.com / password123</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.bg },

  heroBand: {
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === 'android' ? 48 : 64,
    paddingBottom: 36,
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroDec1: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -40, right: -40,
  },
  heroDec2: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)', bottom: -20, left: -20,
  },

  logoWrap:    { alignItems: 'center' },
  logoImgWrap: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden', marginBottom: 14,
    backgroundColor: '#000',
  },
  logoImg:    { width: '100%', height: '100%' },
  logoText:   { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  tagline:    { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 },

  inner: { flexGrow: 1, padding: 20, paddingTop: 24, paddingBottom: 40 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    ...Shadows.md,
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  cardSub:   { fontSize: 13, color: Colors.textMuted, marginBottom: 24 },

  label:  { color: Colors.textSec, fontSize: 13, fontWeight: '600', marginBottom: 7 },
  input:  {
    backgroundColor: Colors.bg,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    color: Colors.text, fontSize: 14,
  },

  passWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn:   { paddingHorizontal: 4 },
  eyeText:  { fontSize: 18 },

  btn:         { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, marginTop: 24, alignItems: 'center', ...Shadows.md },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 },

  hint: { color: Colors.textMuted, textAlign: 'center', fontSize: 11, marginTop: 20 },

  iosBanner:     { backgroundColor: '#FEF3C7', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16, borderWidth: 1, borderColor: '#FCD34D' },
  iosBannerText: { color: '#92400E', fontSize: 12, fontWeight: '500', textAlign: 'center' },
});
