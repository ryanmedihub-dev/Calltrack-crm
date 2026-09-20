import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Keyboard, StatusBar, Linking,
  ActivityIndicator, ScrollView, Platform, BackHandler, Modal,
} from 'react-native';
import { setItem } from '../lib/storage';
import { saveCallLog, syncCallLogs, flushPendingEnriches } from '../services/callLogService';
import { saveNote } from '../utils/callNotes';
import { Colors } from '../theme/colors';
import ContactAvatar from '../components/ContactAvatar';
import MiniCalendar from '../components/MiniCalendar';
import { AUTO_SKIP_MS, FEATURES, deriveEngagementLocal } from '../constants';

// Status keys match backend enum exactly
const STATUSES = [
  { key: 'interested',     label: 'Interested',     icon: '👍', color: '#16A34A', bg: '#DCFCE7' },
  { key: 'contacted',      label: 'Contacted',      icon: '📞', color: '#1A6BFF', bg: '#EBF2FF' },
  { key: 'not_connected',  label: 'Not Connected',  icon: '📵', color: '#94A3B8', bg: '#F1F5F9' },
  { key: 'not_interested', label: 'Not Interested', icon: '👎', color: '#DC2626', bg: '#FEE2E2' },
  { key: 'follow_up',      label: 'Follow Up',      icon: '📅', color: '#7C3AED', bg: '#EDE9FE' },
  { key: 'booking_done',   label: 'Booking Done',   icon: '✅', color: '#059669', bg: '#D1FAE5' },
  { key: 'converted',      label: 'Converted',      icon: '🎉', color: '#059669', bg: '#D1FAE5' },
  { key: 'lost',           label: 'Lost',           icon: '💀', color: '#64748B', bg: '#F3F4F6' },
];

const FOLLOWUP_SLOTS = [
  { label: '1 Hour',      ms: 60 * 60 * 1000 },
  { label: 'Tomorrow',    ms: 24 * 60 * 60 * 1000 },
  { label: '2 Days',      ms: 2 * 24 * 60 * 60 * 1000 },
  { label: '1 Week',      ms: 7 * 24 * 60 * 60 * 1000 },
  { label: 'Custom Date', ms: null },
];

const HOUR_SLOTS = [
  { label: '6 AM',  h: 6  }, { label: '7 AM',  h: 7  }, { label: '8 AM',  h: 8  },
  { label: '9 AM',  h: 9  }, { label: '10 AM', h: 10 }, { label: '11 AM', h: 11 },
  { label: '12 PM', h: 12 }, { label: '1 PM',  h: 13 }, { label: '2 PM',  h: 14 },
  { label: '3 PM',  h: 15 }, { label: '4 PM',  h: 16 }, { label: '5 PM',  h: 17 },
  { label: '6 PM',  h: 18 }, { label: '7 PM',  h: 19 }, { label: '8 PM',  h: 20 },
  { label: '9 PM',  h: 21 }, { label: '10 PM', h: 22 },
];

const TYPE_CONFIG = {
  incoming: { color: '#16A34A', bg: '#DCFCE7', label: 'Incoming', icon: '↙' },
  outgoing: { color: '#D97706', bg: '#FEF3C7', label: 'Outgoing', icon: '↗' },
  missed:   { color: '#DC2626', bg: '#FEE2E2', label: 'Missed',   icon: '↙' },
  rejected: { color: '#DC2626', bg: '#FEE2E2', label: 'Rejected', icon: '✕' },
};

