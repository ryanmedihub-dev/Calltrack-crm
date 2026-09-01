import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  RefreshControl, StatusBar, Linking, Alert, ActivityIndicator,
} from 'react-native';
import api from '../lib/api';
import ContactAvatar from '../components/ContactAvatar';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/shadows';

const POLL_MS = 12_000;
const POLL_BACKOFF_CEILING_MS = 2 * 60_000;
const SEARCH_DEBOUNCE_MS = 350;

// "waiting since" — the pool's whole value is showing how stale a lead is, so this stays
// coarse and glanceable rather than precise.
function waitingSince(ts) {
  if (!ts) return 'just now';
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function SourcePill({ source }) {
  return (
    <View style={s.sourcePill}>
      <Text style={s.sourcePillText}>{source || 'Unknown'}</Text>
    </View>
  );
}

// An agent picking this lead deserves to know N people already tried and got nowhere — that
// changes how they open the call. Only shown once it's actually been recycled at least once.
function RecycleChip({ count }) {
  if (!count) return null;
  return (
    <View style={s.recycleChip}>
      <Text style={s.recycleChipText}>Retry {count}/3</Text>
    </View>
  );
}

// Call history from the call log, which links calls to leads by phone whether or not the lead
// was ever claimed — so this counts calls colleagues made straight from their handsets too, not
// just ones started from this screen. The pool is ordered by this, so it's worth showing plainly:
// green "Never called" is the lead you're meant to take first.
function AttemptsChip({ attempts, connected, lastCallAt, lastCallEmployee }) {
  const n = attempts || 0;
  if (n === 0) {
    return (
      <View style={[s.attemptChip, s.attemptChipFresh]}>
        <Text style={[s.attemptChipText, s.attemptChipTextFresh]}>Never called</Text>
      </View>
    );
  }
  const when = lastCallAt ? waitingSince(lastCallAt) : null;
  const who = lastCallEmployee ? ` by ${lastCallEmployee}` : '';
  return (
    <View style={s.attemptChip}>
      <Text style={s.attemptChipText} numberOfLines={1}>
        {n} {n === 1 ? 'attempt' : 'attempts'}
        {connected ? ` · ${connected} connected` : ''}
        {when ? ` · last ${when}${who}` : ''}
      </Text>
    </View>
  );
}

// An agent choosing which lead to grab first is choosing on budget and urgency. Surfacing just
// those two inline means they don't have to expand every card to triage the pool — which is the
// whole reason the pool screen exists. Matched on label substring because the exact question
// wording differs per campaign.
const HIGHLIGHT_PATTERNS = [/budget/i, /planning|when/i];

function highlightDetails(details) {
  if (!details?.length) return [];
  const out = [];
  HIGHLIGHT_PATTERNS.forEach((re) => {
    const hit = details.find((d) => re.test(d.label) && !out.includes(d));
    if (hit) out.push(hit);
  });
  return out;
}

function ExtraDetails({ details, expanded, onToggle }) {
  if (!details?.length) return null;
  const highlights = highlightDetails(details);

  return (
    <View style={s.extraWrap}>
      <TouchableOpacity style={s.extraToggle} onPress={onToggle} activeOpacity={0.7}>
        <Text style={s.extraToggleText}>📋 {details.length} details</Text>
        <Text style={s.extraChevron}>{expanded ? '⌃' : '⌄'}</Text>
      </TouchableOpacity>

      {/* Highlights stay visible collapsed; hidden when expanded to avoid showing them twice. */}
      {!expanded && highlights.length > 0 && (
        <View style={s.chipRow}>
          {highlights.map((d) => (
            <View key={d.label} style={s.highlightChip}>
              <Text style={s.highlightChipText} numberOfLines={1}>{d.value}</Text>
            </View>
          ))}
        </View>
      )}

      {expanded && (
        <View style={s.extraList}>
          {details.map((d, i) => (
            <View key={`${d.label}-${i}`} style={s.extraRow}>
              <Text style={s.extraLabel}>{d.label}</Text>
              <Text style={s.extraValue}>{d.value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function LeadCard({ item, onAttend, claiming, expanded, onToggleDetails }) {
  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <ContactAvatar name={item.name} number={item.phone} size={42} />
        <View style={s.cardMid}>
          <Text style={s.name} numberOfLines={1}>{item.name || item.phone}</Text>
          <Text style={s.phone}>{item.phone}</Text>
        </View>
        <View style={s.waitWrap}>
          <SourcePill source={item.source} />
          <Text style={s.waitText}>{waitingSince(item.pooledAt || item.createdAt)}</Text>
        </View>
      </View>

      <View style={s.metaRow}>
        <AttemptsChip
          attempts={item.attempts}
          connected={item.connectedCallCount}
          lastCallAt={item.lastCallAt}
          lastCallEmployee={item.lastCallEmployee}
        />
        <RecycleChip count={item.recycleCount} />
      </View>

      {(item.city || (item.tags && item.tags.length > 0)) && (
        <View style={s.chipRow}>
          {!!item.city && (
            <View style={s.chip}><Text style={s.chipText}>📍 {item.city}</Text></View>
          )}
          {(item.tags || []).slice(0, 3).map((t) => (
            <View key={t} style={s.chip}><Text style={s.chipText}>{t}</Text></View>
          ))}
        </View>
      )}

      <ExtraDetails details={item.extraDetails} expanded={expanded} onToggle={onToggleDetails} />

      <TouchableOpacity
        style={[s.attendBtn, claiming && s.attendBtnBusy]}
        onPress={() => onAttend(item)}
        disabled={claiming}
        activeOpacity={0.85}
      >
        {claiming
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={s.attendText}>Attend Lead</Text>}
      </TouchableOpacity>
    </View>
  );
}

export default function LiveLeadsScreen() {
  const [leads, setLeads]         = useState([]);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState('');
  const [claimingId, setClaimingId] = useState(null);
  // Collapsed by default: with 6+ answers per lead, expanding everything turns a scannable
  // pool into a wall of text and pushes Attend — the one button this screen exists for —
  // below the fold.
  const [expandedId, setExpandedId] = useState(null);
  // Set on a 429 so the banner can render; cleared on the next clean poll.
  const [rateLimited, setRateLimited] = useState(false);

  // Every state write below happens after an await, so it has to be guarded — otherwise a
  // poll landing after the tab is switched away warns and leaks.
  const mountedRef = useRef(true);
  const searchRef  = useRef('');
  // Current poll interval. Doubles on each consecutive 429 (capped) so a fixed-interval poll
  // can't keep hammering a bucket it's already exhausted; resets to POLL_MS on success.
  const pollDelayRef = useRef(POLL_MS);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const load = useCallback(async (q) => {
    try {
      const [poolRes, statsRes] = await Promise.all([
        api.get('/api/lead-pool', { params: { limit: 50, ...(q ? { search: q } : {}) } }),
        api.get('/api/lead-pool/stats').catch(() => null),
      ]);
      if (!mountedRef.current) return;
      // Ignore a response for a search term the user has already typed past.
      if (searchRef.current !== (q || '')) return;
      setLeads(poolRes.data?.data?.leads || []);
      if (statsRes) setStats(statsRes.data?.data || null);
      pollDelayRef.current = POLL_MS;
      setRateLimited(false);
    } catch (err) {
      // Deliberately keep whatever is already on screen. An agent mid-scroll on a flaky
      // connection must not have the list yanked out from under them by one failed poll.
      if (err?.response?.status === 429) {
        if (mountedRef.current) setRateLimited(true);
        pollDelayRef.current = Math.min(pollDelayRef.current * 2, POLL_BACKOFF_CEILING_MS);
      }
    } finally {
      if (mountedRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  // Debounced search: firing a request per keystroke would hammer the endpoint every agent
  // is already polling every 12s.
  useEffect(() => {
    searchRef.current = search;
    const t = setTimeout(() => load(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search, load]);

  // Self-rescheduling rather than setInterval, so the delay picked up by pollDelayRef inside
  // load() (post-429 backoff, or the reset back to POLL_MS on success) takes effect on the
  // very next tick instead of waiting for a fixed interval to be torn down and rebuilt.
  useEffect(() => {
    let timer;
    const tick = async () => {
      await load(searchRef.current);
      if (mountedRef.current) timer = setTimeout(tick, pollDelayRef.current);
    };
    timer = setTimeout(tick, pollDelayRef.current);
    return () => clearTimeout(timer);
  }, [load]);

  const onRefresh = () => { setRefreshing(true); load(searchRef.current); };

  const handleAttend = async (lead) => {
    setClaimingId(lead._id);
    try {
      await api.post(`/api/lead-pool/${lead._id}/claim`);
      if (!mountedRef.current) return;
      // Drop the card immediately rather than waiting for the next poll — the server has
      // already committed, and the tap has to feel like it did something.
      setLeads((prev) => prev.filter((l) => l._id !== lead._id));
      setStats((prev) => (prev ? { ...prev, available: Math.max(0, prev.available - 1), claimedToday: (prev.claimedToday || 0) + 1 } : prev));
      Alert.alert(
        'Lead assigned to you',
        `${lead.name || lead.phone} is now yours.`,
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Call now', onPress: () => Linking.openURL(`tel:${lead.phone}`).catch(() => {}) },
        ]
      );
    } catch (err) {
      if (!mountedRef.current) return;
      const code = err?.response?.data?.code;
      if (code === 'ALREADY_CLAIMED' || code === 'NOT_FOUND') {
        // The card is provably stale — remove it and resync rather than leaving something
        // on screen that can never be claimed.
        setLeads((prev) => prev.filter((l) => l._id !== lead._id));
        Alert.alert('Already taken', 'Another agent picked up this lead a moment ago.');
        load(searchRef.current);
      } else {
        Alert.alert('Could not attend lead', err?.response?.data?.error || 'Please try again.');
      }
    } finally {
      if (mountedRef.current) setClaimingId(null);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={s.header}>
        <View>
          <View style={s.liveRow}>
            <View style={s.liveDot} />
            <Text style={s.liveLabel}>LIVE</Text>
          </View>
          <Text style={s.heading}>Open Leads</Text>
        </View>
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statValue}>{stats?.available ?? '—'}</Text>
            <Text style={s.statLabel}>Available</Text>
          </View>
          <View style={s.statBox}>
            <Text style={[s.statValue, { color: Colors.success }]}>{stats?.claimedToday ?? '—'}</Text>
            <Text style={s.statLabel}>Attended</Text>
          </View>
        </View>
      </View>

      <View style={s.searchBar}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or number…"
          placeholderTextColor={Colors.textMuted}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={s.searchClear}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {rateLimited && (
        <View style={s.rateLimitBanner}>
          <Text style={s.rateLimitText}>Updates paused — retrying shortly</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item) => item._id}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <LeadCard
              item={item}
              onAttend={handleAttend}
              claiming={claimingId === item._id}
              expanded={expandedId === item._id}
              onToggleDetails={() => setExpandedId((cur) => (cur === item._id ? null : item._id))}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🎯</Text>
              <Text style={s.emptyTitle}>No open leads right now</Text>
              <Text style={s.emptyHint}>New leads appear here automatically as they arrive.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  liveRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.danger },
  liveLabel: { fontSize: 10, fontWeight: '800', color: Colors.danger, letterSpacing: 0.8 },
  heading:   { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.5, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statBox:  { alignItems: 'center', minWidth: 58 },
  statValue:{ fontSize: 18, fontWeight: '800', color: Colors.primary },
  statLabel:{ fontSize: 10, color: Colors.textMuted, marginTop: 1 },

  searchBar: {
    margin: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 13, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, height: 44, ...Shadows.sm,
  },
  searchIcon:  { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  searchClear: { fontSize: 14, color: Colors.textMuted, padding: 4 },

  rateLimitBanner: {
    marginHorizontal: 14, marginBottom: 10, backgroundColor: Colors.warningBg,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
  },
  rateLimitText: { fontSize: 12, fontWeight: '600', color: Colors.warning, textAlign: 'center' },

  list: { paddingHorizontal: 14, paddingBottom: 100 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border, ...Shadows.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardMid: { flex: 1 },
  name:    { fontSize: 15, fontWeight: '700', color: Colors.text },
  phone:   { fontSize: 12, color: Colors.textSec, marginTop: 2 },
  waitWrap:{ alignItems: 'flex-end', gap: 4 },
  waitText:{ fontSize: 11, color: Colors.textMuted },

  sourcePill:     { backgroundColor: Colors.primaryLight, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  sourcePillText: { fontSize: 10, fontWeight: '700', color: Colors.primary },

  recycleChip:     { alignSelf: 'flex-start', backgroundColor: Colors.warningBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  recycleChipText: { fontSize: 10, fontWeight: '700', color: Colors.warning },

  metaRow:   { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 },
  attemptChip:      { backgroundColor: Colors.bgAlt, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, maxWidth: '100%' },
  attemptChipText:  { fontSize: 10, fontWeight: '600', color: Colors.textSec },
  attemptChipFresh:     { backgroundColor: Colors.successBg },
  attemptChipTextFresh: { color: Colors.success, fontWeight: '700' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip:    { backgroundColor: Colors.bgAlt, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  chipText:{ fontSize: 11, color: Colors.textSec, fontWeight: '500' },

  extraWrap:   { marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 10 },
  extraToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  extraToggleText: { fontSize: 12, fontWeight: '600', color: Colors.textSec },
  extraChevron:{ fontSize: 14, color: Colors.textMuted, lineHeight: 16 },
  extraList:   { marginTop: 8, gap: 8 },
  extraRow:    {},
  extraLabel:  { fontSize: 11, color: Colors.textMuted },
  extraValue:  { fontSize: 12.5, fontWeight: '600', color: Colors.text, marginTop: 1 },

  highlightChip:     { backgroundColor: Colors.successBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, maxWidth: '48%' },
  highlightChipText: { fontSize: 11, fontWeight: '700', color: Colors.success },

  attendBtn: {
    marginTop: 12, backgroundColor: Colors.primary, borderRadius: 12,
    height: 44, alignItems: 'center', justifyContent: 'center',
  },
  attendBtnBusy: { opacity: 0.7 },
  attendText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  empty:      { alignItems: 'center', paddingTop: 70, paddingHorizontal: 32 },
  emptyIcon:  { fontSize: 46, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.textSec },
  emptyHint:  { fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 19 },
});
