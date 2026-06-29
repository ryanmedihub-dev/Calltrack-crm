import React, { useRef, useState, useEffect, memo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, PanResponder, Linking, Alert, Dimensions,
} from 'react-native';
import { Colors, CALL_TYPE } from '../theme/colors';
import { Shadows } from '../theme/shadows';
import { formatDuration } from '../utils/formatDuration';
import { getNote } from '../utils/callNotes';

const SCREEN_W        = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 80;

const STATUS_MAP = {
  interested:     { label: 'Interested',     icon: '👍', color: '#16A34A', bg: '#DCFCE7' },
  contacted:      { label: 'Contacted',      icon: '📞', color: '#1A6BFF', bg: '#EBF2FF' },
  not_connected:  { label: 'Not Connected',  icon: '📵', color: '#94A3B8', bg: '#F1F5F9' },
  not_interested: { label: 'Not Interested', icon: '👎', color: '#DC2626', bg: '#FEE2E2' },
  follow_up:      { label: 'Follow Up',      icon: '📅', color: '#7C3AED', bg: '#EDE9FE' },
  booking_done:   { label: 'Booking Done',   icon: '✅', color: '#059669', bg: '#D1FAE5' },
  converted:      { label: 'Converted',      icon: '🎉', color: '#059669', bg: '#D1FAE5' },
  lost:           { label: 'Lost',           icon: '💀', color: '#64748B', bg: '#F3F4F6' },
};

