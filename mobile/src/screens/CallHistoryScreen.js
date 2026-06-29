import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, StatusBar, Modal, ScrollView,
  Animated, Platform, ActivityIndicator, Alert,
} from 'react-native';
import api from '../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CallCard from '../components/CallCard';
import MiniCalendar from '../components/MiniCalendar';
import { CallCardSkeleton } from '../components/SkeletonLoader';
import { Colors, CALL_TYPE } from '../theme/colors';
import { Shadows } from '../theme/shadows';
import { groupCallsByDate } from '../utils/groupCallsByDate';
import { syncCallLogs } from '../services/callLogService';

// ── Constants ──────────────────────────────────────────────────────────────────

const TYPE_FILTERS = [
  { key: 'all',      label: 'All',      icon: '↕',  fg: Colors.primary,        bg: Colors.primaryLight    },
  { key: 'incoming', label: 'Incoming', icon: '↙',  fg: CALL_TYPE.incoming.fg,  bg: CALL_TYPE.incoming.bg  },
  { key: 'outgoing', label: 'Outgoing', icon: '↗',  fg: CALL_TYPE.outgoing.fg,  bg: CALL_TYPE.outgoing.bg  },
  { key: 'missed',   label: 'Missed',   icon: '✕',  fg: CALL_TYPE.missed.fg,    bg: CALL_TYPE.missed.bg    },
  { key: 'rejected', label: 'Rejected', icon: '⊘',  fg: CALL_TYPE.rejected.fg,  bg: CALL_TYPE.rejected.bg  },
];

const DATE_PRESETS = [
  { key: 'today',  label: 'Today'     },
  { key: '2days',  label: '2 Days'    },
  { key: 'week',   label: 'Week'      },
  { key: 'month',  label: 'Month'     },
  { key: 'all',    label: 'All Time'  },
  { key: 'custom', label: '📅 Custom' },
];

const SORTS = [
  { key: 'newest',   label: 'Newest first'  },
  { key: 'oldest',   label: 'Oldest first'  },
  { key: 'longest',  label: 'Longest call'  },
  { key: 'shortest', label: 'Shortest call' },
];

function getDateBoundary(key) {
  const now = new Date();
  if (key === '2days') { const d = new Date(now); d.setDate(d.getDate() - 1); d.setHours(0,0,0,0); return d; }
  if (key === 'today') { const d = new Date(now); d.setHours(0,0,0,0); return d; }
  if (key === 'week')  { const d = new Date(now); d.setDate(d.getDate()-7); return d; }
  if (key === 'month') { const d = new Date(now); d.setDate(1); d.setHours(0,0,0,0); return d; }
  return null;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const fmtDate = (d) => d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Select';

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ title, count }) {
  return (
    <View style={sH.row}>
      <Text style={sH.title}>{title}</Text>
      <View style={sH.line} />
      <View style={sH.badge}><Text style={sH.badgeText}>{count}</Text></View>
    </View>
  );
}
const sH = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 8 },
  title:     { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 8 },
  line:      { flex: 1, height: 1, backgroundColor: Colors.border },
  badge:     { marginLeft: 8, backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
});

// ── Custom date sheet ─────────────────────────────────────────────────────────

