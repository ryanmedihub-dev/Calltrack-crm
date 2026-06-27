import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, RefreshControl, Animated, Dimensions, FlatList, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/shadows';
import { formatDuration } from '../utils/formatDuration';

const { width: SW } = Dimensions.get('window');

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'Week'  },
  { key: 'month', label: 'Month' },
  { key: 'all',   label: 'All'   },
];

const TABS = ['Overview', 'Charts', 'Insights'];

// ─── Animated count-up number ───────────────────────────────────────────────
function AnimNumber({ target = 0, style, prefix = '', suffix = '', duration = 900 }) {
  const anim    = useRef(new Animated.Value(0)).current;
  const [disp, setDisp] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    anim.removeAllListeners();
    Animated.timing(anim, { toValue: target, duration, useNativeDriver: false }).start();
    anim.addListener(({ value }) => setDisp(Math.round(value)));
    prev.current = target;
    return () => anim.removeAllListeners();
  }, [target]);

  return <Text style={style}>{prefix}{disp}{suffix}</Text>;
}

// ─── Animated horizontal progress bar ───────────────────────────────────────
function ProgressBar({ percent = 0, color = Colors.primary, height = 6 }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: percent, duration: 1100, useNativeDriver: false }).start();
  }, [percent]);
  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: color + '20', overflow: 'hidden', flex: 1 }}>
      <Animated.View style={{ height, borderRadius: height / 2, backgroundColor: color, width }} />
    </View>
  );
}

// ─── Animated bar in a bar chart ─────────────────────────────────────────────
function AnimBar({ value, maxValue, color, maxH = 80, delay = 0, label, showValue }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.spring(anim, { toValue: 1, useNativeDriver: false, damping: 12, mass: 0.6 }).start();
    }, delay);
    return () => clearTimeout(t);
  }, [value]);
  const barH = anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(3, (value / Math.max(maxValue, 1)) * maxH)] });
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
      {showValue && value > 0 && (
        <Text style={{ fontSize: 9, fontWeight: '700', color, marginBottom: 3 }}>{value}</Text>
      )}
      <Animated.View style={{ width: '70%', height: barH, backgroundColor: color, borderRadius: 4, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />
      {label !== undefined && (
        <Text style={{ fontSize: 9, color: Colors.textMuted, marginTop: 4 }} numberOfLines={1}>{label}</Text>
      )}
    </View>
  );
}

