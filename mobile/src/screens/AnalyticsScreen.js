import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, Modal, TouchableOpacity,
  StatusBar, RefreshControl, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';
import StatCard from '../components/StatCard';
import { Colors } from '../theme/colors';
import { formatDuration } from '../utils/formatDuration';

const TABS    = ['Summary', 'Analysis', 'Trends'];
const PERIODS = [
  { key: 'today', label: 'Today'      },
  { key: 'week',  label: 'This Week'  },
  { key: 'month', label: 'This Month' },
  { key: 'all',   label: 'All Time'   },
];

function getPeriodParams(period) {
  const now = new Date();
  let startDate;
  if (period === 'today') {
    startDate = new Date(now); startDate.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    startDate = new Date(now); startDate.setDate(now.getDate() - 7); startDate.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    startDate = new Date(now); startDate.setDate(1); startDate.setHours(0, 0, 0, 0);
  }
  return startDate
    ? { startDate: startDate.toISOString(), endDate: now.toISOString() }
    : {};
}

function getDayTrend(calls, days = 7) {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d     = new Date(); d.setDate(d.getDate() - i);
    const dStr  = d.toDateString();
    const count = calls.filter((c) => new Date(c.timestamp).toDateString() === dStr).length;
    result.push({ label: d.toLocaleDateString('en', { weekday: 'narrow' }), value: count });
  }
  return result;
}

// Minimal donut ring
function DonutRing({ percent, color = Colors.primary, size = 96 }) {
  const filled = Math.max(0, Math.min(100, percent || 0));
  const deg    = filled * 3.6;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: 10, borderColor: '#E2E8F0', position: 'absolute' }]} />
      {deg > 0 && (
        <View style={[{ width: size, height: size, borderRadius: size / 2, position: 'absolute', overflow: 'hidden' }]}>
          <View style={{ width: size / 2, height: size, backgroundColor: deg > 180 ? color : 'transparent', position: 'absolute', left: size / 2 }} />
          <View style={{ width: size, height: size / 2, backgroundColor: deg > 90 ? color : 'transparent', position: 'absolute', bottom: 0, transform: [{ rotate: `${Math.min(deg, 180) - 90}deg` }] }} />
        </View>
      )}
      <View style={{ width: size - 22, height: size - 22, borderRadius: (size - 22) / 2, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: size * 0.22, fontWeight: '800', color }}>{filled}%</Text>
        <Text style={{ fontSize: size * 0.12, color: '#94A3B8', marginTop: 2 }}>Rate</Text>
      </View>
    </View>
  );
}

function BarChart({ data, color = Colors.primary }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 80 }}>
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ width: '100%', height: Math.max(4, (d.value / max) * 68), backgroundColor: color, borderRadius: 4, opacity: 0.8 }} />
          <Text style={{ fontSize: 9, color: '#94A3B8', marginTop: 3 }}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

