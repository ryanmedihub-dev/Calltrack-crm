import React, { useRef, useEffect } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

function Skeleton({ width, height, radius = 6, style }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: '#E2E8F0', opacity },
        style,
      ]}
    />
  );
}

export function CallCardSkeleton() {
  return (
    <View style={s.card}>
      <View style={s.typeBar} />
      <View style={s.inner}>
        <Skeleton width={42} height={42} radius={21} />
        <View style={s.mid}>
          <Skeleton width={130} height={13} radius={4} />
          <Skeleton width={90}  height={10} radius={4} style={{ marginTop: 6 }} />
          <Skeleton width={60}  height={16} radius={8} style={{ marginTop: 6 }} />
        </View>
        <View style={s.right}>
          <Skeleton width={42} height={10} radius={4} />
          <Skeleton width={32} height={12} radius={4} style={{ marginTop: 6 }} />
        </View>
      </View>
    </View>
  );
}

export function StatCardSkeleton({ half = false }) {
  return (
    <View style={[s.statCard, half && s.statHalf]}>
      <Skeleton width={36} height={36} radius={10} />
      <Skeleton width={70} height={10} radius={4} style={{ marginTop: 10 }} />
      <Skeleton width={50} height={26} radius={5} style={{ marginTop: 6 }} />
    </View>
  );
}

const s = StyleSheet.create({
  card:    { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden', flexDirection: 'row', borderWidth: 1, borderColor: '#E2E8F0' },
  typeBar: { width: 4, backgroundColor: '#E2E8F0' },
  inner:   { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  mid:     { flex: 1 },
  right:   { alignItems: 'flex-end' },

  statCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
  statHalf: { flex: 1, marginHorizontal: 4 },
});
