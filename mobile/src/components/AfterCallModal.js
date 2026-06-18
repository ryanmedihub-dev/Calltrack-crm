import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, Animated, Keyboard, StatusBar,
  ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';
import { saveCallLog, syncCallLogs } from '../services/callLogService';
import { saveNote } from '../utils/callNotes';
import { Colors } from '../theme/colors';
import ContactAvatar from './ContactAvatar';

const STATUSES = [
  { label: 'Interested',     icon: '👍', color: '#16A34A', bg: '#DCFCE7' },
  { label: 'Callback',       icon: '📞', color: '#1A6BFF', bg: '#EBF2FF' },
  { label: 'Not Interested', icon: '👎', color: '#DC2626', bg: '#FEE2E2' },
  { label: 'Price Enquiry',  icon: '💰', color: '#D97706', bg: '#FEF3C7' },
  { label: 'Converted',      icon: '🎉', color: '#16A34A', bg: '#DCFCE7' },
  { label: 'Follow Up',      icon: '📅', color: '#7C3AED', bg: '#EDE9FE' },
  { label: 'Wrong Number',   icon: '🚫', color: '#64748B', bg: '#F1F5F9' },
  { label: 'No Response',    icon: '🔕', color: '#DC2626', bg: '#FEE2E2' },
];

const FOLLOWUP_SLOTS = [
  { label: '1 Hour',   ms: 60 * 60 * 1000 },
  { label: 'Tomorrow', ms: 24 * 60 * 60 * 1000 },
  { label: '2 Days',   ms: 2 * 24 * 60 * 60 * 1000 },
  { label: '1 Week',   ms: 7 * 24 * 60 * 60 * 1000 },
];

const TYPE_CONFIG = {
  incoming:  { color: '#16A34A', bg: '#DCFCE7', label: 'Incoming',  icon: '↙' },
  outgoing:  { color: '#D97706', bg: '#FEF3C7', label: 'Outgoing',  icon: '↗' },
  missed:    { color: '#DC2626', bg: '#FEE2E2', label: 'Missed',    icon: '↙' },
  rejected:  { color: '#DC2626', bg: '#FEE2E2', label: 'Rejected',  icon: '✕' },
};

const AUTO_DISMISS_SEC = 30;

