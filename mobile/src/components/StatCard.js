import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { formatDuration } from '../utils/formatDuration';

export default function StatCard({ icon, label, value, duration, color = Colors.primary, half = false, onPress }) {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap style={[s.card, half && s.half]} onPress={onPress} activeOpacity={0.75}>
      <View style={[s.iconWrap, { backgroundColor: color + '18' }]}>
        <Text style={s.icon}>{icon}</Text>
      </View>
      <Text style={s.label}>{label}</Text>
      <Text style={[s.value, { color }]}>{value ?? '—'}</Text>
      {duration !== undefined && (
        <Text style={s.duration}>{formatDuration(duration)}</Text>
      )}
      {onPress && <Text style={s.tapHint}>Tap to view ›</Text>}
    </Wrap>
  );
}

const s = StyleSheet.create({
  card:     { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
  half:     { flex: 1, marginHorizontal: 4 },
  iconWrap: { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  icon:     { fontSize: 17 },
  label:    { fontSize: 11, fontWeight: '500', color: '#64748B', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 3 },
  value:    { fontSize: 26, fontWeight: '800' },
  duration: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  tapHint:  { fontSize: 10, color: '#CBD5E1', marginTop: 4 },
});
