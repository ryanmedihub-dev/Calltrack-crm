import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, StatusBar, Modal, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';
import CallCard from '../components/CallCard';
import MiniCalendar from '../components/MiniCalendar';
import { CallCardSkeleton } from '../components/SkeletonLoader';
import { Colors, CALL_TYPE } from '../theme/colors';
import { Shadows } from '../theme/shadows';
import { groupCallsByDate } from '../utils/groupCallsByDate';
import { syncCallLogs } from '../services/callLogService';

const FILTERS = [
  { key: 'all',      label: 'All',      icon: '↕', fg: Colors.primary,  bg: Colors.primaryLight },
  { key: 'incoming', label: 'Incoming', icon: '↙', fg: CALL_TYPE.incoming.fg, bg: CALL_TYPE.incoming.bg },
  { key: 'outgoing', label: 'Outgoing', icon: '↗', fg: CALL_TYPE.outgoing.fg, bg: CALL_TYPE.outgoing.bg },
  { key: 'missed',   label: 'Missed',   icon: '✕', fg: CALL_TYPE.missed.fg,   bg: CALL_TYPE.missed.bg   },
  { key: 'rejected', label: 'Rejected', icon: '⊘', fg: CALL_TYPE.rejected.fg, bg: CALL_TYPE.rejected.bg },
];

const SORTS = [
  { key: 'newest',   label: 'Newest first'  },
  { key: 'oldest',   label: 'Oldest first'  },
  { key: 'longest',  label: 'Longest call'  },
  { key: 'shortest', label: 'Shortest call' },
];

const DATE_FILTERS = [
  { key: 'all',    label: 'All Time'   },
  { key: 'today',  label: 'Today'      },
  { key: 'week',   label: 'This Week'  },
  { key: 'month',  label: 'This Month' },
  { key: 'custom', label: 'Custom'     },
];

function getDateBoundary(key) {
  const now = new Date();
  if (key === 'today') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
  if (key === 'week')  { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
  if (key === 'month') { const d = new Date(now); d.setDate(1); d.setHours(0, 0, 0, 0); return d; }
  return null;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const fmtDate = (d) => d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Select';

function SectionHeader({ title, count }) {
  return (
    <View style={sh.row}>
      <Text style={sh.title}>{title}</Text>
      <View style={sh.line} />
      <View style={sh.badge}>
        <Text style={sh.badgeText}>{count}</Text>
      </View>
    </View>
  );
}

const sh = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 8 },
  title: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 8 },
  line:  { flex: 1, height: 1, backgroundColor: Colors.border },
  badge: { marginLeft: 8, backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
});

