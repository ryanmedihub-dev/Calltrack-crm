import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, Modal, TouchableOpacity,
  StatusBar, RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';
import StatCard from '../components/StatCard';
import { StatCardSkeleton } from '../components/SkeletonLoader';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/shadows';
import { formatDuration } from '../utils/formatDuration';

const TABS    = ['Summary', 'Analysis', 'Trends'];
const PERIODS = [
  { key: 'today', label: 'Today'  },
  { key: 'week',  label: 'Week'   },
  { key: 'month', label: 'Month'  },
  { key: 'all',   label: 'All'    },
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
    const d    = new Date(); d.setDate(d.getDate() - i);
    const dStr = d.toDateString();
    result.push({ label: d.toLocaleDateString('en', { weekday: 'narrow' }), value: calls.filter((c) => new Date(c.timestamp).toDateString() === dStr).length });
  }
  return result;
}

function DonutRing({ percent, color = Colors.primary, size = 110 }) {
  const filled = Math.max(0, Math.min(100, percent || 0));
  const deg    = filled * 3.6;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 11, borderColor: Colors.bg, position: 'absolute' }} />
      {deg > 0 && (
        <View style={{ width: size, height: size, borderRadius: size / 2, position: 'absolute', overflow: 'hidden' }}>
          <View style={{ width: size / 2, height: size, backgroundColor: deg > 180 ? color : 'transparent', position: 'absolute', left: size / 2 }} />
          <View style={{ width: size, height: size / 2, backgroundColor: deg > 90 ? color : 'transparent', position: 'absolute', bottom: 0, transform: [{ rotate: `${Math.min(deg, 180) - 90}deg` }] }} />
        </View>
      )}
      <View style={{ width: size - 24, height: size - 24, borderRadius: (size - 24) / 2, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: size * 0.24, fontWeight: '800', color }}>{filled}%</Text>
        <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 1 }}>Rate</Text>
      </View>
    </View>
  );
}

function BarChart({ data, color = Colors.primary }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 90 }}>
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 9, color: d.value > 0 ? color : 'transparent', fontWeight: '700', marginBottom: 3 }}>{d.value || ''}</Text>
          <View style={{ width: '100%', height: Math.max(4, (d.value / max) * 64), backgroundColor: color, borderRadius: 5, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, opacity: 0.85 }} />
          <Text style={{ fontSize: 9, color: Colors.textMuted, marginTop: 3 }}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

