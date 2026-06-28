import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, RefreshControl, StatusBar, ActivityIndicator, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/shadows';

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE = {
  incoming: { fg: '#16A34A', bg: '#DCFCE7', icon: '↙' },
  outgoing: { fg: '#D97706', bg: '#FEF3C7', icon: '↗' },
  missed:   { fg: '#DC2626', bg: '#FEE2E2', icon: '↙' },
  rejected: { fg: '#7C3AED', bg: '#F3F0FF', icon: '✕' },
};

const FILTERS = [
  { key: 'all',      label: 'All'      },
  { key: 'incoming', label: 'Incoming' },
  { key: 'outgoing', label: 'Outgoing' },
  { key: 'missed',   label: 'Missed'   },
  { key: 'rejected', label: 'Rejected' },
];

const STATS = [
  { key: 'all',      label: 'Total',    color: '#1A6BFF', bg: '#EBF2FF' },
  { key: 'incoming', label: 'Incoming', color: '#16A34A', bg: '#DCFCE7' },
  { key: 'outgoing', label: 'Outgoing', color: '#D97706', bg: '#FEF3C7' },
  { key: 'missed',   label: 'Missed',   color: '#DC2626', bg: '#FEE2E2' },
  { key: 'rejected', label: 'Rejected', color: '#7C3AED', bg: '#F3F0FF' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDur(sec) {
  if (!sec) return null;
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(ts) {
  const d = new Date(ts), now = new Date();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString())  return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toSectionData(calls, group) {
  if (!group) return calls;
  const out = [];
  const map = new Map();
  calls.forEach(c => {
    const lbl = dayLabel(c.timestamp);
    if (!map.has(lbl)) { map.set(lbl, out.length); out.push({ _hdr: true, date: lbl, n: 0 }); }
    out[map.get(lbl)].n++;
    out.push(c);
  });
  return out;
}

// ── Call Card ─────────────────────────────────────────────────────────────────

const CallCard = React.memo(function CallCard({ item }) {
  const t   = TYPE[item.callType] || { fg: '#94A3B8', bg: '#F1F5F9', icon: '?' };
  const dur = fmtDur(item.duration);
  const hasName = item.contactName && item.contactName !== 'Unknown';

  return (
    <View style={card.wrap}>
      <View style={[card.bar, { backgroundColor: t.fg }]} />
      <View style={[card.ico, { backgroundColor: t.bg }]}>
        <Text style={[card.icoTxt, { color: t.fg }]}>{t.icon}</Text>
      </View>
      <View style={card.mid}>
        <Text style={card.name} numberOfLines={1}>
          {hasName ? item.contactName : item.contactNumber}
        </Text>
        {hasName && <Text style={card.num}>{item.contactNumber}</Text>}
      </View>
      <View style={card.end}>
        <Text style={card.time}>{fmtTime(item.timestamp)}</Text>
        <View style={[card.dur, { backgroundColor: t.bg }]}>
          <Text style={[card.durTxt, { color: t.fg }]}>
            {dur ?? (item.callType === 'missed' ? 'Missed' : item.callType === 'rejected' ? 'Rejected' : '—')}
          </Text>
        </View>
      </View>
    </View>
  );
});

// ── Date Banner ───────────────────────────────────────────────────────────────

function DateBanner({ date, n }) {
  return (
    <View style={ban.row}>
      <View style={ban.line} />
      <View style={ban.chip}>
        <Text style={ban.txt}>{date}</Text>
        <Text style={ban.cnt}> · {n}</Text>
      </View>
      <View style={ban.line} />
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function CallsScreen() {
  const [calls,      setCalls]      = useState([]);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);
  const [loading,    setLoading]    = useState(false);
  const [userId,     setUserId]     = useState(null);
  const [filter,     setFilter]     = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [ready,      setReady]      = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('user').then(str => {
      if (!str) return;
      const u = JSON.parse(str);
      setUserId(u._id);
      load(1, u._id);
    });
  }, []);

  async function load(p, uid) {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/calls/employee/${uid || userId}`, { params: { page: p, limit: 50 } });
      const rows = res.data.data.calls || [];
      setCalls(prev => p === 1 ? rows : [...prev, ...rows]);
      setHasMore(p < res.data.data.pages);
      setPage(p);
    } catch {}
    finally { setLoading(false); setReady(true); }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (userId) await load(1, userId);
    setRefreshing(false);
  }, [userId]);

  const counts = useMemo(() => ({
    all:      calls.length,
    incoming: calls.filter(c => c.callType === 'incoming').length,
    outgoing: calls.filter(c => c.callType === 'outgoing').length,
    missed:   calls.filter(c => c.callType === 'missed').length,
    rejected: calls.filter(c => c.callType === 'rejected').length,
  }), [calls]);

  const listData = useMemo(() => {
    const filtered = filter === 'all' ? calls : calls.filter(c => c.callType === filter);
    return toSectionData(filtered, filter === 'all');
  }, [calls, filter]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
      <View style={s.hdr}>
        <View>
          <Text style={s.title}>Call History</Text>
          <Text style={s.sub}>{counts.all} logs synced</Text>
        </View>
        {counts.missed > 0 && (
          <TouchableOpacity onPress={() => setFilter('missed')} style={s.missedPill} activeOpacity={0.8}>
            <Text style={s.missedTxt}>📵 {counts.missed} missed</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Stats strip ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.statsWrap} contentContainerStyle={s.statsRow}>
        {STATS.map(st => {
          const on = filter === st.key;
          return (
            <TouchableOpacity key={st.key} onPress={() => setFilter(st.key)} activeOpacity={0.8}
              style={[s.stat, { backgroundColor: on ? st.color : st.bg }]}>
              <Text style={[s.statN, { color: on ? '#fff' : st.color }]}>{counts[st.key]}</Text>
              <Text style={[s.statL, { color: on ? 'rgba(255,255,255,0.75)' : st.color }]}>{st.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Filter chips ── */}
      <View style={s.chipWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {FILTERS.map(f => {
            const on = filter === f.key;
            const t  = f.key !== 'all' ? TYPE[f.key] : null;
            return (
              <TouchableOpacity key={f.key} activeOpacity={0.8}
                style={[s.chip, on && (t ? { backgroundColor: t.bg, borderColor: t.fg } : s.chipOn)]}
                onPress={() => setFilter(f.key)}>
                <Text style={[s.chipTxt, on && (t ? { color: t.fg, fontWeight: '700' } : s.chipOnTxt)]}>
                  {f.label}
                </Text>
                <View style={[s.chipBadge, { backgroundColor: on && t ? t.fg + '28' : '#E2E8F0' }]}>
                  <Text style={[s.chipBadgeTxt, { color: on && t ? t.fg : '#64748B' }]}>{counts[f.key]}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── List ── */}
      {!ready ? (
        <View style={s.loadWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={s.loadTxt}>Loading calls…</Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, i) => item._hdr ? `h_${item.date}` : (item._id || String(i))}
          renderItem={({ item }) =>
            item._hdr
              ? <DateBanner date={item.date} n={item.n} />
              : <CallCard item={item} />
          }
          onEndReached={() => hasMore && !loading && userId && load(page + 1, userId)}
          onEndReachedThreshold={0.4}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIco}>📞</Text>
              <Text style={s.emptyTit}>No {filter === 'all' ? '' : filter + ' '}calls</Text>
              <Text style={s.emptyHnt}>Pull down to sync your call logs</Text>
            </View>
          }
          ListFooterComponent={
            hasMore && loading
              ? <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
              : null
          }
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const card = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, marginBottom: 8, overflow: 'hidden', ...Shadows.card },
  bar:     { width: 4, alignSelf: 'stretch' },
  ico:     { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginLeft: 12, marginRight: 11, marginVertical: 12, flexShrink: 0 },
  icoTxt:  { fontSize: 18, fontWeight: '800' },
  mid:     { flex: 1, paddingVertical: 12 },
  name:    { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  num:     { fontSize: 11, color: '#94A3B8' },
  end:     { alignItems: 'flex-end', paddingRight: 14, paddingVertical: 12, gap: 5 },
  time:    { fontSize: 11, color: '#94A3B8' },
  dur:     { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  durTxt:  { fontSize: 10, fontWeight: '700' },
});

const ban = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', marginVertical: 8, paddingHorizontal: 14 },
  line: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  chip: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10, backgroundColor: '#F8FAFC', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  txt:  { fontSize: 11, fontWeight: '700', color: '#64748B' },
  cnt:  { fontSize: 11, fontWeight: '500', color: '#94A3B8' },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F7FF' },

  hdr:       { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 18 : 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  title:     { fontSize: 22, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  sub:       { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  missedPill:{ backgroundColor: '#FEE2E2', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#FECACA' },
  missedTxt: { fontSize: 12, fontWeight: '700', color: '#DC2626' },

  statsWrap: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  statsRow:  { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  stat:      { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, minWidth: 70, alignItems: 'center' },
  statN:     { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  statL:     { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },

  chipWrap:   { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  chipRow:    { paddingHorizontal: 14, paddingVertical: 9, gap: 7 },
  chip:       { height: 34, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 12, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0' },
  chipOn:     { backgroundColor: '#EBF2FF', borderColor: '#1A6BFF' },
  chipTxt:    { fontSize: 12, fontWeight: '600', color: '#64748B' },
  chipOnTxt:  { color: '#1A6BFF', fontWeight: '700' },
  chipBadge:  { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  chipBadgeTxt: { fontSize: 10, fontWeight: '700' },

  list:    { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 40 },
  loadWrap:{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  loadTxt: { marginTop: 12, color: '#94A3B8', fontSize: 14 },
  empty:   { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIco:{ fontSize: 48, marginBottom: 14 },
  emptyTit:{ fontSize: 17, fontWeight: '700', color: '#475569' },
  emptyHnt:{ fontSize: 13, color: '#94A3B8', marginTop: 6, textAlign: 'center' },
});