export default function CallHistoryScreen({ onAddNote, onFollowUp }) {
  const [calls, setCalls]           = useState([]);
  const [filtered, setFiltered]     = useState([]);
  const [filter, setFilter]         = useState('all');
  const [sort, setSort]             = useState('newest');
  const [search, setSearch]         = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [userId, setUserId]         = useState(null);
  const [userName, setUserName]     = useState('');
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(true);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing]       = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState(null);
  const [customTo, setCustomTo]     = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Filter sheet state (date + sort only)
  const [showFilter, setShowFilter]   = useState(false);
  const [pendingDate, setPendingDate] = useState('all');
  const [pendingSort, setPendingSort] = useState('newest');
  const [pendingFrom, setPendingFrom] = useState(null);
  const [pendingTo, setPendingTo]     = useState(null);
  const [calTarget, setCalTarget]     = useState(null);

  // Custom date range bottom sheet (opens from inside filter sheet)
  const [showDateSheet, setShowDateSheet] = useState(false);
  const [calSegment, setCalSegment]       = useState('from');

  const searchRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem('user').then((str) => {
      if (str) {
        const u = JSON.parse(str);
        setUserId(u._id);
        setUserName(u.name || '');
        fetchCalls(1, u._id);
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

  useEffect(() => {
    let result = filter === 'all' ? [...calls] : calls.filter((c) => c.callType === filter);

    if (dateFilter === 'custom') {
      if (customFrom) result = result.filter((c) => new Date(c.timestamp) >= customFrom);
      if (customTo) {
        const end = new Date(customTo); end.setHours(23, 59, 59, 999);
        result = result.filter((c) => new Date(c.timestamp) <= end);
      }
    } else {
      const boundary = getDateBoundary(dateFilter);
      if (boundary) result = result.filter((c) => new Date(c.timestamp) >= boundary);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        (c.contactName || '').toLowerCase().includes(q) ||
        (c.contactNumber || '').includes(q)
      );
    }

    result.sort((a, b) => {
      switch (sort) {
        case 'oldest':   return new Date(a.timestamp) - new Date(b.timestamp);
        case 'longest':  return (b.duration || 0) - (a.duration || 0);
        case 'shortest': return (a.duration || 0) - (b.duration || 0);
        default:         return new Date(b.timestamp) - new Date(a.timestamp);
      }
    });
    setFiltered(result);
  }, [calls, filter, search, sort, dateFilter, customFrom, customTo]);

  const handleDeleteCall = useCallback(async (call) => {
    if (!call._id) { setCalls((prev) => prev.filter((c) => c !== call)); return; }
    try {
      await api.delete(`/api/calls/${call._id}`);
      setCalls((prev) => prev.filter((c) => c._id !== call._id));
    } catch {}
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setSyncing(true);
    try { await syncCallLogs(); } catch {}
    if (userId) await fetchCalls(1, userId);
    // Refresh pending count
    AsyncStorage.getItem('pendingCalls').then((s) => {
      try { if (s) setPendingCount(JSON.parse(s).length); else setPendingCount(0); } catch {}
    });
    setSyncing(false);
    setRefreshing(false);
  }, [userId]);

  const activeCount = [
    dateFilter !== 'all',
    sort !== 'newest',
  ].filter(Boolean).length;

  const pendingActiveCount = [
    pendingDate !== 'all',
    pendingSort !== 'newest',
  ].filter(Boolean).length;

  const openFilter = () => {
    setPendingDate(dateFilter);
    setPendingSort(sort);
    setPendingFrom(customFrom);
    setPendingTo(customTo);
    setCalTarget(null);
    setShowFilter(true);
  };

  const applyFilter = () => {
    setDateFilter(pendingDate);
    setSort(pendingSort);
    setCustomFrom(pendingFrom);
    setCustomTo(pendingTo);
    setShowFilter(false);
  };

  const resetFilter = () => {
    setPendingDate('all');
    setPendingSort('newest');
    setPendingFrom(null);
    setPendingTo(null);
    setCalTarget(null);
    setShowDateSheet(false);
  };

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
          onDelete={handleDeleteCall}
        />
      ))}
    </View>
  ), [onAddNote, onFollowUp, handleDeleteCall]);

  const firstName = userName.split(' ')[0] || 'there';

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />

      {/* Header */}
      {showSearch ? (
        <View style={s.searchBarWrap}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            ref={searchRef}
            style={s.searchInput}
            placeholder="Search name or number…"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
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
            {syncing
              ? <Text style={s.syncingText}>Syncing…</Text>
              : (
                <TouchableOpacity style={s.iconBtn} onPress={onRefresh}>
                  <Text style={s.iconText}>⟳</Text>
                </TouchableOpacity>
              )
            }
            <TouchableOpacity style={s.iconBtn} onPress={() => setShowSearch(true)}>
              <Text style={s.iconText}>🔍</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.filterBtn, activeCount > 0 && s.filterBtnActive]}
              onPress={openFilter}
            >
              <Text style={[s.filterBtnText, activeCount > 0 && s.filterBtnTextActive]}>
                ⊞{activeCount > 0 ? ` ${activeCount}` : ' Filter'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Pending sync banner */}
      {pendingCount > 0 && !syncing && (
        <TouchableOpacity style={s.pendingBanner} onPress={onRefresh} activeOpacity={0.8}>
          <Text style={s.pendingText}>⏳ {pendingCount} call{pendingCount !== 1 ? 's' : ''} pending upload · Tap to sync</Text>
        </TouchableOpacity>
      )}

      {/* Call type chips — always visible */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count  = f.key === 'all' ? calls.length : calls.filter((c) => c.callType === f.key).length;
          return (
            <TouchableOpacity
              key={f.key}
              style={[s.chip, active && { backgroundColor: f.bg, borderColor: f.fg }]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.7}
            >
              <View style={[s.chipDot, { backgroundColor: f.fg }]} />
              <Text style={[s.chipText, active && { color: f.fg, fontWeight: '700' }]}>
                {f.label}
              </Text>
              <View style={[s.chipBadge, { backgroundColor: active ? f.fg + '25' : Colors.border }]}>
                <Text style={[s.chipBadgeText, { color: active ? f.fg : Colors.textMuted }]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Loading skeleton */}
      {loading && calls.length === 0 ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }} pointerEvents="none">
          {[...Array(6)].map((_, i) => <CallCardSkeleton key={i} />)}
        </ScrollView>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.title}
          renderItem={renderGroup}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          onEndReached={() => hasMore && !loading && userId && fetchCalls(page + 1, userId)}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Text style={s.emptyIcon}>📵</Text>
              <Text style={s.emptyText}>{search ? 'No results found' : 'No calls yet'}</Text>
              <Text style={s.emptyHint}>Pull down to sync call logs</Text>
              {activeCount > 0 && (
                <TouchableOpacity
                  style={s.clearFilterBtn}
                  onPress={() => { setDateFilter('all'); setSort('newest'); setCustomFrom(null); setCustomTo(null); }}
                >
                  <Text style={s.clearFilterText}>Clear filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => { try { require('react-native').Linking.openURL('tel:'); } catch {} }}
      >
        <Text style={s.fabText}>📞</Text>
      </TouchableOpacity>

      {/* Date Range Sheet — opens on top of filter sheet when Custom is tapped */}
      <Modal visible={showDateSheet} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShowDateSheet(false)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowDateSheet(false)} />
          <View style={ds.sheet}>
            <View style={ds.handle} />
            <Text style={ds.title}>Select Date Range</Text>

            {/* From / To segment buttons */}
            <View style={ds.segRow}>
              <TouchableOpacity
                style={[ds.segBtn, calSegment === 'from' && ds.segBtnActive]}
                onPress={() => setCalSegment('from')}
              >
                <Text style={ds.segLabel}>FROM</Text>
                <Text style={[ds.segValue, pendingFrom && { color: Colors.primary }]}>{fmtDate(pendingFrom)}</Text>
              </TouchableOpacity>
              <Text style={ds.segArrow}>→</Text>
              <TouchableOpacity
                style={[ds.segBtn, calSegment === 'to' && ds.segBtnActive]}
                onPress={() => setCalSegment('to')}
              >
                <Text style={ds.segLabel}>TO</Text>
                <Text style={[ds.segValue, pendingTo && { color: Colors.primary }]}>{fmtDate(pendingTo)}</Text>
              </TouchableOpacity>
            </View>

            {/* Summary chip when both dates selected */}
            {pendingFrom && pendingTo && (
              <View style={ds.summaryChip}>
                <Text style={ds.summaryText}>📅 {fmtDate(pendingFrom)} → {fmtDate(pendingTo)}</Text>
              </View>
            )}

            {/* Always-visible calendar */}
            <View style={ds.calWrap}>
              <MiniCalendar
                value={calSegment === 'from' ? pendingFrom : pendingTo}
                onChange={(d) => {
                  if (calSegment === 'from') {
                    setPendingFrom(d);
                    if (pendingTo && d > pendingTo) setPendingTo(null);
                    setCalSegment('to');
                  } else {
                    setPendingTo(d);
                    if (pendingFrom && d < pendingFrom) setPendingFrom(null);
                  }
                }}
                minDate={calSegment === 'to' && pendingFrom ? pendingFrom : undefined}
                maxDate={calSegment === 'from' && pendingTo ? pendingTo : undefined}
              />
            </View>

            <TouchableOpacity
              style={[ds.applyBtn, !pendingFrom && { opacity: 0.5 }]}
              onPress={() => setShowDateSheet(false)}
              disabled={!pendingFrom}
            >
              <Text style={ds.applyText}>Apply Range</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={ds.clearBtn}
              onPress={() => {
                setPendingFrom(null);
                setPendingTo(null);
                setPendingDate('all');
                setShowDateSheet(false);
              }}
            >
              <Text style={ds.clearText}>Clear Date Filter</Text>
            </TouchableOpacity>
            <View style={{ height: 24 }} />
          </View>
        </View>
      </Modal>

      {/* Filter Sheet */}
      <Modal visible={showFilter} transparent animationType="slide" statusBarTranslucent>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowFilter(false)} />
          <View style={fs.sheet}>
            <View style={fs.handle} />
            <View style={fs.topRow}>
              <Text style={fs.title}>Filter & Sort</Text>
              <TouchableOpacity onPress={resetFilter} style={fs.resetBtn}>
                <Text style={fs.resetText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={fs.sectionLabel}>DATE RANGE</Text>
              <View style={fs.chipGroup}>
                {DATE_FILTERS.map((df) => (
                  <TouchableOpacity
                    key={df.key}
                    style={[fs.chip, pendingDate === df.key && (df.key === 'custom' ? fs.chipCustom : fs.chipActive)]}
                    onPress={() => {
                      setPendingDate(df.key);
                      if (df.key === 'custom') {
                        setCalSegment('from');
                        setShowDateSheet(true);
                      } else {
                        setPendingFrom(null);
                        setPendingTo(null);
                      }
                    }}
                  >
                    <Text style={[fs.chipText, pendingDate === df.key && (df.key === 'custom' ? fs.chipCustomText : fs.chipTextActive)]}>
                      {df.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {pendingDate === 'custom' && (pendingFrom || pendingTo) && (
                <TouchableOpacity
                  style={fs.rangeSummary}
                  onPress={() => { setCalSegment('from'); setShowDateSheet(true); }}
                >
                  <Text style={fs.rangeSummaryText}>
                    📅 {fmtDate(pendingFrom)} → {fmtDate(pendingTo)}
                  </Text>
                  <Text style={fs.rangeSummaryEdit}>Edit</Text>
                </TouchableOpacity>
              )}

              <Text style={fs.sectionLabel}>SORT BY</Text>
              <View style={fs.chipGroup}>
                {SORTS.map((so) => (
                  <TouchableOpacity
                    key={so.key}
                    style={[fs.chip, pendingSort === so.key && fs.chipActive]}
                    onPress={() => setPendingSort(so.key)}
                  >
                    <Text style={[fs.chipText, pendingSort === so.key && fs.chipTextActive]}>{so.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ height: 8 }} />
            </ScrollView>

            <View style={fs.footer}>
              <TouchableOpacity style={fs.applyBtn} onPress={applyFilter}>
                <Text style={fs.applyText}>
                  Apply{pendingActiveCount > 0 ? ` (${pendingActiveCount} active)` : ' Filters'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14,
  },
  greeting: { fontSize: 12, fontWeight: '500', color: Colors.textMuted, letterSpacing: 0.3 },
  heading:  { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },

  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 2 },
  syncingText:  { fontSize: 11, color: Colors.primary, fontWeight: '600' },

  iconBtn:  { width: 36, height: 36, borderRadius: 11, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', ...Shadows.sm },
  iconText: { fontSize: 15 },

  filterBtn:          { flexDirection: 'row', alignItems: 'center', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border, ...Shadows.sm },
  filterBtnActive:    { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  filterBtnText:      { fontSize: 12, fontWeight: '600', color: Colors.textSec },
  filterBtnTextActive:{ color: Colors.primary },

  pendingBanner: { marginHorizontal: 16, marginBottom: 8, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D' },
  pendingText:   { fontSize: 12, fontWeight: '600', color: '#92400E', textAlign: 'center' },

  // Chip row
  chipRow:       { paddingHorizontal: 16, paddingBottom: 10, gap: 7, flexDirection: 'row' },
  chip:          { flexDirection: 'row', alignItems: 'center', height: 34, gap: 5, borderRadius: 999, paddingHorizontal: 11, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border },
  chipDot:       { width: 7, height: 7, borderRadius: 4 },
  chipText:      { fontSize: 12, fontWeight: '500', color: Colors.textSec },
  chipBadge:     { borderRadius: 8, minWidth: 18, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  chipBadgeText: { fontSize: 10, fontWeight: '700' },

  searchBarWrap: { margin: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 13, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 44, ...Shadows.sm },
  searchIcon:    { fontSize: 14, marginRight: 8 },
  searchInput:   { flex: 1, fontSize: 14, color: Colors.text },
  searchClear:   { fontSize: 14, color: Colors.textMuted, padding: 4 },

  list:    { paddingHorizontal: 16, paddingBottom: 100 },

  emptyWrap:      { alignItems: 'center', paddingTop: 60 },
  emptyIcon:      { fontSize: 44, marginBottom: 12 },
  emptyText:      { fontSize: 16, fontWeight: '700', color: Colors.textSec },
  emptyHint:      { fontSize: 13, color: Colors.textMuted, marginTop: 5 },
  clearFilterBtn: { marginTop: 18, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: Colors.primaryLight },
  clearFilterText:{ fontSize: 13, fontWeight: '700', color: Colors.primary },

  fab:     { position: 'absolute', bottom: 24, right: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: Colors.primary, shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  fabText: { fontSize: 22 },
});

const fs = StyleSheet.create({
  sheet:       { backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 12, paddingHorizontal: 20, maxHeight: '88%' },
  handle:      { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  topRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title:       { fontSize: 17, fontWeight: '700', color: Colors.text },
  resetBtn:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.bg },
  resetText:   { fontSize: 12, fontWeight: '600', color: Colors.textSec },

  sectionLabel:{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  chipGroup:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip:        { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  chipActive:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:    { fontSize: 13, fontWeight: '600', color: Colors.textSec },
  chipTextActive: { color: '#fff' },

  customDateWrap: { marginBottom: 18 },
  dateRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  dateBtn:     { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, padding: 10, backgroundColor: Colors.bg },
  dateBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  dateBtnLabel:{ fontSize: 10, fontWeight: '700', color: Colors.textMuted, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateBtnValue:{ fontSize: 14, fontWeight: '700', color: Colors.text },
  dateSep:     { color: Colors.textMuted, fontSize: 16 },
  calWrap:     { borderRadius: 14, backgroundColor: Colors.bg, padding: 12, borderWidth: 1, borderColor: Colors.border },

  chipCustom:     { backgroundColor: '#EDE9FE', borderColor: '#7C3AED' },
  chipCustomText: { color: '#7C3AED', fontWeight: '700' },

  rangeSummary:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 16, borderWidth: 1, borderColor: Colors.primary },
  rangeSummaryText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  rangeSummaryEdit: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  footer:   { paddingTop: 12, paddingBottom: 28, borderTopWidth: 1, borderTopColor: Colors.divider },
  applyBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  applyText:{ fontSize: 15, fontWeight: '700', color: '#fff' },
});

const ds = StyleSheet.create({
  sheet:   { backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 12 },
  handle:  { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  title:   { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 16 },

  segRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  segBtn:      { flex: 1, borderRadius: 13, borderWidth: 1.5, borderColor: Colors.border, padding: 11, backgroundColor: Colors.bg },
  segBtnActive:{ borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  segLabel:    { fontSize: 9, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  segValue:    { fontSize: 15, fontWeight: '700', color: Colors.text },
  segArrow:    { color: Colors.textMuted, fontSize: 18 },

  summaryChip: { backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12, alignSelf: 'center', borderWidth: 1, borderColor: Colors.primary },
  summaryText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  calWrap:  { borderRadius: 14, backgroundColor: Colors.bg, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },

  applyBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  applyText:{ fontSize: 15, fontWeight: '700', color: '#fff' },
  clearBtn: { paddingVertical: 11, alignItems: 'center' },
  clearText:{ fontSize: 13, fontWeight: '600', color: Colors.textSec },
});