function fmtDur(sec) {
  if (!sec || sec < 1) return '0s';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function digitsOnly(str) {
  return (str || '').replace(/\D/g, '');
}

async function openWhatsApp(contactNumber) {
  const digits = digitsOnly(contactNumber);
  const phone  = digits.length === 10 ? `91${digits}` : digits;
  try {
    await Linking.openURL(`whatsapp://send?phone=${phone}`);
  } catch {
    try {
      await Linking.openURL(`https://wa.me/${phone}`);
    } catch {}
  }
}

export default function PostCallScreen({ call, onDone }) {
  const [status,         setStatus]         = useState(null);
  const [note,           setNote]           = useState('');
  const [followUpDate,   setFollowDate]     = useState(null);
  const [showSlots,      setShowSlots]      = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [savingWa,       setSavingWa]       = useState(false);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customDateStep, setCustomDateStep] = useState('date');
  const [tempDate,       setTempDate]       = useState(null);
  const [tempHour,       setTempHour]       = useState(9);

  // Block hardware back — user must explicitly Save or Skip
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const handleSkip = () => {
    if (saving || savingWa) return;
    // Forced: App.js already fired a sync when onCallEnded arrived seconds ago, so an
    // unforced call here would hit the 15s cooldown and this call would sit unsent until
    // the next 60s timer tick.
    syncCallLogs(true).catch(() => {}); // fire-and-forget so a skipped call still syncs promptly
    onDone();
  };

  // Bounded popup lifetime: if the user hasn't tapped Save within 2 minutes (ignored it,
  // locked the phone, moved on), auto-skip rather than leave it open/persisted indefinitely —
  // the call is already reachable in Call History either way, remark or not. Doesn't reset on
  // typing, so behavior stays predictable regardless of partial input.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!saving && !savingWa) handleSkip();
    }, AUTO_SKIP_MS);
    return () => clearTimeout(timer);
  }, []);

  // Fast, local-only writes — awaited before the modal closes. Finding/creating the
  // matching lead now happens server-side in POST /api/calls/sync (it already knows the
  // employee and the exact contact number, so it doesn't need to guess), which is what
  // lets Save close the modal immediately instead of waiting on ~8 sequential round trips.
  const doSaveLocal = async () => {
    // One clock for this whole save, shared by the local row and the enrich entry, so the
    // server sees a single consistent edit time no matter which path reaches it first.
    const editedAt = new Date().toISOString();
    const remark = note.trim();

    const enriched = {
      ...call,
      status:       status || undefined,
      // Send the string as-is, not `|| undefined` — an emptied remark is a deliberate clear
      // and has to reach the server as an empty string to actually clear it there.
      notes:        remark,
      tags:         status ? [status] : [],
      followUpDate: followUpDate || undefined,
      notesUpdatedAt: editedAt,
      // Tells the backend sync this call was actually submitted (Save tapped), not just
      // picked up by a routine background resync — gates lead creation/status updates.
      submittedViaPostCall: true,
    };

    await saveCallLog(enriched);

    if (remark || status || followUpDate) {
      await saveNote(call, {
        note:     remark,
        tags:     status ? [status] : [],
        followUp: followUpDate ? { date: followUpDate, done: false } : null,
      });
    }

    if (remark || status) {
      try {
        setItem(
          `calltrack_pending_enrich_${Date.now()}`,
          JSON.stringify({
            contactNumber:   call.contactNumber,
            clientCallId:    call.clientCallId,
            timestampApprox: call.timestamp,
            notes:           remark,
            status:          status || undefined,
            tags:            status ? [status] : [],
            notesUpdatedAt:  editedAt,
            savedAt:         Date.now(), // drives the 24h TTL in flushPendingEnriches
          })
        );
      } catch {}
    }
  };

  // Network sync — runs in the background after the modal has already closed. Existing
  // retry infra (syncCallLogs' own pending queue, flushPendingEnriches' per-key retry)
  // already covers retrying on failure, so this doesn't need its own queue.
  const doSaveRemote = async () => {
    // Forced: App.js fired a sync when the call ended seconds ago, so an unforced call here
    // would hit the 15s cooldown, send nothing, and leave the remark waiting for the 60s timer.
    await syncCallLogs(true);
    await flushPendingEnriches().catch(() => {});
  };

  const handleSave = async () => {
    if (!call) return;
    setSaving(true);
    Keyboard.dismiss();
    try { await doSaveLocal(); } catch {}
    doSaveRemote().catch(() => {});
    setSaving(false);
    onDone();
  };

  const handleSaveAndWhatsApp = async () => {
    if (!call) return;
    setSavingWa(true);
    Keyboard.dismiss();
    try { await doSaveLocal(); } catch {}
    doSaveRemote().catch(() => {});
    // Open WhatsApp BEFORE closing the screen — await ensures the intent is dispatched
    await openWhatsApp(call.contactNumber);
    setSavingWa(false);
    onDone();
  };

  const typeConf = TYPE_CONFIG[call.callType] || { color: '#64748B', bg: '#F1F5F9', label: call.callType, icon: '↕' };
  const activeStatus = STATUSES.find((s) => s.key === status);
  // Read-only preview of the band the server will derive at sync time (see
  // backend/lib/engagement.js) — the agent sees it immediately instead of waiting for a sync.
  const engagementBand = deriveEngagementLocal(call.callType, call.duration);

  return (
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
          <View style={[s.typePill, { backgroundColor: 'rgba(0,0,0,0.18)' }]}>
            <Text style={s.typePillText}>{typeConf.icon} {typeConf.label}</Text>
            <Text style={s.durText}>{fmtDur(call.duration)}</Text>
          </View>
        </View>

        {/* Active status preview in header (only when the manual picker is on) */}
        {FEATURES.MANUAL_STATUS_PICKER && activeStatus && (
          <View style={[s.headerStatusPill, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
            <Text style={s.headerStatusText}>{activeStatus.icon} {activeStatus.label}</Text>
          </View>
        )}
        {/* Read-only engagement band preview — what the server will derive at sync time */}
        {!FEATURES.MANUAL_STATUS_PICKER && (
          <View style={[s.headerStatusPill, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
            <Text style={s.headerStatusText}>{engagementBand.label} · {fmtDur(call.duration)}</Text>
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
        {FEATURES.MANUAL_STATUS_PICKER && (
          <>
            <Text style={s.sectionLabel}>Call Outcome</Text>
            <View style={s.chipGrid}>
              {STATUSES.map((item) => {
                const active = status === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      s.chip,
                      active && { backgroundColor: item.bg, borderColor: item.color, borderWidth: 2 },
                    ]}
                    onPress={() => setStatus(active ? null : item.key)}
                    activeOpacity={0.75}
                  >
                    <Text style={s.chipIcon}>{item.icon}</Text>
                    <Text style={[s.chipLabel, active && { color: item.color, fontWeight: '700' }]}>
                      {item.label}
                    </Text>
                    {active && (
                      <View style={[s.checkDot, { backgroundColor: item.color }]}>
                        <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <Text style={s.sectionLabel}>Remarks</Text>
        <TextInput
          style={s.noteInput}
          placeholder="Add a remark or note… (optional)"
          placeholderTextColor="#94A3B8"
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={400}
          textAlignVertical="top"
        />

        {/* Follow-up */}
        <TouchableOpacity
          style={[s.fuBtn, followUpDate && { borderColor: '#7C3AED', backgroundColor: '#EDE9FE' }]}
          onPress={() => setShowSlots(!showSlots)}
        >
          <Text style={{ fontSize: 14 }}>📅</Text>
          <Text style={[s.fuBtnText, followUpDate && { color: '#7C3AED' }]}>
            {followUpDate
              ? new Date(followUpDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
              : 'Set follow-up reminder'}
          </Text>
          {followUpDate
            ? (
              <TouchableOpacity onPress={(e) => { e?.stopPropagation?.(); setFollowDate(null); }}>
                <Text style={s.fuClear}>✕</Text>
              </TouchableOpacity>
            )
            : <Text style={s.fuArrow}>›</Text>}
        </TouchableOpacity>

        {showSlots && (
          <View style={s.slotsRow}>
            {FOLLOWUP_SLOTS.map((sl) => (
              <TouchableOpacity
                key={sl.label}
                style={sl.ms === null ? s.slotBtnCustom : s.slotBtn}
                onPress={() => {
                  if (sl.ms === null) {
                    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
                    setTempDate(tomorrow);
                    setTempHour(9);
                    setCustomDateStep('date');
                    setShowCustomDate(true);
                    setShowSlots(false);
                  } else {
                    setFollowDate(new Date(Date.now() + sl.ms).toISOString());
                    setShowSlots(false);
                  }
                }}
              >
                <Text style={sl.ms === null ? s.slotTextCustom : s.slotText}>{sl.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Footer ── */}
      <View style={s.footer}>
        <TouchableOpacity style={s.skipBtn} onPress={handleSkip} disabled={saving || savingWa}>
          <Text style={s.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* WhatsApp button */}
        <TouchableOpacity
          style={[s.waBtn, (saving || savingWa) && { opacity: 0.6 }]}
          onPress={handleSaveAndWhatsApp}
          disabled={saving || savingWa}
        >
          {savingWa
            ? <ActivityIndicator color="#fff" size="small" />
            : (
              <View style={s.waBtnInner}>
                <Text style={s.waIcon}>💬</Text>
                <Text style={s.waBtnText}>WhatsApp</Text>
              </View>
            )}
        </TouchableOpacity>

        {/* Save button */}
        <TouchableOpacity
          style={[
            s.saveBtn,
            { backgroundColor: activeStatus ? activeStatus.color : '#0F172A' },
            (saving || savingWa) && { opacity: 0.6 },
          ]}
          onPress={handleSave}
          disabled={saving || savingWa}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.saveBtnText}>{activeStatus ? `Save` : 'Save & Sync'}</Text>}
        </TouchableOpacity>
      </View>

      {/* ── Custom date picker ── */}
      <Modal
        visible={showCustomDate}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowCustomDate(false)}
      >
        <View style={s.cdOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowCustomDate(false)} />
          <View style={s.cdSheet}>
            <View style={s.cdHandle} />
            <View style={s.cdStepRow}>
              <TouchableOpacity
                style={[s.cdStepBtn, customDateStep === 'date' && s.cdStepBtnActive]}
                onPress={() => setCustomDateStep('date')}
              >
                <Text style={[s.cdStepText, customDateStep === 'date' && s.cdStepTextActive]}>📅 Pick Date</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.cdStepBtn, customDateStep === 'time' && s.cdStepBtnActive]}
                onPress={() => setCustomDateStep('time')}
                disabled={!tempDate}
              >
                <Text style={[s.cdStepText, customDateStep === 'time' && s.cdStepTextActive, !tempDate && { opacity: 0.4 }]}>
                  🕐 Pick Time
                </Text>
              </TouchableOpacity>
            </View>

            {customDateStep === 'date' && (
              <View style={s.cdCalWrap}>
                <MiniCalendar
                  value={tempDate}
                  onChange={(d) => { setTempDate(d); setCustomDateStep('time'); }}
                  minDate={new Date()}
                />
              </View>
            )}

            {customDateStep === 'time' && (
              <View>
                <Text style={s.cdTimeLabel}>
                  {tempDate ? tempDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                  {' · '}
                  {HOUR_SLOTS.find((h) => h.h === tempHour)?.label || '9 AM'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cdHourRow}>
                  {HOUR_SLOTS.map((slot) => (
                    <TouchableOpacity
                      key={slot.h}
                      style={[s.cdHourSlot, tempHour === slot.h && s.cdHourSlotActive]}
                      onPress={() => setTempHour(slot.h)}
                    >
                      <Text style={[s.cdHourText, tempHour === slot.h && s.cdHourTextActive]}>
                        {slot.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity
              style={[s.cdConfirmBtn, !tempDate && { opacity: 0.5 }]}
              onPress={() => {
                if (!tempDate) return;
                const d = new Date(tempDate);
                d.setHours(tempHour, 0, 0, 0);
                setFollowDate(d.toISOString());
                setShowCustomDate(false);
              }}
              disabled={!tempDate}
            >
              <Text style={s.cdConfirmText}>Set Reminder</Text>
            </TouchableOpacity>
            <View style={{ height: 16 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FB' },

  header:    { paddingTop: Platform.OS === 'android' ? 36 : 52, paddingBottom: 14, paddingHorizontal: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerInfo:{ flex: 1 },
  contactName:  { fontSize: 17, fontWeight: '700', color: '#fff' },
  contactNum:   { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  typePill:     { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center' },
  typePillText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  durText:      { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginTop: 2 },

  headerStatusPill: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginTop: 10 },
  headerStatusText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  body:         { padding: 18, paddingBottom: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 18 },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E2E8F0', position: 'relative' },
  chipIcon: { fontSize: 13 },
  chipLabel:{ fontSize: 12, fontWeight: '600', color: '#64748B' },
  checkDot: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },

  noteInput: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    fontSize: 13, color: '#0F172A', minHeight: 72, marginBottom: 14,
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },

  fuBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, padding: 13, marginBottom: 8, borderWidth: 1.5, borderColor: '#E2E8F0' },
  fuBtnText:{ flex: 1, fontSize: 13, color: '#64748B', fontWeight: '500' },
  fuClear:  { color: '#94A3B8', fontSize: 14, paddingHorizontal: 4 },
  fuArrow:  { color: '#94A3B8', fontSize: 20, lineHeight: 22 },

  slotsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  slotBtn:       { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  slotText:      { fontSize: 12, fontWeight: '600', color: '#334155' },
  slotBtnCustom: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#EDE9FE', borderWidth: 1, borderColor: '#7C3AED' },
  slotTextCustom:{ fontSize: 12, fontWeight: '700', color: '#7C3AED' },

  cdOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  cdSheet:   { backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 12 },
  cdHandle:  { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  cdStepRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  cdStepBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#E2E8F0' },
  cdStepBtnActive:  { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  cdStepText:       { fontSize: 13, fontWeight: '600', color: '#64748B' },
  cdStepTextActive: { color: Colors.primary, fontWeight: '700' },
  cdCalWrap:  { borderRadius: 14, backgroundColor: '#F8F9FB', padding: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  cdTimeLabel:{ fontSize: 14, fontWeight: '700', color: '#0F172A', textAlign: 'center', marginBottom: 14 },
  cdHourRow:  { paddingHorizontal: 2, gap: 8, paddingBottom: 16 },
  cdHourSlot: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  cdHourSlotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  cdHourText:       { fontSize: 12, fontWeight: '600', color: '#334155' },
  cdHourTextActive: { color: '#fff', fontWeight: '700' },
  cdConfirmBtn:  { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  cdConfirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  footer:   { flexDirection: 'row', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#fff', paddingBottom: Platform.OS === 'ios' ? 32 : 14 },
  skipBtn:  { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },

  waBtn:      { flex: 1.4, backgroundColor: '#25D366', borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  waBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  waIcon:     { fontSize: 14 },
  waBtnText:  { fontSize: 13, fontWeight: '700', color: '#fff' },

  saveBtn:     { flex: 1.6, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