// ─── Card entrance animation ─────────────────────────────────────────────────
function FadeCard({ children, delay = 0, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity,     { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(translateY,  { toValue: 0, damping: 18, mass: 0.7, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);
  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

// ─── Drill-down modal ────────────────────────────────────────────────────────
function DrillModal({ data, onClose }) {
  if (!data) return null;
  const TYPE_CONF = {
    incoming: { color: Colors.incoming, icon: '↙' },
    outgoing: { color: Colors.outgoing, icon: '↗' },
    missed:   { color: Colors.missed,   icon: '↙' },
    rejected: { color: Colors.rejected, icon: '✕' },
  };
  const fmtTs = (ts) => new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <Modal visible animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={dd.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={dd.sheet}>
          <View style={dd.handle} />
          <View style={dd.topRow}>
            <Text style={dd.title}>{data.label}</Text>
            <View style={dd.countBadge}><Text style={dd.countText}>{data.calls.length}</Text></View>
            <TouchableOpacity onPress={onClose} style={dd.closeBtn}><Text style={dd.closeX}>✕</Text></TouchableOpacity>
          </View>
          <FlatList
            data={data.calls}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const tc = TYPE_CONF[item.callType] || { color: Colors.textMuted, icon: '↕' };
              return (
                <View style={dd.row}>
                  <View style={[dd.dot, { backgroundColor: tc.color + '18' }]}>
                    <Text style={{ color: tc.color, fontSize: 15 }}>{tc.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={dd.name} numberOfLines={1}>{item.contactName || item.contactNumber}</Text>
                    <Text style={dd.phone}>{item.contactNumber}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={dd.time}>{fmtTs(item.timestamp)}</Text>
                    {item.duration > 0 && (
                      <Text style={[dd.dur, { color: tc.color }]}>
                        {Math.floor(item.duration / 60)}m {item.duration % 60}s
                      </Text>
                    )}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={{ textAlign: 'center', color: Colors.textMuted, marginTop: 32, fontSize: 14 }}>No calls found</Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const dd = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '82%' },
  handle:    { width: 38, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  topRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  title:     { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.text },
  countBadge:{ backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginRight: 10 },
  countText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  closeBtn:  { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  closeX:    { fontSize: 12, fontWeight: '700', color: Colors.textSec },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  dot:       { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  name:      { fontSize: 13, fontWeight: '600', color: Colors.text },
  phone:     { fontSize: 11, color: Colors.textSec, marginTop: 1 },
  time:      { fontSize: 11, color: Colors.textSec },
  dur:       { fontSize: 11, fontWeight: '700', marginTop: 2 },
});

// ─── Quick stat pill ──────────────────────────────────────────────────────────
function StatPill({ icon, label, value, color, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 12, useNativeDriver: true }),
    ]).start();
    onPress?.();
  };
  return (
    <TouchableOpacity onPress={press} activeOpacity={1}>
      <Animated.View style={[qp.pill, { borderColor: color + '30', transform: [{ scale }] }]}>
        <View style={[qp.iconBox, { backgroundColor: color + '15' }]}>
          <Text style={{ fontSize: 14 }}>{icon}</Text>
        </View>
        <View>
          <Text style={[qp.val, { color }]}>{value ?? '—'}</Text>
          <Text style={qp.lbl}>{label}</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}
const qp = StyleSheet.create({
  pill:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, padding: 12, minWidth: (SW - 56) / 2 - 4, ...Shadows.sm },
  iconBox:{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  val:    { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  lbl:    { fontSize: 10, color: Colors.textMuted, fontWeight: '600', marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.4 },
});

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function AnalyticsScreen() {
  const [stats,      setStats]      = useState(null);
  const [calls,      setCalls]      = useState([]);
  const [tab,        setTab]        = useState('Overview');
  const [period,     setPeriod]     = useState('month');
  const [refreshing, setRefreshing] = useState(false);
  const [userId,     setUserId]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [drillDown,  setDrillDown]  = useState(null);
  const tabLineX     = useRef(new Animated.Value(0)).current;
  const tabLineW     = useRef(new Animated.Value(0)).current;
  const tabRefs      = useRef([]);

  const getPeriodParams = (p) => {
    const now = new Date();
    let startDate;
    if (p === 'today') { startDate = new Date(now); startDate.setHours(0,0,0,0); }
    else if (p === 'week')  { startDate = new Date(now); startDate.setDate(now.getDate()-7); }
    else if (p === 'month') { startDate = new Date(now); startDate.setDate(1); startDate.setHours(0,0,0,0); }
    return startDate ? { startDate: startDate.toISOString(), endDate: now.toISOString() } : {};
  };

  const load = useCallback(async (uid, p) => {
    if (!uid) return;
    try {
      const [sr, cr] = await Promise.all([
        api.get('/api/calls/my-stats', { params: { period: p } }),
        api.get(`/api/calls/employee/${uid}`, { params: { page: 1, limit: 300, ...getPeriodParams(p) } }),
      ]);
      setStats(sr.data.data);
      setCalls(cr.data.data.calls || []);
    } catch {}
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('user').then((str) => {
      if (str) {
        const u = JSON.parse(str);
        setUserId(u._id);
        load(u._id, period).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => { if (userId) load(userId, period); }, [period, userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(userId, period);
    setRefreshing(false);
  };

  // ── Derived data ─────────────────────────────────────────────────────────
  const dayTrend = useMemo(() => {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dStr = d.toDateString();
      result.push({
        label: d.toLocaleDateString('en', { weekday: 'narrow' }),
        value: calls.filter((c) => new Date(c.timestamp).toDateString() === dStr).length,
        fullDate: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      });
    }
    return result;
  }, [calls]);

  const hourData = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ label: `${h}`, value: 0 }));
    calls.forEach((c) => { const h = new Date(c.timestamp).getHours(); buckets[h].value++; });
    return buckets;
  }, [calls]);

  const hourMax  = Math.max(...hourData.map((h) => h.value), 1);
  const dayMax   = Math.max(...dayTrend.map((d) => d.value), 1);
  const connRate = stats?.connectedRate || 0;
  const peakH    = hourData.reduce((m, h) => h.value > m.value ? h : m, { label: '-', value: 0 });

  const topContacts = useMemo(() => {
    const freq = {};
    calls.forEach((c) => {
      const k = c.contactNumber;
      if (!freq[k]) freq[k] = { number: k, name: c.contactName || k, count: 0, total: 0 };
      freq[k].count++;
      freq[k].total += c.duration || 0;
    });
    return Object.values(freq).sort((a, b) => b.count - a.count).slice(0, 7);
  }, [calls]);

  const drill = (label, fn) => setDrillDown({ label, calls: calls.filter(fn) });

  // ── Tab indicator ─────────────────────────────────────────────────────────
  const onTabLayout = (e, i) => {
    tabRefs.current[i] = { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width };
    if (TABS[i] === tab) {
      Animated.spring(tabLineX, { toValue: e.nativeEvent.layout.x, useNativeDriver: false, damping: 20 }).start();
      Animated.spring(tabLineW, { toValue: e.nativeEvent.layout.width, useNativeDriver: false, damping: 20 }).start();
    }
  };

  const switchTab = (t) => {
    setTab(t);
    const i = TABS.indexOf(t);
    const ref = tabRefs.current[i];
    if (ref) {
      Animated.spring(tabLineX, { toValue: ref.x, useNativeDriver: false, damping: 20 }).start();
      Animated.spring(tabLineW, { toValue: ref.w, useNativeDriver: false, damping: 20 }).start();
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View>
          <Text style={s.preLabel}>PERFORMANCE</Text>
          <Text style={s.heading}>Analytics</Text>
        </View>
        <View style={s.periodRow}>
          {PERIODS.map((p) => {
            const active = period === p.key;
            return (
              <TouchableOpacity key={p.key} style={[s.pBtn, active && s.pBtnActive]} onPress={() => setPeriod(p.key)}>
                <Text style={[s.pText, active && s.pTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Tab bar ────────────────────────────────────────────────────── */}
      <View style={s.tabBar}>
        {TABS.map((t, i) => (
          <TouchableOpacity
            key={t}
            onPress={() => switchTab(t)}
            onLayout={(e) => onTabLayout(e, i)}
            style={s.tabItem}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
        <Animated.View style={[s.tabLine, { left: tabLineX, width: tabLineW }]} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* ══════════════════ OVERVIEW TAB ══════════════════════════════ */}
        {tab === 'Overview' && (
          <>
            {/* Hero card */}
            <FadeCard delay={0} style={s.heroCard}>
              <View style={s.heroTop}>
                <View>
                  <Text style={s.heroLabel}>Total Calls</Text>
                  <AnimNumber target={stats?.total || 0} style={s.heroNumber} />
                </View>
                <View style={s.heroRight}>
                  <Text style={s.connLabel}>Connected</Text>
                  <AnimNumber target={connRate} style={s.connRate} suffix="%" />
                </View>
              </View>
              {/* Connection progress bar */}
              <View style={{ marginTop: 14, gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={s.barLabel}>Connection Rate</Text>
                  <Text style={[s.barLabel, { color: Colors.primary }]}>{connRate}% of calls answered</Text>
                </View>
                <ProgressBar percent={connRate} color={Colors.primary} height={7} />
              </View>
              {/* Type breakdown row */}
              <View style={s.typeRow}>
                {[
                  { icon: '↙', label: 'In',   val: stats?.incoming || 0, color: Colors.incoming },
                  { icon: '↗', label: 'Out',  val: stats?.outgoing || 0, color: Colors.outgoing },
                  { icon: '✕', label: 'Miss', val: stats?.missed   || 0, color: Colors.missed   },
                  { icon: '⊘', label: 'Rej',  val: stats?.rejected || 0, color: Colors.rejected },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={s.typeItem}
                    onPress={() => drill(item.label === 'In' ? 'Incoming' : item.label === 'Out' ? 'Outgoing' : item.label === 'Miss' ? 'Missed' : 'Rejected',
                      item.label === 'In' ? (c) => c.callType === 'incoming' : item.label === 'Out' ? (c) => c.callType === 'outgoing' : item.label === 'Miss' ? (c) => c.callType === 'missed' : (c) => c.callType === 'rejected')}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.typeIcon, { color: item.color }]}>{item.icon}</Text>
                    <AnimNumber target={item.val} style={[s.typeVal, { color: item.color }]} />
                    <Text style={s.typeLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FadeCard>

            {/* Quick stats grid */}
            <FadeCard delay={80}>
              <View style={s.pillGrid}>
                <StatPill
                  icon="⏱"
                  label="Talk Time"
                  value={stats?.totalDurationFmt || formatDuration(stats?.totalDuration || 0)}
                  color={Colors.primary}
                  onPress={() => drill('Connected Calls', (c) => c.duration > 0)}
                />
                <StatPill
                  icon="👤"
                  label="Unique"
                  value={stats?.uniqueContacts || 0}
                  color={Colors.purple}
                />
                <StatPill
                  icon="🔗"
                  label="Connected"
                  value={stats?.connectedCalls || 0}
                  color={Colors.success}
                  onPress={() => drill('Connected Calls', (c) => c.duration > 0)}
                />
                <StatPill
                  icon="⏩"
                  label="Avg Dur"
                  value={formatDuration(stats?.avgDuration || 0)}
                  color={Colors.warning}
                />
              </View>
            </FadeCard>

            {/* 7-day mini trend */}
            <FadeCard delay={160} style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.cardTitle}>7-Day Trend</Text>
                <TouchableOpacity onPress={() => switchTab('Charts')}>
                  <Text style={s.cardLink}>Full chart →</Text>
                </TouchableOpacity>
              </View>
              <View style={s.miniBar}>
                {dayTrend.map((d, i) => (
                  <AnimBar
                    key={i}
                    value={d.value}
                    maxValue={dayMax}
                    color={i === dayTrend.length - 1 ? Colors.primary : Colors.primary + '70'}
                    maxH={56}
                    delay={i * 50}
                    label={d.label}
                    showValue
                  />
                ))}
              </View>
            </FadeCard>

            {/* Hourly best performance card */}
            <FadeCard delay={240} style={[s.card, { flexDirection: 'row', gap: 16 }]}>
              <View style={[s.metricBox, { borderColor: Colors.primary + '20', backgroundColor: Colors.primaryLight }]}>
                <Text style={s.metricIcon}>⚡</Text>
                <Text style={[s.metricVal, { color: Colors.primary }]}>{peakH.label !== '-' ? `${peakH.label}:00` : '—'}</Text>
                <Text style={s.metricLbl}>Peak Hour</Text>
              </View>
              <View style={[s.metricBox, { borderColor: Colors.success + '25', backgroundColor: Colors.successBg }]}>
                <Text style={s.metricIcon}>📞</Text>
                <Text style={[s.metricVal, { color: Colors.success }]}>{peakH.value}</Text>
                <Text style={s.metricLbl}>Calls at Peak</Text>
              </View>
              <View style={[s.metricBox, { borderColor: Colors.warning + '25', backgroundColor: Colors.warningBg }]}>
                <Text style={s.metricIcon}>🎯</Text>
                <Text style={[s.metricVal, { color: Colors.warning }]}>{stats?.connectedCalls || 0}</Text>
                <Text style={s.metricLbl}>Connected</Text>
              </View>
            </FadeCard>
          </>
        )}

        {/* ══════════════════ CHARTS TAB ════════════════════════════════ */}
        {tab === 'Charts' && (
          <>
            {/* Type bar chart */}
            <FadeCard delay={0} style={s.card}>
              <Text style={s.cardTitle}>Calls by Type</Text>
              <Text style={s.cardSub}>Distribution across all call types</Text>
              <View style={s.chartArea}>
                {[
                  { label: 'Incoming', value: stats?.incoming || 0, color: Colors.incoming },
                  { label: 'Outgoing', value: stats?.outgoing || 0, color: Colors.outgoing },
                  { label: 'Missed',   value: stats?.missed   || 0, color: Colors.missed   },
                  { label: 'Rejected', value: stats?.rejected || 0, color: Colors.rejected },
                ].map((d, i) => {
                  const max = Math.max(stats?.incoming || 0, stats?.outgoing || 0, stats?.missed || 0, stats?.rejected || 0, 1);
                  return (
                    <View key={d.label} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: d.color, marginBottom: 4 }}>{d.value}</Text>
                      <AnimBar value={d.value} maxValue={max} color={d.color} maxH={90} delay={i * 80} showValue={false} />
                      <Text style={{ fontSize: 10, color: Colors.textMuted, marginTop: 5 }}>{d.label.substring(0,3)}</Text>
                    </View>
                  );
                })}
              </View>
            </FadeCard>

            {/* 7-day trend */}
            <FadeCard delay={80} style={s.card}>
              <Text style={s.cardTitle}>Last 7 Days</Text>
              <Text style={s.cardSub}>Daily call volume this week</Text>
              <View style={[s.chartArea, { height: 110 }]}>
                {dayTrend.map((d, i) => (
                  <AnimBar
                    key={i}
                    value={d.value}
                    maxValue={dayMax}
                    color={Colors.primary}
                    maxH={80}
                    delay={i * 60}
                    label={d.label}
                    showValue
                  />
                ))}
              </View>
            </FadeCard>

            {/* Hourly heatmap simplified */}
            <FadeCard delay={160} style={s.card}>
              <Text style={s.cardTitle}>Calls by Hour</Text>
              <Text style={s.cardSub}>24-hour activity pattern · peak at {peakH.label !== '-' ? `${peakH.label}:00` : 'N/A'}</Text>
              <View style={{ marginTop: 14 }}>
                {/* Show 8am–10pm in 2 rows */}
                {[
                  hourData.slice(8, 16),
                  hourData.slice(16, 22),
                ].map((row, ri) => (
                  <View key={ri} style={{ flexDirection: 'row', gap: 3, marginBottom: 4 }}>
                    {row.map((h, i) => {
                      const intensity = h.value / hourMax;
                      return (
                        <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                          <View style={{
                            height: 28, borderRadius: 5,
                            backgroundColor: intensity > 0 ? Colors.primary : Colors.bg,
                            opacity: Math.max(0.12, intensity),
                            width: '100%',
                          }} />
                          <Text style={{ fontSize: 8, color: Colors.textMuted, marginTop: 2 }}>{h.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
                <Text style={[s.cardSub, { marginTop: 8 }]}>Showing 8 AM – 10 PM</Text>
              </View>
            </FadeCard>
          </>
        )}

        {/* ══════════════════ INSIGHTS TAB ══════════════════════════════ */}
        {tab === 'Insights' && (
          <>
            {/* Top contacts */}
            <FadeCard delay={0} style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.cardTitle}>Top Contacts</Text>
                <Text style={s.cardSub}>{topContacts.length} most called</Text>
              </View>
              {topContacts.length === 0 ? (
                <Text style={{ textAlign: 'center', color: Colors.textMuted, paddingVertical: 24 }}>No data yet</Text>
              ) : (
                topContacts.map((tc, i) => (
                  <TouchableOpacity
                    key={tc.number}
                    style={s.rankRow}
                    onPress={() => drill(tc.name, (c) => c.contactNumber === tc.number)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.rankNum, i < 3 && { backgroundColor: ['#FFD700', '#C0C0C0', '#CD7F32'][i] + '22' }]}>
                      <Text style={[s.rankNumText, i < 3 && { color: ['#B8860B', '#808080', '#8B4513'][i] }]}>#{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rankName} numberOfLines={1}>{tc.name}</Text>
                      <Text style={s.rankPhone}>{tc.number}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.rankCount}>{tc.count} calls</Text>
                      {tc.total > 0 && (
                        <Text style={s.rankDur}>{formatDuration(tc.total)}</Text>
                      )}
                    </View>
                    <View style={[s.rankBar, { height: Math.max(4, (tc.count / (topContacts[0]?.count || 1)) * 32), backgroundColor: Colors.primary }]} />
                  </TouchableOpacity>
                ))
              )}
            </FadeCard>

            {/* Performance breakdown */}
            <FadeCard delay={80} style={s.card}>
              <Text style={s.cardTitle}>Performance Breakdown</Text>
              {[
                { label: 'Incoming calls',  value: stats?.incoming || 0,      total: stats?.total || 1, color: Colors.incoming },
                { label: 'Outgoing calls',  value: stats?.outgoing || 0,      total: stats?.total || 1, color: Colors.outgoing },
                { label: 'Missed calls',    value: stats?.missed   || 0,      total: stats?.total || 1, color: Colors.missed   },
                { label: 'Connected calls', value: stats?.connectedCalls || 0, total: stats?.total || 1, color: Colors.success  },
              ].map((item) => {
                const pct = Math.round((item.value / Math.max(item.total, 1)) * 100);
                return (
                  <View key={item.label} style={{ marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                      <Text style={s.perfLabel}>{item.label}</Text>
                      <Text style={[s.perfVal, { color: item.color }]}>{item.value} · {pct}%</Text>
                    </View>
                    <ProgressBar percent={pct} color={item.color} height={6} />
                  </View>
                );
              })}
            </FadeCard>
          </>
        )}
      </ScrollView>

      <DrillModal data={drillDown} onClose={() => setDrillDown(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#F4F7FF' },

  header:  { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.divider },
  preLabel:{ fontSize: 10, fontWeight: '800', color: Colors.primary, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 },
  heading: { fontSize: 26, fontWeight: '800', color: Colors.text, letterSpacing: -0.7, marginBottom: 14 },

  periodRow:   { flexDirection: 'row', backgroundColor: Colors.bg, borderRadius: 14, padding: 3, alignSelf: 'flex-start', gap: 2 },
  pBtn:        { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 11 },
  pBtnActive:  { backgroundColor: '#fff', ...Shadows.sm },
  pText:       { fontSize: 12, fontWeight: '600', color: Colors.textSec },
  pTextActive: { color: Colors.primary, fontWeight: '700' },

  tabBar:      { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.divider, paddingHorizontal: 20, position: 'relative' },
  tabItem:     { paddingVertical: 12, marginRight: 24 },
  tabText:     { fontSize: 13, fontWeight: '500', color: Colors.textSec },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },
  tabLine:     { position: 'absolute', bottom: 0, height: 3, backgroundColor: Colors.primary, borderRadius: 2 },

  scroll:  { padding: 16, paddingBottom: 50 },

  // Hero card
  heroCard:    { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 12, ...Shadows.card },
  heroTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  heroLabel:   { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 4 },
  heroNumber:  { fontSize: 52, fontWeight: '900', color: Colors.text, letterSpacing: -2, lineHeight: 58 },
  heroRight:   { alignItems: 'flex-end' },
  connLabel:   { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 4 },
  connRate:    { fontSize: 38, fontWeight: '900', color: Colors.primary, letterSpacing: -1 },
  barLabel:    { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  typeRow:     { flexDirection: 'row', marginTop: 16, borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 14 },
  typeItem:    { flex: 1, alignItems: 'center' },
  typeIcon:    { fontSize: 14, marginBottom: 3 },
  typeVal:     { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  typeLabel:   { fontSize: 10, color: Colors.textMuted, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },

  // Pill grid
  pillGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },

  // Generic card
  card:        { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 12, ...Shadows.card },
  cardHeader:  { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle:   { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardSub:     { fontSize: 11, color: Colors.textMuted, marginBottom: 14 },
  cardLink:    { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  chartArea:   { flexDirection: 'row', alignItems: 'flex-end', height: 100, marginTop: 12, gap: 4 },

  miniBar:     { flexDirection: 'row', alignItems: 'flex-end', height: 80, marginTop: 12, gap: 4 },

  // Metric boxes (3-up row)
  metricBox:   { flex: 1, borderRadius: 14, borderWidth: 1.5, padding: 12, alignItems: 'center' },
  metricIcon:  { fontSize: 18, marginBottom: 5 },
  metricVal:   { fontSize: 16, fontWeight: '800', letterSpacing: -0.5 },
  metricLbl:   { fontSize: 9, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2, textAlign: 'center' },

  // Rank list
  rankRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  rankNum:     { width: 28, height: 28, borderRadius: 9, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  rankNumText: { fontSize: 11, fontWeight: '800', color: Colors.textSec },
  rankName:    { fontSize: 13, fontWeight: '600', color: Colors.text },
  rankPhone:   { fontSize: 11, color: Colors.textSec, marginTop: 1 },
  rankCount:   { fontSize: 13, fontWeight: '700', color: Colors.primary },
  rankDur:     { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  rankBar:     { width: 4, borderRadius: 2, alignSelf: 'stretch', minHeight: 24 },

  // Performance
  perfLabel:   { fontSize: 12, fontWeight: '500', color: Colors.textSec },
  perfVal:     { fontSize: 12, fontWeight: '700' },
});