const TYPE_ARROW = {
  incoming: '↙',
  outgoing: '↗',
  missed:   '↙',
  rejected: '✕',
};

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateShort(ts) {
  const d   = new Date(ts);
  const now = new Date();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString())  return null;
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatFollowUp(date) {
  if (!date) return null;
  const d    = new Date(date);
  const now  = new Date();
  const diff = Math.round((d - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `⚠ Overdue — ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
  if (diff === 0) return '📅 Today';
  if (diff === 1) return '📅 Tomorrow';
  return `📅 ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

const PALETTE = ['#2563EB','#16A34A','#D97706','#DC2626','#7C3AED','#0891B2','#DB2777','#65A30D'];

function avatarColor(str) {
  if (!str) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function Avatar({ name, number, size = 46, typeColor }) {
  const letter = name
    ? name.trim()[0].toUpperCase()
    : number ? (number.replace(/\D/g,'')[0] || '?') : '?';
  const bg = avatarColor(name || number);
  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <View style={[av.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg + '18', borderColor: bg + '40', borderWidth: 1.5 }]}>
        <Text style={[av.letter, { color: bg, fontSize: size * 0.38 }]}>{letter}</Text>
      </View>
      {/* Call-type micro badge */}
      <View style={[av.badge, { backgroundColor: typeColor }]}>
        <Text style={av.badgeTxt}>{letter ? '' : '?'}</Text>
      </View>
    </View>
  );
}
const av = StyleSheet.create({
  circle:   { justifyContent: 'center', alignItems: 'center' },
  letter:   { fontWeight: '800' },
  badge:    { position: 'absolute', bottom: -1, right: -1, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  badgeTxt: { display: 'none' },
});

// ── CallCard ──────────────────────────────────────────────────────────────────

function CallCard({ call, onNote, onDelete, onFollowUp, onAddToLeads, selected, onLongPress, onSelect }) {
  const [noteData, setNoteData] = useState({ note: '', tags: [] });
  const [expanded, setExpanded] = useState(false);
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => { getNote(call).then(setNoteData); }, [call]);

  const onPressIn  = () => Animated.spring(pressScale, { toValue: 0.98,  useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const onPressOut = () => Animated.spring(pressScale, { toValue: 1,     useNativeDriver: true, speed: 20, bounciness: 2 }).start();

  // ── Swipe ──
  const translateX = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder:  (_, { dx, dy }) => Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.5,
      onPanResponderMove:   (_, { dx }) => translateX.setValue(Math.max(-SCREEN_W * 0.45, Math.min(SCREEN_W * 0.45, dx))),
      onPanResponderRelease: (_, { dx }) => {
        if (dx < -SWIPE_THRESHOLD) {
          Animated.timing(translateX, { toValue: -SCREEN_W, duration: 200, useNativeDriver: true }).start(() => {
            translateX.setValue(0);
            Alert.alert('Delete call?', call.contactName || call.contactNumber, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => onDelete?.(call) },
            ]);
          });
        } else if (dx > SWIPE_THRESHOLD) {
          Animated.timing(translateX, { toValue: SCREEN_W, duration: 200, useNativeDriver: true }).start(() => {
            translateX.setValue(0);
            onFollowUp?.(call);
          });
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 100 }).start();
        }
      },
    })
  ).current;

  const swipeDeleteBg  = translateX.interpolate({ inputRange: [-120, -20, 0], outputRange: [1, 0.2, 0], extrapolate: 'clamp' });
  const swipeFollowBg  = translateX.interpolate({ inputRange: [0, 20, 120],   outputRange: [0, 0.2, 1], extrapolate: 'clamp' });

  const dialCall = () => Linking.openURL(`tel:${call.contactNumber}`).catch(() => {});
  const whatsapp = () => {
    const n = (call.contactNumber || '').replace(/\D/g, '');
    Linking.openURL(`whatsapp://send?phone=${n}`).catch(() => Alert.alert('WhatsApp not installed'));
  };

  const toggle = () => selected ? onSelect?.(call) : setExpanded((v) => !v);

  const typeConf    = CALL_TYPE[call.callType] || { fg: '#64748B', bg: '#F1F5F9', label: call.callType || 'Unknown', icon: '↕' };
  const typeArrow   = TYPE_ARROW[call.callType] || '↕';
  const statusConf  = STATUS_MAP[call.callStatus] || null;
  const displayNote = call.notes || noteData.note || '';
  const followLabel = formatFollowUp(noteData.followUp?.date);
  const dateLabel   = formatDateShort(call.timestamp);
  const dur         = call.duration > 0 ? formatDuration(call.duration) : null;
  const isMissed    = call.callType === 'missed' || call.callType === 'rejected';

  return (
    <View style={s.wrapper}>
      {/* Swipe backgrounds */}
      <Animated.View style={[s.swipeBg, s.swipeBgRight, { opacity: swipeFollowBg }]}>
        <Text style={s.swipeIcon}>📅</Text>
        <Text style={[s.swipeLabel, { color: '#7C3AED' }]}>Follow-up</Text>
      </Animated.View>
      <Animated.View style={[s.swipeBg, s.swipeBgLeft, { opacity: swipeDeleteBg }]}>
        <Text style={[s.swipeLabel, { color: '#DC2626' }]}>Delete</Text>
        <Text style={s.swipeIcon}>🗑</Text>
      </Animated.View>

      {/* Card */}
      <Animated.View
        style={[s.card, selected && s.cardSelected, { transform: [{ translateX }, { scale: pressScale }] }]}
        {...panResponder.panHandlers}
      >
        {/* Color bar */}
        <View style={[s.bar, { backgroundColor: typeConf.fg }]} />

        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={toggle}
          onLongPress={() => onLongPress?.(call)}
          delayLongPress={400}
        >
          {/* ── Main row ── */}
          <View style={s.row}>
            {/* Avatar */}
            <View style={{ position: 'relative' }}>
              <Avatar
                name={call.contactName !== 'Unknown' ? call.contactName : null}
                number={call.contactNumber}
                size={46}
                typeColor={typeConf.fg}
              />
              {selected && (
                <View style={s.selectMark}>
                  <Text style={s.selectMarkTxt}>✓</Text>
                </View>
              )}
            </View>

            {/* Content */}
            <View style={s.content}>
              {/* Name + number */}
              <View style={s.nameRow}>
                <Text style={[s.name, isMissed && { color: '#DC2626' }]} numberOfLines={1}>
                  {call.contactName && call.contactName !== 'Unknown' ? call.contactName : call.contactNumber}
                </Text>
              </View>
              {call.contactName && call.contactName !== 'Unknown' && (
                <Text style={s.number}>{call.contactNumber}</Text>
              )}

              {/* Type + duration pill */}
              <View style={s.metaRow}>
                <View style={[s.typePill, { backgroundColor: typeConf.bg }]}>
                  <Text style={[s.typePillTxt, { color: typeConf.fg }]}>
                    {typeArrow} {typeConf.label}{dur ? ` · ${dur}` : ''}
                  </Text>
                </View>
              </View>

              {/* Status chip */}
              {statusConf && (
                <View style={[s.statusChip, { backgroundColor: statusConf.bg }]}>
                  <Text style={[s.statusTxt, { color: statusConf.color }]}>
                    {statusConf.icon} {statusConf.label}
                  </Text>
                </View>
              )}

              {/* Note preview */}
              {!!displayNote && !statusConf && (
                <Text style={s.notePrev} numberOfLines={1}>💬 {displayNote}</Text>
              )}

              {/* Follow-up chip */}
              {!!followLabel && (
                <View style={[s.followChip, followLabel.startsWith('⚠') && { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
                  <Text style={[s.followTxt, followLabel.startsWith('⚠') && { color: '#B45309' }]}>{followLabel}</Text>
                </View>
              )}
            </View>

            {/* Right column */}
            <View style={s.rightCol}>
              <Text style={s.time}>{formatTime(call.timestamp)}</Text>
              {dateLabel && <Text style={s.dateLabel}>{dateLabel}</Text>}
              <Text style={s.expandHint}>{expanded ? '▲' : '▼'}</Text>
            </View>
          </View>

          {/* ── Expanded actions ── */}
          {expanded && (
            <View style={s.actionsWrap}>
              {/* Row 1 */}
              <View style={s.actionRow}>
                <TouchableOpacity style={[s.btn, s.btnBlue]} onPress={dialCall} activeOpacity={0.85}>
                  <Text style={s.btnIconPrimary}>📞</Text>
                  <Text style={s.btnLblPrimary}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, s.btnGreen]} onPress={whatsapp} activeOpacity={0.85}>
                  <Text style={s.btnIconPrimary}>💬</Text>
                  <Text style={s.btnLblPrimary}>WhatsApp</Text>
                </TouchableOpacity>
              </View>
              {/* Row 2 */}
              <View style={s.actionRow}>
                <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => onNote?.(call)} activeOpacity={0.85}>
                  <Text style={s.btnIcon}>📝</Text>
                  <Text style={s.btnLbl}>Add Note</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => onFollowUp?.(call)} activeOpacity={0.85}>
                  <Text style={s.btnIcon}>📅</Text>
                  <Text style={s.btnLbl}>Follow-up</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, s.btnEmerald]} onPress={() => onAddToLeads?.(call)} activeOpacity={0.85}>
                  <Text style={s.btnIconPrimary}>➕</Text>
                  <Text style={s.btnLblPrimary}>Lead</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { marginBottom: 9, position: 'relative' },

  swipeBg:      { position: 'absolute', inset: 0, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  swipeBgLeft:  { backgroundColor: '#FEE2E2', justifyContent: 'flex-end' },
  swipeBgRight: { backgroundColor: '#EDE9FE', justifyContent: 'flex-start' },
  swipeIcon:    { fontSize: 22 },
  swipeLabel:   { fontSize: 13, fontWeight: '700', marginHorizontal: 6 },

  card:         { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', flexDirection: 'row', ...Shadows.card },
  cardSelected: { borderWidth: 2, borderColor: Colors.primary },

  bar: { width: 4, alignSelf: 'stretch' },

  row:     { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12, paddingVertical: 13, gap: 11 },
  content: { flex: 1 },

  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name:    { fontSize: 14.5, fontWeight: '700', color: '#0F172A', letterSpacing: -0.2, flexShrink: 1 },
  number:  { fontSize: 11.5, color: '#94A3B8', marginTop: 1 },

  metaRow:  { flexDirection: 'row', marginTop: 5, flexWrap: 'wrap', gap: 5 },
  typePill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  typePillTxt: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.1 },

  statusChip: { alignSelf: 'flex-start', marginTop: 5, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  statusTxt:  { fontSize: 10.5, fontWeight: '700' },

  notePrev: { fontSize: 11, color: '#64748B', marginTop: 5, fontStyle: 'italic' },

  followChip: { alignSelf: 'flex-start', marginTop: 5, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' },
  followTxt:  { fontSize: 10.5, fontWeight: '600', color: '#16A34A' },

  rightCol:  { alignItems: 'flex-end', gap: 4, paddingTop: 1 },
  time:      { fontSize: 11.5, fontWeight: '600', color: '#475569' },
  dateLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '500' },
  expandHint:{ fontSize: 9, color: '#CBD5E1', marginTop: 2 },

  selectMark:    { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
  selectMarkTxt: { color: '#fff', fontSize: 10, fontWeight: '900' },

  // Expanded actions
  actionsWrap: { paddingHorizontal: 12, paddingBottom: 13, paddingTop: 2, gap: 7 },
  actionRow:   { flexDirection: 'row', gap: 7 },

  btn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 38, borderRadius: 10 },

  btnBlue:    { backgroundColor: Colors.primary },
  btnGreen:   { backgroundColor: '#25D366' },
  btnEmerald: { backgroundColor: '#059669' },
  btnGhost:   { backgroundColor: '#F8F9FB', borderWidth: 1.5, borderColor: '#E2E8F0' },

  btnIconPrimary: { fontSize: 13 },
  btnLblPrimary:  { fontSize: 12, fontWeight: '700', color: '#fff' },
  btnIcon:        { fontSize: 13 },
  btnLbl:         { fontSize: 12, fontWeight: '600', color: '#475569' },
});

export default memo(CallCard);
