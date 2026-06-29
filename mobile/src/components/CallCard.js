import React, { useRef, useState, useEffect, memo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, PanResponder, Linking, Alert, Dimensions,
} from 'react-native';
import { formatDuration } from '../utils/formatDuration';
import { getNote } from '../utils/callNotes';

const { width: SW } = Dimensions.get('window');
const SWIPE_THRESH  = 72;

// ── Palette ────────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  '#2563EB','#16A34A','#D97706','#DC2626',
  '#7C3AED','#0891B2','#DB2777','#EA580C','#65A30D','#9333EA',
];

function hashColor(str) {
  if (!str) return AVATAR_PALETTE[0];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

const STATUS_CFG = {
  interested:     { label: 'Interested',     color: '#16A34A', bg: '#DCFCE7' },
  contacted:      { label: 'Contacted',      color: '#2563EB', bg: '#DBEAFE' },
  not_connected:  { label: 'Not Connected',  color: '#64748B', bg: '#F1F5F9' },
  not_interested: { label: 'Not Interested', color: '#DC2626', bg: '#FEE2E2' },
  follow_up:      { label: 'Follow Up',      color: '#7C3AED', bg: '#EDE9FE' },
  booking_done:   { label: 'Booking Done',   color: '#059669', bg: '#D1FAE5' },
  converted:      { label: 'Converted',      color: '#059669', bg: '#D1FAE5' },
  lost:           { label: 'Lost',           color: '#6B7280', bg: '#F3F4F6' },
};

// Call type visual config
const TYPE_CFG = {
  incoming: { fg: '#16A34A', bg: '#DCFCE7', darkFg: '#166534', label: 'Incoming', arrow: '↙' },
  outgoing: { fg: '#D97706', bg: '#FEF3C7', darkFg: '#92400E', label: 'Outgoing', arrow: '↗' },
  missed:   { fg: '#DC2626', bg: '#FEE2E2', darkFg: '#991B1B', label: 'Missed',   arrow: '↙' },
  rejected: { fg: '#7C3AED', bg: '#EDE9FE', darkFg: '#5B21B6', label: 'Rejected', arrow: '✕' },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDate(ts) {
  const d = new Date(ts), now = new Date();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString())  return null;
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function fmtFollowUp(date) {
  if (!date) return null;
  const d = new Date(date), diff = Math.round((d - Date.now()) / 86400000);
  if (diff < 0)  return { text: `Overdue · ${d.toLocaleDateString('en-IN', { day:'numeric', month:'short' })}`, warn: true };
  if (diff === 0) return { text: 'Today', warn: false };
  if (diff === 1) return { text: 'Tomorrow', warn: false };
  return { text: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), warn: false };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Avatar({ name, number, tc, selected }) {
  const display = name || number || '?';
  const letter  = display.replace(/\D/g,'')[0] || display[0] || '?';
  const color   = hashColor(display);
  return (
    <View style={av.wrap}>
      <View style={[av.circle, { backgroundColor: color + '15', borderColor: color + '30' }]}>
        <Text style={[av.letter, { color }]}>{letter.toUpperCase()}</Text>
      </View>
      {/* call-type dot */}
      <View style={[av.dot, { backgroundColor: tc.fg }]}>
        <Text style={av.dotTxt}>{tc.arrow}</Text>
      </View>
      {selected && (
        <View style={av.check}>
          <Text style={av.checkTxt}>✓</Text>
        </View>
      )}
    </View>
  );
}
const av = StyleSheet.create({
  wrap:     { width: 46, height: 46, position: 'relative', flexShrink: 0 },
  circle:   { width: 46, height: 46, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  letter:   { fontSize: 18, fontWeight: '800', lineHeight: 22 },
  dot:      { position: 'absolute', bottom: -3, right: -3, width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  dotTxt:   { fontSize: 7, fontWeight: '900', color: '#fff' },
  check:    { position: 'absolute', inset: 0, borderRadius: 14, backgroundColor: '#1A6BFF', justifyContent: 'center', alignItems: 'center' },
  checkTxt: { fontSize: 18, fontWeight: '900', color: '#fff' },
});

function ActionBtn({ icon, label, onPress, highlight }) {
  return (
    <TouchableOpacity style={[ab.btn, highlight && ab.btnHL]} onPress={onPress} activeOpacity={0.6}>
      <Text style={ab.icon}>{icon}</Text>
      <Text style={[ab.label, highlight && ab.labelHL]}>{label}</Text>
    </TouchableOpacity>
  );
}
const ab = StyleSheet.create({
  btn:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 2 },
  btnHL:   { backgroundColor: '#F0FDF4' },
  icon:    { fontSize: 15 },
  label:   { fontSize: 9.5, fontWeight: '600', color: '#64748B', letterSpacing: 0.1 },
  labelHL: { color: '#059669', fontWeight: '700' },
});

// ── CallCard ──────────────────────────────────────────────────────────────────

function CallCard({ call, onNote, onDelete, onFollowUp, onAddToLeads, selected, onLongPress, onSelect }) {
  const [noteData, setNoteData] = useState({ note: '', tags: [] });
  const scale  = useRef(new Animated.Value(1)).current;
  const slideX = useRef(new Animated.Value(0)).current;

  useEffect(() => { getNote(call).then(setNoteData); }, [call]);

  // ── Press animations ──
  const pressIn  = () => Animated.spring(scale, { toValue: 0.982, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1,     useNativeDriver: true, speed: 30, bounciness: 3 }).start();

  // ── Swipe ──
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder:  () => false,
    onMoveShouldSetPanResponder:   (_, { dx, dy }) => Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.4,
    onPanResponderMove:            (_, { dx }) => slideX.setValue(Math.max(-SW * 0.5, Math.min(SW * 0.5, dx))),
    onPanResponderRelease:         (_, { dx }) => {
      if (dx < -SWIPE_THRESH) {
        Animated.timing(slideX, { toValue: -SW, duration: 180, useNativeDriver: true }).start(() => {
          slideX.setValue(0);
          Alert.alert('Delete?', call.contactName || call.contactNumber, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => onDelete?.(call) },
          ]);
        });
      } else if (dx > SWIPE_THRESH) {
        Animated.timing(slideX, { toValue: SW, duration: 180, useNativeDriver: true }).start(() => {
          slideX.setValue(0);
          onFollowUp?.(call);
        });
      } else {
        Animated.spring(slideX, { toValue: 0, useNativeDriver: true, tension: 120, friction: 8 }).start();
      }
    },
  })).current;

  const delOpacity = slideX.interpolate({ inputRange: [-100, -20, 0], outputRange: [1, 0.15, 0], extrapolate: 'clamp' });
  const fuOpacity  = slideX.interpolate({ inputRange: [0, 20, 100],   outputRange: [0, 0.15, 1], extrapolate: 'clamp' });

  // ── Data ──
  const tc          = TYPE_CFG[call.callType]    || { fg: '#64748B', bg: '#F1F5F9', darkFg: '#334155', label: 'Unknown', arrow: '?' };
  const sc          = STATUS_CFG[call.callStatus] || null;
  const note        = call.notes || noteData.note || '';
  const followUp    = fmtFollowUp(noteData.followUp?.date);
  const dateLabel   = fmtDate(call.timestamp);
  const dur         = call.duration > 0 ? formatDuration(call.duration) : null;
  const isMissed    = call.callType === 'missed' || call.callType === 'rejected';
  const hasName     = call.contactName && call.contactName !== 'Unknown';
  const displayName = hasName ? call.contactName : call.contactNumber;

  const dial = () => Linking.openURL(`tel:${call.contactNumber}`).catch(() => {});
  const wa   = () => {
    const n = call.contactNumber.replace(/\D/g,'');
    Linking.openURL(`whatsapp://send?phone=${n.length === 10 ? '91' + n : n}`)
      .catch(() => Alert.alert('WhatsApp not installed'));
  };
  const handlePress = () => selected ? onSelect?.(call) : null;

  return (
    <View style={s.outer}>

      {/* ── Swipe hint backgrounds ── */}
      <Animated.View style={[s.swipeBg, s.swipeBgL, { opacity: delOpacity }]}>
        <Text style={s.swipeHintL}>Delete</Text>
        <Text style={s.swipeIconL}>🗑</Text>
      </Animated.View>
      <Animated.View style={[s.swipeBg, s.swipeBgR, { opacity: fuOpacity }]}>
        <Text style={s.swipeIconR}>📅</Text>
        <Text style={s.swipeHintR}>Follow-up</Text>
      </Animated.View>

      {/* ── Card ── */}
      <Animated.View
        style={[s.card, selected && s.cardSel, { transform: [{ translateX: slideX }, { scale }] }]}
        {...pan.panHandlers}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={pressIn}
          onPressOut={pressOut}
          onPress={handlePress}
          onLongPress={() => onLongPress?.(call)}
          delayLongPress={380}
        >
          {/* ── Body ── */}
          <View style={s.body}>

            {/* Left: Avatar */}
            <Avatar
              name={hasName ? call.contactName : null}
              number={call.contactNumber}
              tc={tc}
              selected={selected}
            />

            {/* Center: Info */}
            <View style={s.info}>

              {/* Name + Time */}
              <View style={s.topRow}>
                <Text
                  style={[s.name, isMissed && { color: tc.darkFg }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {displayName}
                </Text>
                <Text style={s.time}>{fmtTime(call.timestamp)}</Text>
              </View>

              {/* Phone + Duration pill */}
              <View style={s.midRow}>
                {hasName
                  ? <Text style={s.phone} numberOfLines={1}>{call.contactNumber}</Text>
                  : <View style={{ flex: 1 }} />
                }
                <View style={[s.durPill, { backgroundColor: tc.bg }]}>
                  <Text style={[s.durTxt, { color: tc.darkFg }]}>
                    {tc.arrow}{'  '}{dur ?? tc.label}
                  </Text>
                </View>
              </View>

              {/* Date (if not today) */}
              {!!dateLabel && (
                <Text style={s.dateLbl}>{dateLabel}</Text>
              )}

              {/* Status chip */}
              {sc && (
                <View style={[s.statusChip, { backgroundColor: sc.bg }]}>
                  <View style={[s.statusDot, { backgroundColor: sc.color }]} />
                  <Text style={[s.statusTxt, { color: sc.color }]}>{sc.label}</Text>
                </View>
              )}

              {/* Note preview */}
              {!!note && (
                <Text style={s.noteTxt} numberOfLines={1}>"{note}"</Text>
              )}

              {/* Follow-up */}
              {!!followUp && (
                <View style={[s.followRow, followUp.warn && s.followRowWarn]}>
                  <Text style={s.followIcon}>📅</Text>
                  <Text style={[s.followTxt, followUp.warn && s.followTxtWarn]}>
                    {followUp.warn ? 'Overdue · ' : ''}{followUp.text}
                  </Text>
                </View>
              )}

            </View>
          </View>

          {/* ── Action bar ── */}
          <View style={s.bar}>
            <ActionBtn icon="📞" label="Call"    onPress={dial} />
            <View style={s.sep} />
            <ActionBtn icon="💬" label="WA"      onPress={wa} />
            <View style={s.sep} />
            <ActionBtn icon="📝" label="Note"    onPress={() => onNote?.(call)} />
            <View style={s.sep} />
            <ActionBtn icon="📅" label="Follow"  onPress={() => onFollowUp?.(call)} />
            <View style={s.sep} />
            <ActionBtn icon="✚"  label="Lead"    onPress={() => onAddToLeads?.(call)} highlight />
          </View>

        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  outer: { marginBottom: 10, position: 'relative' },

  // Swipe reveal panels
  swipeBg:   { position: 'absolute', inset: 0, borderRadius: 18, alignItems: 'center', flexDirection: 'row', paddingHorizontal: 18 },
  swipeBgL:  { backgroundColor: '#FEE2E2', justifyContent: 'flex-end' },
  swipeBgR:  { backgroundColor: '#EDE9FE', justifyContent: 'flex-start' },
  swipeHintL:{ fontSize: 12, fontWeight: '700', color: '#DC2626', marginRight: 6 },
  swipeHintR:{ fontSize: 12, fontWeight: '700', color: '#7C3AED', marginLeft: 6 },
  swipeIconL:{ fontSize: 18 },
  swipeIconR:{ fontSize: 18 },

  // Card shell
  card: {
    backgroundColor: '#fff',
    borderRadius:    18,
    overflow:        'hidden',
    shadowColor:     '#0F172A',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.07,
    shadowRadius:    8,
    elevation:       3,
  },
  cardSel: { borderWidth: 2, borderColor: '#1A6BFF' },

  // Body section
  body:   { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12, gap: 12 },
  info:   { flex: 1, minWidth: 0 },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 },
  name:   { fontSize: 15, fontWeight: '700', color: '#0F172A', letterSpacing: -0.3, flex: 1 },
  time:   { fontSize: 11, fontWeight: '600', color: '#94A3B8', flexShrink: 0 },

  midRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 },
  phone:  { fontSize: 12, color: '#64748B', flex: 1 },

  durPill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, flexShrink: 0 },
  durTxt:  { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  dateLbl: { fontSize: 10.5, color: '#94A3B8', fontWeight: '500', marginTop: 2 },

  statusChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6, gap: 5 },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusTxt:  { fontSize: 11, fontWeight: '700' },

  noteTxt: { fontSize: 11.5, color: '#64748B', fontStyle: 'italic', marginTop: 5, lineHeight: 15 },

  followRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#F0FDF4', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  followRowWarn: { backgroundColor: '#FEF3C7' },
  followIcon:    { fontSize: 11 },
  followTxt:     { fontSize: 11, fontWeight: '600', color: '#16A34A' },
  followTxtWarn: { color: '#92400E' },

  // Action bar
  bar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FAFBFF' },
  sep: { width: 1, backgroundColor: '#F1F5F9', alignSelf: 'stretch' },
});

export default memo(CallCard);