function CustomDateSheet({ visible, from, to, onApply, onClose }) {
  const [seg, setSeg]     = useState('from');
  const [pFrom, setPFrom] = useState(from);
  const [pTo, setPTo]     = useState(to);
  const translateY = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible) { setSeg('from'); setPFrom(from); setPTo(to); }
    Animated.spring(translateY, { toValue: visible ? 0 : 500, useNativeDriver: true, damping: 20, mass: 0.8 }).start();
  }, [visible]);

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={cd.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[cd.sheet, { transform: [{ translateY }] }]}>
        <View style={cd.handle} />
        <Text style={cd.title}>Custom Date Range</Text>
        <View style={cd.segRow}>
          {['from', 'to'].map((s) => {
            const val = s === 'from' ? pFrom : pTo;
            return (
              <TouchableOpacity key={s} style={[cd.seg, seg === s && cd.segActive]} onPress={() => setSeg(s)}>
                <Text style={cd.segLabel}>{s.toUpperCase()}</Text>
                <Text style={[cd.segValue, val && { color: Colors.primary }]}>{fmtDate(val)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {(pFrom && pTo) && (
          <View style={cd.rangeSummary}>
            <Text style={cd.rangeSummaryText}>📅 {fmtDate(pFrom)} → {fmtDate(pTo)}</Text>
          </View>
        )}
        <View style={cd.calWrap}>
          <MiniCalendar
            value={seg === 'from' ? pFrom : pTo}
            onChange={(d) => {
              if (seg === 'from') { setPFrom(d); if (pTo && d > pTo) setPTo(null); setSeg('to'); }
              else { if (pFrom && d < pFrom) { setPFrom(d); setPTo(pFrom); } else setPTo(d); }
            }}
          />
        </View>
        <TouchableOpacity style={[cd.applyBtn, !pFrom && { opacity: 0.5 }]}
          onPress={() => { onApply(pFrom, pTo); onClose(); }} disabled={!pFrom}>
          <Text style={cd.applyText}>Apply Range</Text>
        </TouchableOpacity>
        <TouchableOpacity style={cd.clearBtn} onPress={() => { onApply(null, null); onClose(); }}>
          <Text style={cd.clearText}>Clear Date Filter</Text>
        </TouchableOpacity>
        <View style={{ height: 24 }} />
      </Animated.View>
    </Modal>
  );
}
const cd = StyleSheet.create({
  overlay:          { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.5)' },
  sheet:            { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12 },
  handle:           { width: 38, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  title:            { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  segRow:           { flexDirection: 'row', gap: 10, marginBottom: 12 },
  seg:              { flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, padding: 12, backgroundColor: Colors.bg },
  segActive:        { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  segLabel:         { fontSize: 9, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  segValue:         { fontSize: 15, fontWeight: '700', color: Colors.text },
  rangeSummary:     { backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12, alignSelf: 'center', borderWidth: 1, borderColor: Colors.primary },
  rangeSummaryText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  calWrap:          { borderRadius: 14, backgroundColor: Colors.bg, padding: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  applyBtn:         { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  applyText:        { fontSize: 15, fontWeight: '700', color: '#fff' },
  clearBtn:         { paddingVertical: 10, alignItems: 'center' },
  clearText:        { fontSize: 13, fontWeight: '600', color: Colors.textSec },
});

// ── Filter sheet (date + sort) ─────────────────────────────────────────────────

function FilterSheet({ visible, datePreset, sort, customFrom, customTo,
  onDateChange, onSortChange, onCustomDate, onClearAll, onClose }) {
  const translateY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    Animated.spring(translateY, { toValue: visible ? 0 : 600, useNativeDriver: true, damping: 20, mass: 0.8 }).start();
  }, [visible]);

  if (!visible) return null;

  const hasCustom    = datePreset === 'custom' && (customFrom || customTo);
  const activeCount  = (datePreset !== 'all' ? 1 : 0) + (sort !== 'newest' ? 1 : 0);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={fs.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[fs.sheet, { transform: [{ translateY }] }]}>
        <View style={fs.handle} />

        <View style={fs.hdr}>
          <Text style={fs.title}>Filters</Text>
          {activeCount > 0 && (
            <TouchableOpacity style={fs.clearAllBtn} onPress={onClearAll}>
              <Text style={fs.clearAllTxt}>Clear all ✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {/* Date Range */}
          <Text style={fs.sectionLabel}>DATE RANGE</Text>
          <View style={fs.chipGroup}>
            {DATE_PRESETS.map((dp) => {
              const active   = datePreset === dp.key;
              const isCustom = dp.key === 'custom';
              return (
                <TouchableOpacity key={dp.key} activeOpacity={0.8}
                  style={[fs.chip, active && (isCustom ? fs.chipCustom : fs.chipActive)]}
                  onPress={() => { onDateChange(dp.key); if (isCustom) onCustomDate(); }}>
                  <Text style={[fs.chipTxt, active && (isCustom ? fs.chipTxtCustom : fs.chipTxtActive)]}>
                    {dp.label}{isCustom && hasCustom ? `: ${fmtDate(customFrom)}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Sort */}
          <Text style={fs.sectionLabel}>SORT BY</Text>
          <View style={fs.sortGroup}>
            {SORTS.map((s) => {
              const active = sort === s.key;
              return (
                <TouchableOpacity key={s.key} activeOpacity={0.8}
                  style={fs.sortRow}
                  onPress={() => onSortChange(s.key)}>
                  <Text style={[fs.sortLabel, active && fs.sortLabelActive]}>{s.label}</Text>
                  {active && <Text style={fs.sortCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ height: 8 }} />
        </ScrollView>

        <TouchableOpacity style={fs.doneBtn} onPress={onClose}>
          <Text style={fs.doneTxt}>Done</Text>
        </TouchableOpacity>
        <View style={{ height: Platform.OS === 'ios' ? 24 : 12 }} />
      </Animated.View>
    </Modal>
  );
}
const fs = StyleSheet.create({
  overlay:       { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.5)' },
  sheet:         { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '80%', backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12 },
  handle:        { width: 38, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  hdr:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title:         { fontSize: 18, fontWeight: '800', color: Colors.text },
  clearAllBtn:   { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FEE2E2', borderRadius: 20 },
  clearAllTxt:   { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  sectionLabel:  { fontSize: 10, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },
  chipGroup:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
  chip:          { height: 34, justifyContent: 'center', borderRadius: 999, paddingHorizontal: 13, backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border },
  chipActive:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipCustom:    { backgroundColor: '#EDE9FE', borderColor: '#7C3AED' },
  chipTxt:       { fontSize: 12, fontWeight: '600', color: Colors.textSec },
  chipTxtActive: { color: '#fff', fontWeight: '700' },
  chipTxtCustom: { color: '#7C3AED', fontWeight: '700' },
  sortGroup:     { marginBottom: 16 },
  sortRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  sortLabel:     { fontSize: 14, fontWeight: '500', color: Colors.textSec },
  sortLabelActive: { color: Colors.primary, fontWeight: '700' },
  sortCheck:     { fontSize: 15, fontWeight: '700', color: Colors.primary },
  doneBtn:       { backgroundColor: Colors.primary, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  doneTxt:       { fontSize: 15, fontWeight: '700', color: '#fff' },
});

// ── Main screen ────────────────────────────────────────────────────────────────

export default function CallHistoryScreen({ onAddNote, onFollowUp }) {
  const handleAddToLeads = useCallback(async (call) => {
    const name = call.contactName && call.contactName !== 'Unknown' ? call.contactName : call.contactNumber;
    Alert.alert(
      'Add to Leads',
      `Add "${name}" (${call.contactNumber}) to your leads?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Lead',
          onPress: async () => {
            try {
              await api.post('/api/leads', {
                name,
                phone:  call.contactNumber,
                source: 'Call',
                status: 'new',
              });
              Alert.alert('✅ Added', `${name} added to your leads.`);
            } catch (err) {
              const msg = err?.response?.data?.error || 'Failed to add lead';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  }, []);
  const [calls,       setCalls]       = useState([]);
  const [filtered,    setFiltered]    = useState([]);
  const [typeFilter,  setTypeFilter]  = useState('all');
  const [sort,        setSort]        = useState('newest');
  const [search,      setSearch]      = useState('');
  const [showSearch,  setShowSearch]  = useState(false);
  const [userId,      setUserId]      = useState(null);
  const [userName,    setUserName]    = useState('');
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(true);
  const [loading,     setLoading]     = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [syncing,     setSyncing]     = useState(false);
  const [datePreset,  setDatePreset]  = useState('all');
  const [customFrom,  setCustomFrom]  = useState(null);
  const [customTo,    setCustomTo]    = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [showFilter,     setShowFilter]     = useState(false);
  const [showCustomDate, setShowCustomDate] = useState(false);

  const searchRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem('user').then((str) => {
      if (str) {
        const u = JSON.parse(str);
        setUserId(u._id);
        setUserName(u.name || '');
        setSyncing(true);
        syncCallLogs()
          .catch(() => {})
          .finally(() => {
            fetchCalls(1, u._id);
            setSyncing(false);
          });
      }
    });
    AsyncStorage.getItem('pendingCalls').then((s) => {
      try { if (s) setPendingCount(JSON.parse(s).length); } catch {}
    });
  }, []);

  const fetchCalls = async (p, uid) => {
    if (loading) return;
    setLoading(true);
    try {
      const res  = await api.get(`/api/calls/employee/${uid || userId}`, { params: { page: p, limit: 50 } });
      const data = res.data.data.calls || [];
      setCalls((prev) => (p === 1 ? data : [...prev, ...data]));
      setHasMore(p < res.data.data.pages);
      setPage(p);
    } catch {} finally { setLoading(false); }
  };

  // ── Filtering ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let result = typeFilter === 'all' ? [...calls] : calls.filter((c) => c.callType === typeFilter);

    if (datePreset === 'custom') {
      if (customFrom) result = result.filter((c) => new Date(c.timestamp) >= customFrom);
      if (customTo) {
        const end = new Date(customTo); end.setHours(23,59,59,999);
        result = result.filter((c) => new Date(c.timestamp) <= end);
      }
    } else {
      const b = getDateBoundary(datePreset);
      if (b) result = result.filter((c) => new Date(c.timestamp) >= b);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        (c.contactName || '').toLowerCase().includes(q) || (c.contactNumber || '').includes(q)
      );
    }

    result.sort((a, b) => {
      if (sort === 'oldest')   return new Date(a.timestamp) - new Date(b.timestamp);
      if (sort === 'longest')  return (b.duration || 0) - (a.duration || 0);
      if (sort === 'shortest') return (a.duration || 0) - (b.duration || 0);
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    setFiltered(result);
  }, [calls, typeFilter, search, sort, datePreset, customFrom, customTo]);

  // ── Count base (respects date+search, not type) ───────────────────────────
  const countsBase = useMemo(() => {
    let result = [...calls];
    if (datePreset === 'custom') {
      if (customFrom) result = result.filter((c) => new Date(c.timestamp) >= customFrom);
      if (customTo) {
        const end = new Date(customTo); end.setHours(23,59,59,999);
        result = result.filter((c) => new Date(c.timestamp) <= end);
      }
    } else {
      const b = getDateBoundary(datePreset);
      if (b) result = result.filter((c) => new Date(c.timestamp) >= b);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        (c.contactName || '').toLowerCase().includes(q) || (c.contactNumber || '').includes(q)
      );
    }
    return result;
  }, [calls, datePreset, customFrom, customTo, search]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); setSyncing(true);
    try { await syncCallLogs(); } catch {}
    if (userId) await fetchCalls(1, userId);
    AsyncStorage.getItem('pendingCalls').then((s) => {
      try { if (s) setPendingCount(JSON.parse(s).length); else setPendingCount(0); } catch {}
    });
    setSyncing(false); setRefreshing(false);
  }, [userId]);

  const groups = useMemo(() => groupCallsByDate(filtered), [filtered]);

  const renderGroup = useCallback(({ item: group }) => (
    <View>
      <SectionHeader title={group.title} count={group.data.length} />
      {group.data.map((call) => (
        <CallCard
          key={`${call.contactNumber}_${call.timestamp}`}
          call={call}
          onNote={onAddNote}
          onFollowUp={onFollowUp}
          onAddToLeads={handleAddToLeads}
        />
      ))}
    </View>
  ), [onAddNote, onFollowUp, handleAddToLeads]);

  const firstName      = userName.split(' ')[0] || 'there';
  const filterActive   = (datePreset !== 'all' ? 1 : 0) + (sort !== 'newest' ? 1 : 0);
  const hasActiveAny   = filterActive > 0 || typeFilter !== 'all' || search.trim();

  const clearAll = () => {
    setTypeFilter('all'); setDatePreset('all'); setSort('newest');
    setSearch(''); setCustomFrom(null); setCustomTo(null);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
      {showSearch ? (
        <View style={s.searchBar}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput ref={searchRef} style={s.searchInput}
            placeholder="Search name or number…" placeholderTextColor={Colors.textMuted}
            value={search} onChangeText={setSearch} autoFocus />
          <TouchableOpacity onPress={() => { setSearch(''); setShowSearch(false); }}>
            <Text style={s.searchClear}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{getGreeting()},</Text>
            <Text style={s.heading}>{firstName}</Text>
          </View>
          <View style={s.headerRight}>
            {syncing ? (
              <View style={s.syncPill}>
                <ActivityIndicator size="small" color={Colors.primary} style={{ transform: [{ scale: 0.7 }] }} />
                <Text style={s.syncTxt}>Syncing</Text>
              </View>
            ) : (
              <TouchableOpacity style={s.iconBtn} onPress={onRefresh} activeOpacity={0.8}>
                <Text style={s.iconText}>⟳</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.iconBtn} onPress={() => setShowSearch(true)} activeOpacity={0.8}>
              <Text style={s.iconText}>🔍</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.iconBtn, filterActive > 0 && s.iconBtnActive]}
              onPress={() => setShowFilter(true)} activeOpacity={0.8}>
              <Text style={[s.iconText, filterActive > 0 && { color: Colors.primary }]}>⊘</Text>
              {filterActive > 0 && (
                <View style={s.filterBadge}>
                  <Text style={s.filterBadgeTxt}>{filterActive}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Pending banner ── */}
      {pendingCount > 0 && !syncing && (
        <TouchableOpacity style={s.pendingBanner} onPress={onRefresh} activeOpacity={0.8}>
          <Text style={s.pendingText}>⏳ {pendingCount} call{pendingCount !== 1 ? 's' : ''} pending upload · Tap to sync</Text>
        </TouchableOpacity>
      )}

      {/* ── Type filter chips (always visible) ── */}
      <View style={s.chipWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {TYPE_FILTERS.map((f) => {
            const active = typeFilter === f.key;
            const count  = f.key === 'all' ? countsBase.length : countsBase.filter((c) => c.callType === f.key).length;
            return (
              <TouchableOpacity key={f.key} activeOpacity={0.7}
                style={[s.chip, active && { backgroundColor: f.bg, borderColor: f.fg, borderWidth: 1.5 }]}
                onPress={() => setTypeFilter(f.key)}>
                <Text style={[s.chipIcon, { color: active ? f.fg : Colors.textMuted }]}>{f.icon}</Text>
                <Text style={[s.chipText, active && { color: f.fg, fontWeight: '700' }]}>{f.label}</Text>
                <View style={[s.chipBadge, { backgroundColor: active ? f.fg + '22' : Colors.bg }]}>
                  <Text style={[s.chipBadgeText, { color: active ? f.fg : Colors.textMuted }]}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Summary bar ── */}
      {hasActiveAny && (
        <View style={s.summaryBar}>
          <Text style={s.summaryText}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            {datePreset !== 'all' ? ` · ${DATE_PRESETS.find(d => d.key === datePreset)?.label}` : ''}
            {sort !== 'newest' ? ` · ${SORTS.find(s2 => s2.key === sort)?.label}` : ''}
          </Text>
          <TouchableOpacity onPress={clearAll}>
            <Text style={s.clearText}>Clear all ✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── List ── */}
      {loading && calls.length === 0 ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }} pointerEvents="none">
          {[...Array(5)].map((_, i) => <CallCardSkeleton key={i} />)}
        </ScrollView>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.title}
          renderItem={renderGroup}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          onEndReached={() => hasMore && !loading && userId && fetchCalls(page + 1, userId)}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>📵</Text>
              <Text style={s.emptyTitle}>{search ? 'No results found' : 'No calls yet'}</Text>
              <Text style={s.emptyHint}>
                {search ? 'Try a different search term' : 'Pull down to sync your call logs'}
              </Text>
              {!search && (
                <TouchableOpacity style={s.syncBtn} onPress={onRefresh} activeOpacity={0.8}>
                  <Text style={s.syncBtnTxt}>⟳ Sync Now</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* ── FAB ── */}
      <TouchableOpacity style={s.fab}
        onPress={() => { try { require('react-native').Linking.openURL('tel:'); } catch {} }}>
        <Text style={s.fabText}>📞</Text>
      </TouchableOpacity>

      {/* ── Sheets ── */}
      <FilterSheet
        visible={showFilter}
        datePreset={datePreset}
        sort={sort}
        customFrom={customFrom}
        customTo={customTo}
        onDateChange={setDatePreset}
        onSortChange={setSort}
        onCustomDate={() => setShowCustomDate(true)}
        onClearAll={() => { setDatePreset('all'); setSort('newest'); setCustomFrom(null); setCustomTo(null); }}
        onClose={() => setShowFilter(false)}
      />
      <CustomDateSheet
        visible={showCustomDate}
        from={customFrom}
        to={customTo}
        onApply={(f, t) => { setCustomFrom(f); setCustomTo(t); }}
        onClose={() => setShowCustomDate(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header:      { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 18 : 16, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.divider },
  greeting:    { fontSize: 11, fontWeight: '500', color: Colors.textMuted, letterSpacing: 0.3 },
  heading:     { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingBottom: 2 },
  syncPill:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  syncTxt:     { fontSize: 11, fontWeight: '600', color: Colors.primary },
  iconBtn:     { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', ...Shadows.sm },
  iconBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  iconText:    { fontSize: 16 },
  filterBadge: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  filterBadgeTxt: { fontSize: 8, fontWeight: '800', color: '#fff' },

  pendingBanner: { marginHorizontal: 14, marginVertical: 8, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D' },
  pendingText:   { fontSize: 12, fontWeight: '600', color: '#92400E', textAlign: 'center' },

  chipWrap:      { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.divider },
  chipRow:       { paddingHorizontal: 14, paddingVertical: 9, gap: 7 },
  chip:          { flexDirection: 'row', alignItems: 'center', height: 34, gap: 4, borderRadius: 999, paddingHorizontal: 10, backgroundColor: '#fff', borderWidth: 1.5, borderColor: Colors.border },
  chipIcon:      { fontSize: 11, fontWeight: '700' },
  chipText:      { fontSize: 12, fontWeight: '500', color: Colors.textSec },
  chipBadge:     { borderRadius: 8, minWidth: 18, height: 17, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  chipBadgeText: { fontSize: 10, fontWeight: '700' },

  summaryBar:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 7, backgroundColor: Colors.primaryLight },
  summaryText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  clearText:   { fontSize: 11, color: Colors.primary, fontWeight: '700' },

  searchBar:   { margin: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 13, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 44, ...Shadows.sm },
  searchIcon:  { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  searchClear: { fontSize: 14, color: Colors.textMuted, padding: 4 },

  list:      { paddingHorizontal: 16, paddingBottom: 100 },
  empty:     { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon:  { fontSize: 52, marginBottom: 14 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textSec },
  emptyHint:  { fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 19 },
  syncBtn:    { marginTop: 20, paddingHorizontal: 28, height: 44, borderRadius: 24, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  syncBtnTxt: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  fab:     { position: 'absolute', bottom: 24, right: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: Colors.primary, shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  fabText: { fontSize: 22 },
});