function fmtDur(sec) {
  if (!sec || sec < 1) return '0s';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// Strips all non-digit chars for a phone-number comparison that ignores formatting
function digitsOnly(str) {
  return (str || '').replace(/\D/g, '');
}

export default function AfterCallModal({ call, onClose }) {
  const [status,       setStatus]     = useState(null);
  const [note,         setNote]       = useState('');
  const [followUpDate, setFollowDate] = useState(null);
  const [showSlots,    setShowSlots]  = useState(false);
  const [saving,       setSaving]     = useState(false);
  const [countdown,    setCountdown]  = useState(AUTO_DISMISS_SEC);
  const [interacted,   setInteracted] = useState(false);

  const timerRef = useRef(null);
  const progAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!call) return;
    setStatus(null); setNote(''); setFollowDate(null);
    setShowSlots(false); setInteracted(false); setCountdown(AUTO_DISMISS_SEC);
    progAnim.setValue(1);

    Animated.timing(progAnim, {
      toValue: 0, duration: AUTO_DISMISS_SEC * 1000, useNativeDriver: false,
    }).start();

    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); handleDismiss(); return 0; }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [call]);

  const touch = () => {
    if (!interacted) {
      clearInterval(timerRef.current);
      progAnim.stopAnimation();
      setInteracted(true);
    }
  };

  const handleDismiss = () => {
    clearInterval(timerRef.current);
    onClose?.();
  };

  const handleSave = async () => {
    if (!call) return;
    clearInterval(timerRef.current);
    setSaving(true);
    Keyboard.dismiss();

    const enriched = {
      ...call,
      status:       status || undefined,
      notes:        note.trim() || undefined,
      tags:         status ? [status] : [],
      followUpDate: followUpDate || undefined,
    };

    try {
      await saveCallLog(enriched);
      if (note.trim() || status || followUpDate) {
        await saveNote(call, {
          note:     note.trim(),
          tags:     status ? [status] : [],
          followUp: followUpDate ? { date: followUpDate, done: false } : null,
        });
      }
      await syncCallLogs();

      // PATCH the call record directly — needed when the call already existed
      // before the user added status/notes (background sync ran first)
      if (note.trim() || status) {
        try {
          const stored = await AsyncStorage.getItem('user');
          const userId = stored ? JSON.parse(stored)._id : null;
          if (userId) {
            // Use a generous limit and normalize phone numbers for matching
            const feedRes = await api.get(`/api/calls/employee/${userId}`, {
              params: { page: 1, limit: 100 },
            });
            const feedCalls = feedRes.data.data?.calls || [];
            const callDigits = digitsOnly(call.contactNumber);
            const callTs     = new Date(call.timestamp).getTime();

            const matched = feedCalls.find((c) => {
              const samePhone = digitsOnly(c.contactNumber).endsWith(callDigits) ||
                                callDigits.endsWith(digitsOnly(c.contactNumber));
              const timeDiff  = Math.abs(new Date(c.timestamp).getTime() - callTs);
              return samePhone && timeDiff < 120_000; // within 2 minutes
            });

            if (matched) {
              await api.patch(`/api/calls/${matched._id}/notes`, {
                notes:      note.trim() || undefined,
                callTags:   status ? [status] : [],
                callStatus: status || null,
              });
            }
          }
        } catch {}
      }
    } catch {}

    setSaving(false);
    onClose?.();
  };

  if (!call) return null;

  const typeConf = TYPE_CONFIG[call.callType] || { color: '#64748B', bg: '#F1F5F9', label: call.callType, icon: '↕' };

  return (
    <Modal
      animationType="slide"
      visible={!!call}
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={typeConf.color} />

        {/* ── Header ── */}
        <View style={[s.header, { backgroundColor: typeConf.color }]}>
          <View style={s.headerTop}>
            <ContactAvatar name={call.contactName} number={call.contactNumber} size={44} />
            <View style={s.headerInfo}>
              <Text style={s.contactName} numberOfLines={1}>
                {call.contactName || 'Unknown'}
              </Text>
              <Text style={s.contactNum}>{call.contactNumber}</Text>
            </View>
            <View style={[s.typePill, { backgroundColor: 'rgba(0,0,0,0.15)' }]}>
              <Text style={s.typePillText}>{typeConf.icon} {typeConf.label}</Text>
              <Text style={s.durText}>{fmtDur(call.duration)}</Text>
            </View>
          </View>

          {/* Auto-dismiss progress bar */}
          {!interacted && (
            <View style={s.progressTrack}>
              <Animated.View style={[s.progressBar, {
                width: progAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              }]} />
            </View>
          )}
        </View>

        {/* ── Body ── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity activeOpacity={1} onPress={touch}>

            {!interacted && (
              <Text style={s.dismissHint}>Auto-dismissing in {countdown}s · Tap to keep open</Text>
            )}

            <Text style={s.sectionLabel}>How did the call go?</Text>
            <View style={s.chipGrid}>
              {STATUSES.map((item) => {
                const active = status === item.label;
                return (
                  <TouchableOpacity
                    key={item.label}
                    style={[s.chip, active && { backgroundColor: item.bg, borderColor: item.color, borderWidth: 1.5 }]}
                    onPress={() => { touch(); setStatus(active ? null : item.label); }}
                    activeOpacity={0.75}
                  >
                    <Text style={s.chipIcon}>{item.icon}</Text>
                    <Text style={[s.chipLabel, active && { color: item.color, fontWeight: '700' }]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.sectionLabel}>Remarks</Text>
            <TextInput
              style={s.noteInput}
              placeholder="Add a remark… (optional)"
              placeholderTextColor="#94A3B8"
              value={note}
              onChangeText={(v) => { touch(); setNote(v); }}
              multiline
              maxLength={400}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[s.fuBtn, followUpDate && { borderColor: '#7C3AED', backgroundColor: '#EDE9FE' }]}
              onPress={() => { touch(); setShowSlots(!showSlots); }}
            >
              <Text style={{ fontSize: 14 }}>📅</Text>
              <Text style={[s.fuBtnText, followUpDate && { color: '#7C3AED' }]}>
                {followUpDate
                  ? new Date(followUpDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : 'Set follow-up reminder'}
              </Text>
              {followUpDate
                ? <TouchableOpacity onPress={(e) => { e.stopPropagation(); setFollowDate(null); }}>
                    <Text style={s.fuClear}>✕</Text>
                  </TouchableOpacity>
                : <Text style={s.fuArrow}>›</Text>}
            </TouchableOpacity>

            {showSlots && (
              <View style={s.slotsRow}>
                {FOLLOWUP_SLOTS.map((sl) => (
                  <TouchableOpacity
                    key={sl.label}
                    style={s.slotBtn}
                    onPress={() => { setFollowDate(new Date(Date.now() + sl.ms).toISOString()); setShowSlots(false); }}
                  >
                    <Text style={s.slotText}>{sl.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

          </TouchableOpacity>
        </ScrollView>

        {/* ── Footer ── */}
        <View style={s.footer}>
          <TouchableOpacity style={s.skipBtn} onPress={handleDismiss} disabled={saving}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: status ? Colors.primary : '#0F172A' }, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.saveBtnText}>{status ? `Save — ${status}` : 'Save & Sync'}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FB' },

  header:    { paddingTop: Platform.OS === 'android' ? 36 : 52, paddingBottom: 12, paddingHorizontal: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerInfo:{ flex: 1 },
  contactName:{ fontSize: 17, fontWeight: '700', color: '#fff' },
  contactNum: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  typePill:   { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center' },
  typePillText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  durText:    { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginTop: 2 },

  progressTrack: { height: 3, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  progressBar:   { height: 3, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 2 },

  body:         { padding: 18, paddingBottom: 8 },
  dismissHint:  { fontSize: 11, color: '#94A3B8', textAlign: 'center', marginBottom: 14 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },

  chipGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 18 },
  chip:       { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#E2E8F0' },
  chipIcon:   { fontSize: 13 },
  chipLabel:  { fontSize: 12, fontWeight: '600', color: '#64748B' },

  noteInput: {
    backgroundColor: '#fff', borderRadius: 10, padding: 12,
    fontSize: 13, color: '#0F172A', minHeight: 70, marginBottom: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
  },

  fuBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  fuBtnText:{ flex: 1, fontSize: 13, color: '#64748B', fontWeight: '500' },
  fuClear:  { color: '#94A3B8', fontSize: 14, paddingHorizontal: 4 },
  fuArrow:  { color: '#94A3B8', fontSize: 20, lineHeight: 22 },

  slotsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  slotBtn:  { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  slotText: { fontSize: 12, fontWeight: '600', color: '#334155' },

  footer:   { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#fff', paddingBottom: Platform.OS === 'ios' ? 32 : 16 },
  skipBtn:  { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  skipText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  saveBtn:  { flex: 2, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