function DrillDownModal({ data, onClose }) {
  if (!data) return null;
  const formatTs = (ts) => new Date(ts).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });
  const typeConf = {
    incoming:  { color: '#16A34A', icon: '↙' },
    outgoing:  { color: '#D97706', icon: '↗' },
    missed:    { color: '#DC2626', icon: '↙' },
    rejected:  { color: '#DC2626', icon: '✕' },
  };
  return (
    <Modal visible={!!data} animationType="slide" transparent statusBarTranslucent>
      <View style={dd.overlay}>
        <View style={dd.sheet}>
          <View style={dd.topBar}>
            <Text style={dd.title}>{data.label}</Text>
            <Text style={dd.count}>{data.calls.length} calls</Text>
            <TouchableOpacity onPress={onClose} style={dd.closeBtn}>
              <Text style={dd.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={data.calls}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => {
              const tc = typeConf[item.callType] || { color: '#64748B', icon: '↕' };
              return (
                <View style={dd.row}>
                  <View style={[dd.iconDot, { backgroundColor: tc.color + '20' }]}>
                    <Text style={{ color: tc.color, fontSize: 14 }}>{tc.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={dd.name} numberOfLines={1}>{item.contactName || item.contactNumber}</Text>
                    <Text style={dd.num}>{item.contactNumber}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={dd.time}>{formatTs(item.timestamp)}</Text>
                    <Text style={[dd.dur, { color: tc.color }]}>{item.duration ? `${Math.floor(item.duration/60)}m ${item.duration%60}s` : '—'}</Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#94A3B8', marginTop: 40 }}>No calls</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}

const dd = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  topBar:  { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  title:   { fontSize: 16, fontWeight: '700', color: '#0F172A', flex: 1 },
  count:   { fontSize: 13, color: '#64748B', marginRight: 12 },
  closeBtn:{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  closeText:{ fontSize: 12, color: '#64748B', fontWeight: '700' },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8F9FB' },
  iconDot: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  name:    { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  num:     { fontSize: 11, color: '#64748B', marginTop: 1 },
  time:    { fontSize: 11, color: '#64748B' },
  dur:     { fontSize: 11, fontWeight: '700', marginTop: 2 },
});

export default function AnalyticsScreen() {
  const [stats,      setStats]      = useState(null);
  const [calls,      setCalls]      = useState([]);
  const [tab,        setTab]        = useState('Summary');
  const [period,     setPeriod]     = useState('month');
  const [refreshing, setRefreshing] = useState(false);
  const [userId,     setUserId]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [drillDown,  setDrillDown]  = useState(null); // { label, calls }

  const load = useCallback(async (uid, p) => {
    if (!uid) return;
    try {
      const [statsRes, callsRes] = await Promise.all([
        api.get('/api/calls/my-stats', { params: { period: p } }),
        api.get(`/api/calls/employee/${uid}`, {
          params: { page: 1, limit: 200, ...getPeriodParams(p) }
        })
      ]);
      setStats(statsRes.data.data);
      setCalls(callsRes.data.data.calls || []);
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

  // Re-fetch stats and calls whenever period changes
  useEffect(() => {
    if (userId) load(userId, period);
  }, [period, userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(userId, period);
    setRefreshing(false);
  };

  // callsPerHour from API (accurate for all calls, not just the 200 fetched)
  const hourData = (stats?.callsPerHour || Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 })))
    .map((h) => ({ label: `${h.hour}h`, value: h.count }));
  const peakHour = hourData.reduce((max, d) => d.value > max.value ? d : max, { label: '—', value: 0 });

  const dayData  = getDayTrend(calls);

  const typeData = [
    { label: 'In',   value: stats?.incoming || 0, color: Colors.success },
    { label: 'Out',  value: stats?.outgoing || 0, color: Colors.warning },
    { label: 'Miss', value: stats?.missed   || 0, color: Colors.danger  },
    { label: 'Rej',  value: stats?.rejected || 0, color: Colors.danger  },
  ];

  const handleStatPress = (label, filterFn) => {
    const filtered = calls.filter(filterFn);
    setDrillDown({ label, calls: filtered });
  };

  if (loading) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FB" />

      <View style={s.header}>
        <Text style={s.heading}>Analytics</Text>
      </View>

      {/* Period filter */}
      <View style={s.periodRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[s.periodBtn, period === p.key && s.periodBtnActive]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[s.periodText, period === p.key && s.periodTextActive]} numberOfLines={1}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sub tabs */}
      <View style={s.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t}</Text>
            {tab === t && <View style={s.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'Summary' && (
          <>
            {/* Connection rate hero */}
            <View style={s.heroCard}>
              <DonutRing percent={stats?.connectedRate || 0} size={100} />
              <View style={s.heroStats}>
                <Text style={s.heroLabel}>Connection Rate</Text>
                <Text style={s.heroSub}>{stats?.total || 0} total calls</Text>
                <Text style={[s.heroBig, { color: Colors.success }]}>{stats?.connectedCalls || 0} connected</Text>
                <Text style={[s.heroBig, { color: Colors.danger  }]}>{(stats?.missed || 0) + (stats?.rejected || 0)} unanswered</Text>
              </View>
            </View>

            {/* Stat grid — all figures come from the server aggregation */}
            <View style={s.grid}>
              {[
                { icon: '📊', label: 'Total Calls',     value: stats?.total,   color: Colors.primary, duration: stats?.totalDuration, filter: () => true },
                { icon: '↙',  label: 'Incoming',        value: stats?.incoming, color: Colors.success, filter: (c) => c.callType === 'incoming' },
                { icon: '↗',  label: 'Outgoing',        value: stats?.outgoing, color: Colors.warning, filter: (c) => c.callType === 'outgoing' },
                { icon: '✕',  label: 'Missed',          value: stats?.missed,   color: Colors.danger,  filter: (c) => c.callType === 'missed' },
                { icon: '⊘',  label: 'Rejected',        value: stats?.rejected, color: Colors.danger,  filter: (c) => c.callType === 'rejected' },
                { icon: '👤', label: 'Unique Contacts', value: stats?.uniqueContacts, color: Colors.purple, filter: (c, _, arr) => {
                    const seen = new Set(); return arr.filter((x) => { if (seen.has(x.contactNumber)) return false; seen.add(x.contactNumber); return true; }).includes(c);
                  }},
                { icon: '⏱',  label: 'Working Hours',  value: stats?.totalDurationFmt || formatDuration(stats?.totalDuration || 0), color: Colors.primary, filter: (c) => (c.duration || 0) > 0 },
                { icon: '🔗', label: 'Connected',       value: stats?.connectedCalls, color: Colors.success, filter: (c) => (c.duration || 0) > 0 },
              ].map(({ icon, label, value, color, duration, filter }) => (
                <View key={label} style={s.halfWrap}>
                  <StatCard
                    icon={icon} label={label} value={value} color={color} duration={duration} half
                    onPress={() => handleStatPress(label, filter)}
                  />
                </View>
              ))}
            </View>
          </>
        )}

        {tab === 'Analysis' && (
          <>
            <View style={s.chartCard}>
              <Text style={s.chartTitle}>Last 7 Days</Text>
              <BarChart data={dayData} color={Colors.primary} />
            </View>

            <View style={s.chartCard}>
              <Text style={s.chartTitle}>Calls by Type</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 }}>
                {typeData.map((d) => {
                  const max = Math.max(...typeData.map((x) => x.value), 1);
                  return (
                    <View key={d.label} style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: d.color, fontWeight: '700', marginBottom: 3 }}>{d.value}</Text>
                      <View style={{ width: '80%', height: Math.max(4, (d.value / max) * 60), backgroundColor: d.color, borderRadius: 4 }} />
                      <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>{d.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Hourly chart uses server-side aggregation — accurate across all calls */}
            <View style={s.chartCard}>
              <Text style={s.chartTitle}>Calls by Hour (24h)</Text>
              <BarChart data={hourData} color={Colors.primaryDark || '#0050CC'} />
              <Text style={s.chartSub}>Peak hour: {peakHour.label} ({peakHour.value} calls)</Text>
            </View>
          </>
        )}

        {tab === 'Trends' && (
          <>
            <View style={s.chartCard}>
              <Text style={s.chartTitle}>Last 7 Days Trend</Text>
              {(() => {
                const thisWeek = getDayTrend(calls, 7);
                const max7 = Math.max(...thisWeek.map((d) => d.value), 1);
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 80 }}>
                    {thisWeek.map((d, i) => (
                      <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                        <View style={{ width: '90%', height: Math.max(4, (d.value / max7) * 68), backgroundColor: Colors.primary, borderRadius: 3 }} />
                        <Text style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>{d.label}</Text>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </View>

            <View style={s.insightCard}>
              <Text style={s.insightTitle}>Top Contacts</Text>
              {(() => {
                const freq = {};
                calls.forEach((c) => { const k = c.contactName || c.contactNumber; freq[k] = (freq[k] || 0) + 1; });
                return Object.entries(freq)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([name, count], i) => (
                    <View key={name} style={s.insightRow}>
                      <Text style={s.insightRank}>#{i + 1}</Text>
                      <Text style={s.insightName} numberOfLines={1}>{name}</Text>
                      <View style={[s.insightBar, { width: Math.max(24, count * 10), backgroundColor: Colors.primary + '33' }]}>
                        <Text style={[s.insightCount, { color: Colors.primary }]}>{count}</Text>
                      </View>
                    </View>
                  ));
              })()}
            </View>
          </>
        )}
      </ScrollView>

      <DrillDownModal data={drillDown} onClose={() => setDrillDown(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#F8F9FB' },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  heading: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  periodRow:      { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 10, gap: 6 },
  periodBtn:      { flex: 1, paddingVertical: 5, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  periodBtnActive:{ backgroundColor: Colors.primary, borderColor: Colors.primary },
  periodText:     { fontSize: 11, fontWeight: '600', color: '#64748B' },
  periodTextActive: { color: '#fff' },

  tabRow:  { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', marginHorizontal: 20 },
  tabBtn:  { marginRight: 24, paddingBottom: 10, position: 'relative' },
  tabBtnActive: {},
  tabText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: Colors.primary, borderRadius: 1 },

  content: { padding: 16, paddingBottom: 40 },

  heroCard:  { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 16 },
  heroStats: { flex: 1 },
  heroLabel: { fontSize: 13, color: '#64748B', fontWeight: '600', marginBottom: 4 },
  heroSub:   { fontSize: 12, color: '#94A3B8', marginBottom: 8 },
  heroBig:   { fontSize: 14, fontWeight: '700', marginBottom: 2 },

  grid:      { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  halfWrap:  { width: '50%', paddingHorizontal: 4 },

  chartCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  chartTitle:{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 14 },
  chartSub:  { fontSize: 12, color: '#94A3B8', marginTop: 8 },

  insightCard:{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  insightTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  insightRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  insightRank:{ fontSize: 12, fontWeight: '700', color: '#94A3B8', width: 24 },
  insightName:{ flex: 1, fontSize: 13, color: '#0F172A', fontWeight: '500' },
  insightBar: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, minWidth: 28 },
  insightCount:{ fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