function DrillDownModal({ data, onClose }) {
  if (!data) return null;
  const formatTs = (ts) => new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const typeConf = {
    incoming: { color: Colors.incoming, icon: '↙' },
    outgoing: { color: Colors.outgoing, icon: '↗' },
    missed:   { color: Colors.missed,   icon: '↙' },
    rejected: { color: Colors.rejected, icon: '✕' },
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
              const tc = typeConf[item.callType] || { color: Colors.textMuted, icon: '↕' };
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
                    <Text style={[dd.dur, { color: tc.color }]}>{item.duration ? `${Math.floor(item.duration / 60)}m ${item.duration % 60}s` : '—'}</Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={{ textAlign: 'center', color: Colors.textMuted, marginTop: 40 }}>No calls</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}

const dd = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheet:   { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '85%' },
  topBar:  { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  title:   { fontSize: 16, fontWeight: '700', color: Colors.text, flex: 1 },
  count:   { fontSize: 13, color: Colors.textSec, marginRight: 12 },
  closeBtn:{ width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  closeText:{ fontSize: 12, color: Colors.textSec, fontWeight: '700' },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  iconDot: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  name:    { fontSize: 13, fontWeight: '600', color: Colors.text },
  num:     { fontSize: 11, color: Colors.textSec, marginTop: 1 },
  time:    { fontSize: 11, color: Colors.textSec },
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
  const [drillDown,  setDrillDown]  = useState(null);

  const load = useCallback(async (uid, p) => {
    if (!uid) return;
    try {
      const [statsRes, callsRes] = await Promise.all([
        api.get('/api/calls/my-stats', { params: { period: p } }),
        api.get(`/api/calls/employee/${uid}`, { params: { page: 1, limit: 200, ...getPeriodParams(p) } }),
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

  useEffect(() => {
    if (userId) load(userId, period);
  }, [period, userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(userId, period);
    setRefreshing(false);
  };

  const hourData  = (stats?.callsPerHour || Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }))).map((h) => ({ label: `${h.hour}h`, value: h.count }));
  const peakHour  = hourData.reduce((max, d) => d.value > max.value ? d : max, { label: '—', value: 0 });
  const dayData   = getDayTrend(calls);
  const typeData  = [
    { label: 'In',   value: stats?.incoming || 0, color: Colors.incoming },
    { label: 'Out',  value: stats?.outgoing || 0, color: Colors.outgoing },
    { label: 'Miss', value: stats?.missed   || 0, color: Colors.missed   },
    { label: 'Rej',  value: stats?.rejected || 0, color: Colors.rejected },
  ];

  const handleStatPress = (label, filterFn) => {
    setDrillDown({ label, calls: calls.filter(filterFn) });
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header with period pills */}
      <View style={s.header}>
        <View>
          <Text style={s.preLabel}>PERFORMANCE</Text>
          <Text style={s.heading}>Analytics</Text>
        </View>
        <View style={s.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[s.periodBtn, period === p.key && s.periodBtnActive]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[s.periodText, period === p.key && s.periodTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
          loading ? (
            <View style={s.grid}>
              {[...Array(6)].map((_, i) => (
                <View key={i} style={s.halfWrap}><StatCardSkeleton half /></View>
              ))}
            </View>
          ) : (
            <>
              {/* Connection rate hero */}
              <View style={s.heroCard}>
                <DonutRing percent={stats?.connectedRate || 0} size={110} />
                <View style={s.heroStats}>
                  <Text style={s.heroLabel}>Connection Rate</Text>
                  <Text style={s.heroSub}>{stats?.total || 0} total calls</Text>
                  <Text style={[s.heroBig, { color: Colors.success }]}>{stats?.connectedCalls || 0} connected</Text>
                  <Text style={[s.heroBig, { color: Colors.danger  }]}>{(stats?.missed || 0) + (stats?.rejected || 0)} unanswered</Text>
                </View>
              </View>

              <View style={s.grid}>
                {[
                  { icon: '📊', label: 'Total Calls',     value: stats?.total,              color: Colors.primary, duration: stats?.totalDuration, filter: () => true },
                  { icon: '↙',  label: 'Incoming',        value: stats?.incoming,            color: Colors.success, filter: (c) => c.callType === 'incoming' },
                  { icon: '↗',  label: 'Outgoing',        value: stats?.outgoing,            color: Colors.warning, filter: (c) => c.callType === 'outgoing' },
                  { icon: '✕',  label: 'Missed',          value: stats?.missed,              color: Colors.danger,  filter: (c) => c.callType === 'missed' },
                  { icon: '⊘',  label: 'Rejected',        value: stats?.rejected,            color: Colors.rejected, filter: (c) => c.callType === 'rejected' },
                  { icon: '👤', label: 'Unique Contacts', value: stats?.uniqueContacts,      color: Colors.purple,  filter: (c, _, arr) => { const seen = new Set(); return arr.filter((x) => { if (seen.has(x.contactNumber)) return false; seen.add(x.contactNumber); return true; }).includes(c); } },
                  { icon: '⏱',  label: 'Working Hours',  value: stats?.totalDurationFmt || formatDuration(stats?.totalDuration || 0), color: Colors.primary, filter: (c) => (c.duration || 0) > 0 },
                  { icon: '🔗', label: 'Connected',       value: stats?.connectedCalls,      color: Colors.success, filter: (c) => (c.duration || 0) > 0 },
                ].map(({ icon, label, value, color, duration, filter }) => (
                  <View key={label} style={s.halfWrap}>
                    <StatCard icon={icon} label={label} value={value} color={color} duration={duration} half onPress={() => handleStatPress(label, filter)} />
                  </View>
                ))}
              </View>
            </>
          )
        )}

        {tab === 'Analysis' && (
          <>
            <View style={s.chartCard}>
              <Text style={s.chartTitle}>Last 7 Days</Text>
              <BarChart data={dayData} color={Colors.primary} />
            </View>

            <View style={s.chartCard}>
              <Text style={s.chartTitle}>Calls by Type</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 90 }}>
                {typeData.map((d) => {
                  const max = Math.max(...typeData.map((x) => x.value), 1);
                  return (
                    <View key={d.label} style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: d.color, fontWeight: '700', marginBottom: 3 }}>{d.value}</Text>
                      <View style={{ width: '80%', height: Math.max(4, (d.value / max) * 64), backgroundColor: d.color, borderRadius: 5, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />
                      <Text style={{ fontSize: 10, color: Colors.textMuted, marginTop: 3 }}>{d.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

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
              <BarChart data={getDayTrend(calls, 7)} color={Colors.primary} />
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
                      <View style={[s.insightBar, { width: Math.max(28, count * 12), backgroundColor: Colors.primaryLight }]}>
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
  root:    { flex: 1, backgroundColor: Colors.bg },

  header:  { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.divider },
  preLabel:{ fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  heading: { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.5, marginBottom: 14 },

  periodRow:       { flexDirection: 'row', gap: 6 },
  periodBtn:       { flex: 1, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border, alignItems: 'center', ...Shadows.sm },
  periodBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  periodText:      { fontSize: 12, fontWeight: '600', color: Colors.textSec },
  periodTextActive:{ color: '#fff', fontWeight: '700' },

  tabRow:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 20, backgroundColor: '#fff' },
  tabBtn:      { marginRight: 24, paddingBottom: 10, position: 'relative' },
  tabText:     { fontSize: 14, color: Colors.textSec, fontWeight: '500' },
  tabTextActive:{ color: Colors.primary, fontWeight: '700' },
  tabUnderline:{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2.5, backgroundColor: Colors.primary, borderRadius: 2 },

  content: { padding: 16, paddingBottom: 40 },

  heroCard:  { backgroundColor: '#fff', borderRadius: 18, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 16, ...Shadows.card },
  heroStats: { flex: 1 },
  heroLabel: { fontSize: 13, color: Colors.textSec, fontWeight: '600', marginBottom: 4 },
  heroSub:   { fontSize: 12, color: Colors.textMuted, marginBottom: 10 },
  heroBig:   { fontSize: 14, fontWeight: '700', marginBottom: 3 },

  grid:     { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  halfWrap: { width: '50%', paddingHorizontal: 4 },

  chartCard:  { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 12, ...Shadows.card },
  chartTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 14 },
  chartSub:   { fontSize: 12, color: Colors.textMuted, marginTop: 10 },

  insightCard:  { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 12, ...Shadows.card },
  insightTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  insightRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  insightRank:  { fontSize: 12, fontWeight: '700', color: Colors.textMuted, width: 24 },
  insightName:  { flex: 1, fontSize: 13, color: Colors.text, fontWeight: '500' },
  insightBar:   { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, minWidth: 28 },
  insightCount: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
