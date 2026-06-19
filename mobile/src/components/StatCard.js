import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/shadows';
import { formatDuration } from '../utils/formatDuration';

export default function StatCard({ icon, label, value, duration, color = Colors.primary, half = false, onPress }) {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap style={[s.card, half && s.half, { ...Shadows.card }]} onPress={onPress} activeOpacity={0.78}>
      <View style={[s.iconWrap, { backgroundColor: color + '18' }]}>
        <Text style={s.icon}>{icon}</Text>
      </View>
      <Text style={s.label} numberOfLines={1}>{label}</Text>
      <Text style={[s.value, { color }]} numberOfLines={1}>{value ?? '—'}</Text>
      {duration !== undefined && (
        <Text style={s.duration}>{formatDuration(duration)}</Text>
      )}
      {onPress && <Text style={s.tapHint}>View details ›</Text>}
    </Wrap>
  );
}

const s = StyleSheet.create({
  card:     {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    marginBottom: 10,
  },
  half:     { flex: 1, marginHorizontal: 4 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  icon:     { fontSize: 19 },
  label:    { fontSize: 11, fontWeight: '600', color: '#64748B', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  value:    { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  duration: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  tapHint:  { fontSize: 10, color: '#CBD5E1', marginTop: 6, fontWeight: '500' },
});
