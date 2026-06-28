import React, { useRef, useState, useEffect, memo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, PanResponder, Linking, Alert, Dimensions,
} from 'react-native';
import { Colors, CALL_TYPE } from '../theme/colors';
import { Shadows } from '../theme/shadows';
import { formatDuration } from '../utils/formatDuration';
import { getNote } from '../utils/callNotes';

const SCREEN_W       = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 80;

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

// ── Avatar initial circle ──────────────────────────────────────────────────────

const AVATAR_PALETTE = ['#2563EB','#16A34A','#D97706','#DC2626','#7C3AED','#0891B2','#DB2777','#65A30D'];

function getAvatarColor(name) {
  if (!name) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function Avatar({ name, number, size = 44, typeConf }) {
  const letter = name
    ? name.trim()[0].toUpperCase()
    : number ? number.replace(/\D/g,'')[0] || '?' : '?';
  const bg = getAvatarColor(name || number);

  return (
    <View style={{ position: 'relative', width: size, height: size }}>
      <View style={[av.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg + '22' }]}>
        <Text style={[av.letter, { color: bg, fontSize: size * 0.38 }]}>{letter}</Text>
      </View>
      {/* Type badge dot */}
      <View style={[av.dot, { backgroundColor: typeConf.fg }]}>
        <Text style={av.dotTxt}>{typeConf.icon}</Text>
      </View>
    </View>
  );
}
const av = StyleSheet.create({
  circle: { justifyContent: 'center', alignItems: 'center' },
  letter: { fontWeight: '800' },
  dot:    { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  dotTxt: { fontSize: 8, fontWeight: '900', color: '#fff' },
});

// ── Call Card ─────────────────────────────────────────────────────────────────

function CallCard({ call, onNote, onDelete, onFollowUp, selected, onLongPress, onSelect }) {
  const [noteData, setNoteData] = useState({ note: '', tags: [] });
  const [expanded, setExpanded] = useState(false);
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    getNote(call).then(setNoteData);
  }, [call]);

  const onPressIn  = () => Animated.spring(pressScale, { toValue: 0.985, useNativeDriver: true, speed: 30, bounciness: 0 }).start();
  const onPressOut = () => Animated.spring(pressScale, { toValue: 1,     useNativeDriver: true, speed: 20, bounciness: 2 }).start();

  // ── Swipe ──────────────────────────────────────────────────────────────────
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.5,
      onPanResponderMove: (_, { dx }) =>
        translateX.setValue(Math.max(-SCREEN_W * 0.45, Math.min(SCREEN_W * 0.45, dx))),
      onPanResponderRelease: (_, { dx }) => {
        if (dx < -SWIPE_THRESHOLD) {
          Animated.timing(translateX, { toValue: -SCREEN_W, duration: 200, useNativeDriver: true }).start(() => {
            translateX.setValue(0);
            Alert.alert('Delete call?', `${call.contactName || call.contactNumber}`, [
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

  const swipeDeleteOpacity = translateX.interpolate({ inputRange: [-120, -20, 0], outputRange: [1, 0.3, 0], extrapolate: 'clamp' });
  const swipeFollowOpacity = translateX.interpolate({ inputRange: [0, 20, 120],   outputRange: [0, 0.3, 1], extrapolate: 'clamp' });

  // ── Actions ────────────────────────────────────────────────────────────────
  const dialCall = () => Linking.openURL(`tel:${call.contactNumber}`).catch(() => {});
  const whatsapp = () => {
    const n = (call.contactNumber || '').replace(/\D/g, '');
    Linking.openURL(`whatsapp://send?phone=${n}`).catch(() => Alert.alert('WhatsApp not installed'));
  };
  const sms = () => Linking.openURL(`sms:${call.contactNumber}`).catch(() => {});

  const toggle = () => selected ? onSelect?.(call) : setExpanded(!expanded);

  const typeConf  = CALL_TYPE[call.callType] || { fg: '#64748B', bg: '#F1F5F9', label: call.callType || 'Unknown', icon: '↕' };
  const hasNote   = noteData.note || noteData.tags?.length > 0;
  const dateLabel = formatDateShort(call.timestamp);
  const duration  = formatDuration(call.duration);
  const isMissed  = call.callType === 'missed' || call.callType === 'rejected';

  return (
    <View style={s.wrapper}>
      {/* ── Swipe backgrounds ── */}
      <Animated.View style={[s.swipeBg, s.swipeBgRight, { opacity: swipeFollowOpacity }]}>
        <Text style={s.swipeIcon}>📅</Text>
        <Text style={[s.swipeLabel, { color: Colors.primary }]}>Follow-up</Text>
      </Animated.View>
      <Animated.View style={[s.swipeBg, s.swipeBgLeft, { opacity: swipeDeleteOpacity }]}>
        <Text style={[s.swipeLabel, { color: Colors.danger }]}>Delete</Text>
        <Text style={s.swipeIcon}>🗑</Text>
      </Animated.View>

      {/* ── Card ── */}
      <Animated.View
        style={[s.card, selected && s.cardSelected, { transform: [{ translateX }, { scale: pressScale }] }]}
        {...panResponder.panHandlers}
      >
        {/* Left type accent bar */}
        <View style={[s.bar, { backgroundColor: typeConf.fg }]} />

        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1}
          onPressIn={onPressIn} onPressOut={onPressOut}
          onPress={toggle} onLongPress={() => onLongPress?.(call)} delayLongPress={400}>

          {/* ── Main row ── */}
          <View style={s.cardInner}>
            {/* Avatar */}
            <View style={{ position: 'relative' }}>
              <Avatar
                name={call.contactName !== 'Unknown' ? call.contactName : null}
                number={call.contactNumber}
                size={44}
                typeConf={typeConf}
              />
              {selected && (
                <View style={s.selectedCheck}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>✓</Text>
                </View>
              )}
            </View>

            {/* Middle */}
            <View style={s.midCol}>
              <Text style={s.name} numberOfLines={1}>
                {call.contactName && call.contactName !== 'Unknown' ? call.contactName : call.contactNumber}
              </Text>
              {call.contactName && call.contactName !== 'Unknown' && (
                <Text style={s.number}>{call.contactNumber}</Text>
              )}
              {hasNote && (
                <Text style={s.notePrev} numberOfLines={1}>
                  {noteData.note || (noteData.tags?.[0] ? `• ${noteData.tags[0]}` : '')}
                </Text>
              )}
            </View>

            {/* Right */}
            <View style={s.rightCol}>
              <Text style={s.time}>{formatTime(call.timestamp)}</Text>
              {dateLabel && <Text style={s.dateLabel}>{dateLabel}</Text>}
              <View style={[s.durBadge, { backgroundColor: typeConf.bg }]}>
                <Text style={[s.durTxt, { color: typeConf.fg }]}>
                  {isMissed ? typeConf.label : (duration || typeConf.label)}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Expanded action row ── */}
          {expanded && (
            <View style={s.expandedRow}>
              <TouchableOpacity style={[s.actionBtn, s.actionBtnPrimary]} onPress={dialCall} activeOpacity={0.8}>
                <Text style={s.actionPrimaryTxt}>📞 Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, s.actionBtnGhost]} onPress={whatsapp} activeOpacity={0.8}>
                <Text style={s.actionGhostTxt}>💬 WA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, s.actionBtnGhost]} onPress={() => onNote?.(call)} activeOpacity={0.8}>
                <Text style={s.actionGhostTxt}>📝 Note</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, s.actionBtnGhost]} onPress={() => onFollowUp?.(call)} activeOpacity={0.8}>
                <Text style={s.actionGhostTxt}>📅 Follow</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { marginBottom: 8, position: 'relative' },

  swipeBg:      { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  swipeBgLeft:  { backgroundColor: '#FEE2E2', justifyContent: 'flex-end' },
  swipeBgRight: { backgroundColor: '#EBF2FF', justifyContent: 'flex-start' },
  swipeIcon:    { fontSize: 22 },
  swipeLabel:   { fontSize: 13, fontWeight: '700', marginHorizontal: 6 },

  card:         { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', flexDirection: 'row', ...Shadows.card },
  cardSelected: { borderWidth: 2, borderColor: Colors.primary },
  selectedCheck:{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },

  bar: { width: 4, alignSelf: 'stretch' },

  cardInner: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 11 },

  midCol:   { flex: 1 },
  rightCol: { alignItems: 'flex-end', gap: 3, minWidth: 72 },

  name:     { fontSize: 14, fontWeight: '700', color: Colors.text, letterSpacing: -0.1 },
  number:   { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  notePrev: { fontSize: 11, color: Colors.textMuted, marginTop: 3, fontStyle: 'italic' },

  time:      { fontSize: 11, fontWeight: '600', color: Colors.textSec },
  dateLabel: { fontSize: 10, color: Colors.textMuted },
  durBadge:  { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-end' },
  durTxt:    { fontSize: 10, fontWeight: '800' },

  expandedRow:       { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  actionBtn:         { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionBtnPrimary:  { backgroundColor: Colors.primary },
  actionBtnGhost:    { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  actionPrimaryTxt:  { color: '#fff', fontSize: 11, fontWeight: '700' },
  actionGhostTxt:    { color: Colors.textSec, fontSize: 11, fontWeight: '600' },
});

export default memo(CallCard);
