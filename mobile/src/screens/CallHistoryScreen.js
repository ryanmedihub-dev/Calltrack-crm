import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, StatusBar, Modal, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';
import CallCard from '../components/CallCard';
import MiniCalendar from '../components/MiniCalendar';
import { Colors } from '../theme/colors';
import { groupCallsByDate } from '../utils/groupCallsByDate';
import { syncCallLogs } from '../services/callLogService';

const FILTERS = [
  { key: 'all',      label: 'All',      icon: '↕' },
  { key: 'incoming', label: 'Incoming', icon: '↙' },
  { key: 'outgoing', label: 'Outgoing', icon: '↗' },
  { key: 'missed',   label: 'Missed',   icon: '✕' },
  { key: 'rejected', label: 'Rejected', icon: '⊘' },
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

const fmtDate = (d) => d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Select';

export default function CallHistoryScreen({ onAddNote, onFollowUp }) {
  const [calls, setCalls]           = useState([]);
  const [filtered, setFiltered]     = useState([]);
  const [filter, setFilter]         = useState('all');
  const [sort, setSort]             = useState('newest');
  const [search, setSearch]         = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [userId, setUserId]         = useState(null);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(true);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing]       = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState(null);
  const [customTo, setCustomTo]     = useState(null);

  // Filter sheet state (date + sort only — call type has its own chips)
  const [showFilter, setShowFilter] = useState(false);
  const [pendingDate, setPendingDate] = useState('all');
  const [pendingSort, setPendingSort] = useState('newest');
  const [pendingFrom, setPendingFrom] = useState(null);
  const [pendingTo, setPendingTo]     = useState(null);
  const [calTarget, setCalTarget]     = useState(null); // 'from' | 'to' | null

  const searchRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem('user').then((str) => {
      if (str) { const u = JSON.parse(str); setUserId(u._id); fetchCalls(1, u._id); }
    });
  }, []);

  const fetchCalls = async (p, uid) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/calls/employee/${uid || userId}`, { params: { page: p, limit: 50 } });
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

  const handleDeleteCall = async (call) => {
    if (!call._id) { setCalls((prev) => prev.filter((c) => c !== call)); return; }
    try {
      await api.delete(`/api/calls/${call._id}`);
      setCalls((prev) => prev.filter((c) => c._id !== call._id));
    } catch {}
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setSyncing(true);
    try { await syncCallLogs(); } catch {}
    if (userId) await fetchCalls(1, userId);
    setSyncing(false);
    setRefreshing(false);
  }, [userId]);

  // Active filter count — only date + sort (call type has its own chip row)
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
  };

  const groups = groupCallsByDate(filtered);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FB" />

      <View style={s.header}>
        {showSearch ? (
          <View style={s.searchBarWrap}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              ref={searchRef}
              style={s.searchInput}
              placeholder="Search name or number…"
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setSearch(''); setShowSearch(false); }}>
              <Text style={s.searchClear}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={s.heading}>Call History</Text>
            <View style={s.headerRight}>
              {syncing && <Text style={s.syncDot}>⟳</Text>}
              <TouchableOpacity onPress={() => setShowSearch(true)} style={s.iconBtn}>
                <Text style={s.iconText}>🔍</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={openFilter}
                style={[s.filterBtn, activeCount > 0 && s.filterBtnActive]}
              >
                <Text style={[s.filterBtnText, activeCount > 0 && s.filterBtnTextActive]}>
                  ⊞{activeCount > 0 ? ` ${activeCount}` : ' Filter'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Call type chips — always visible */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count  = f.key === 'all' ? calls.length : calls.filter((c) => c.callType === f.key).length;
          return (
            <TouchableOpacity
              key={f.key}
              style={[s.chip, active && s.chipActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>
                {f.icon} {f.label}
              </Text>
              <View style={[s.chipBadge, { backgroundColor: active ? 'rgba(255,255,255,0.3)' : '#E2E8F0' }]}>
                <Text style={[s.chipBadgeText, { color: active ? '#fff' : '#64748B' }]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={groups}
        keyExtractor={(g) => g.title}
        renderItem={({ item: group }) => (
          <View>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{group.title}</Text>
              <View style={s.sectionLine} />
              <Text style={s.sectionCount}>{group.data.length}</Text>
            </View>
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
        )}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        onEndReached={() => hasMore && !loading && userId && fetchCalls(page + 1, userId)}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !loading && (
            <View style={s.emptyWrap}>
              <Text style={s.emptyIcon}>📵</Text>
              <Text style={s.emptyText}>{search ? 'No results found' : 'No calls yet'}</Text>
              <Text style={s.emptyHint}>Pull down to sync call logs</Text>
              {activeCount > 0 && (
                <TouchableOpacity
                  style={s.clearFilterBtn}
                  onPress={() => { setDateFilter('all'); setSort('newest'); setCustomFrom(null); setCustomTo(null); }}
                >
                  <Text style={s.clearFilterText}>Clear date & sort filters</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
      />

      <TouchableOpacity
        style={s.fab}
        onPress={() => { try { require('react-native').Linking.openURL('tel:'); } catch {} }}
      >
        <Text style={s.fabText}>📞</Text>
      </TouchableOpacity>

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
              {/* DATE RANGE */}
              <Text style={fs.sectionLabel}>DATE RANGE</Text>
              <View style={fs.chipGroup}>
                {DATE_FILTERS.map((df) => (
                  <TouchableOpacity
                    key={df.key}
                    style={[fs.chip, pendingDate === df.key && fs.chipActive]}
                    onPress={() => {
                      setPendingDate(df.key);
                      if (df.key !== 'custom') setCalTarget(null);
                    }}
                  >
                    <Text style={[fs.chipText, pendingDate === df.key && fs.chipTextActive]}>
                      {df.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {pendingDate === 'custom' && (
                <View style={fs.customDateWrap}>
                  <View style={fs.dateRow}>
                    <TouchableOpacity
                      style={[fs.dateBtn, calTarget === 'from' && fs.dateBtnActive]}
                      onPress={() => setCalTarget((t) => (t === 'from' ? null : 'from'))}
                    >
                      <Text style={fs.dateBtnLabel}>From</Text>
                      <Text style={[fs.dateBtnValue, pendingFrom && { color: Colors.primary }]}>
                        {fmtDate(pendingFrom)}
                      </Text>
                    </TouchableOpacity>
                    <Text style={fs.dateSep}>→</Text>
                    <TouchableOpacity
                      style={[fs.dateBtn, calTarget === 'to' && fs.dateBtnActive]}
                      onPress={() => setCalTarget((t) => (t === 'to' ? null : 'to'))}
                    >
                      <Text style={fs.dateBtnLabel}>To</Text>
                      <Text style={[fs.dateBtnValue, pendingTo && { color: Colors.primary }]}>
                        {fmtDate(pendingTo)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {calTarget && (
                    <View style={fs.calWrap}>
                      <MiniCalendar
                        value={calTarget === 'from' ? pendingFrom : pendingTo}
                        onChange={(d) => {
                          if (calTarget === 'from') { setPendingFrom(d); if (pendingTo && d > pendingTo) setPendingTo(null); }
                          else { setPendingTo(d); if (pendingFrom && d < pendingFrom) setPendingFrom(null); }
                        }}
                        maxDate={calTarget === 'from' && pendingTo ? pendingTo : undefined}
                        minDate={calTarget === 'to' && pendingFrom ? pendingFrom : undefined}
                      />
                    </View>
                  )}
                </View>
              )}

              {/* SORT BY */}
              <Text style={fs.sectionLabel}>SORT BY</Text>
              <View style={fs.chipGroup}>
                {SORTS.map((so) => (
                  <TouchableOpacity
                    key={so.key}
                    style={[fs.chip, pendingSort === so.key && fs.chipActive]}
                    onPress={() => setPendingSort(so.key)}
                  >
                    <Text style={[fs.chipText, pendingSort === so.key && fs.chipTextActive]}>
                      {so.label}
                    </Text>
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
  root:    { flex: 1, backgroundColor: '#F8F9FB' },

  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  heading: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  syncDot: { color: Colors.primary, fontSize: 16, fontWeight: '900' },
  iconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  iconText:{ fontSize: 15 },

  filterBtn:         { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  filterBtnActive:   { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  filterBtnText:     { fontSize: 13, fontWeight: '600', color: '#64748B' },
  filterBtnTextActive: { color: Colors.primary },

  // Call type chips (always visible)
  chipRow:         { paddingHorizontal: 16, paddingBottom: 10, gap: 8, flexDirection: 'row' },
  chip:            { flexDirection: 'row', alignItems: 'center', height: 34, gap: 5, borderRadius: 999, paddingHorizontal: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive:      { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:        { fontSize: 12, fontWeight: '600', color: '#64748B' },
  chipTextActive:  { color: '#fff' },
  chipBadge:       { borderRadius: 8, minWidth: 18, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  chipBadgeText:   { fontSize: 10, fontWeight: '700' },

  searchBarWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, height: 40 },
  searchIcon:    { fontSize: 14, marginRight: 8 },
  searchInput:   { flex: 1, fontSize: 14, color: '#0F172A' },
  searchClear:   { fontSize: 14, color: '#94A3B8', padding: 4 },

  list:    { paddingHorizontal: 16, paddingBottom: 100 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 8 },
  sectionTitle:  { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 8 },
  sectionLine:   { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  sectionCount:  { fontSize: 11, color: '#94A3B8', marginLeft: 8, fontWeight: '600' },

  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  emptyHint: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  clearFilterBtn: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.primaryLight },
  clearFilterText:{ fontSize: 13, fontWeight: '600', color: Colors.primary },

  fab:     { position: 'absolute', bottom: 24, right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: Colors.primary, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabText: { fontSize: 22 },
});

const fs = StyleSheet.create({
  sheet:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 20, maxHeight: '88%' },
  handle:      { width: 36, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  topRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title:       { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  resetBtn:    { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: '#F1F5F9' },
  resetText:   { fontSize: 12, fontWeight: '600', color: '#64748B' },

  sectionLabel:{ fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  chipGroup:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip:        { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:    { fontSize: 13, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#fff' },

  customDateWrap: { marginBottom: 18 },
  dateRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  dateBtn:     { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', padding: 10, backgroundColor: '#F8F9FB' },
  dateBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  dateBtnLabel:{ fontSize: 10, fontWeight: '700', color: '#94A3B8', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateBtnValue:{ fontSize: 14, fontWeight: '700', color: '#0F172A' },
  dateSep:     { color: '#94A3B8', fontSize: 16 },
  calWrap:     { borderRadius: 14, backgroundColor: '#F8F9FB', padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },

  footer:      { paddingTop: 12, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  applyBtn:    { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  applyText:   { fontSize: 15, fontWeight: '700', color: '#fff' },
});
