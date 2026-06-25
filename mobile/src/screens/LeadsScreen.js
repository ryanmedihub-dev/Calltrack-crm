import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, TextInput, Modal, RefreshControl, StatusBar,
  ScrollView, Linking, ActivityIndicator, Platform,
} from 'react-native';
import api from '../lib/api';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/shadows';
import MiniCalendar from '../components/MiniCalendar';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS = {
  new:           { fg: '#6366F1', bg: '#EEF2FF', label: 'New',           icon: '🆕' },
  contacted:     { fg: '#7C3AED', bg: '#EDE9FE', label: 'Contacted',     icon: '📞' },
  not_connected: { fg: '#64748B', bg: '#F1F5F9', label: 'Not Connected',  icon: '📵' },
  interested:    { fg: '#D97706', bg: '#FEF3C7', label: 'Interested',    icon: '👍' },
  not_interested:{ fg: '#DC2626', bg: '#FEE2E2', label: 'Not Interested', icon: '👎' },
  follow_up:     { fg: '#7C3AED', bg: '#EDE9FE', label: 'Follow Up',     icon: '📅' },
  booking_done:  { fg: '#059669', bg: '#D1FAE5', label: 'Booking Done',  icon: '✅' },
  converted:     { fg: '#16A34A', bg: '#DCFCE7', label: 'Converted',     icon: '🎉' },
  lost:          { fg: '#6B7280', bg: '#F3F4F6', label: 'Lost',          icon: '💀' },
};

const DATE_OPTIONS = [
  { key: 'all',    label: 'All Time'   },
  { key: 'today',  label: 'Today'      },
  { key: 'week',   label: 'This Week'  },
  { key: 'month',  label: 'This Month' },
  { key: 'custom', label: 'Custom'     },
];

function getDateBoundary(key) {
  const now = new Date();
  if (key === 'today') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
  if (key === 'week')  { const d = new Date(now); d.setDate(d.getDate() - 7); d.setHours(0,0,0,0); return d; }
  if (key === 'month') { const d = new Date(now); d.setDate(1); d.setHours(0, 0, 0, 0); return d; }
  return null;
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1d ago';
  if (days < 30)  return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const fmtDate = (d) => d
  ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  : 'Select';

// ── Lead Card ─────────────────────────────────────────────────────────────────

const LeadCard = memo(function LeadCard({ item, onNote, onStatus, onWhatsApp }) {
  const st       = STATUS[item.status] || { fg: '#64748B', bg: '#F1F5F9', label: item.status || 'Unknown', icon: '❓' };
  const lastAgo  = timeAgo(item.lastCallAt);

  return (
    <View style={c.card}>
      <View style={[c.accent, { backgroundColor: st.fg }]} />
      <View style={c.body}>

        {/* Row 1: Avatar + Name/Phone + Status badge */}
        <View style={c.topRow}>
          <View style={[c.avatar, { backgroundColor: st.bg }]}>
            <Text style={[c.avatarLetter, { color: st.fg }]}>
              {item.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={c.nameBlock}>
            <Text style={c.name} numberOfLines={1}>{item.name || 'Unknown'}</Text>
            <Text style={c.phone}>{item.phone}</Text>
          </View>
          <View style={[c.badge, { backgroundColor: st.bg }]}>
            <Text style={c.badgeIcon}>{st.icon}</Text>
            <Text style={[c.badgeLabel, { color: st.fg }]} numberOfLines={1}>{st.label}</Text>
          </View>
        </View>

        {/* Row 2: Last call info */}
        {(lastAgo || item.lastCallDuration > 0) ? (
          <View style={c.callRow}>
            <Text style={c.callText} numberOfLines={1}>
              📞 {item.lastCallType ? `${item.lastCallType} · ` : ''}
              {lastAgo}{item.lastCallDuration > 0 ? ` · ${Math.floor(item.lastCallDuration / 60)}m ${item.lastCallDuration % 60}s` : ''}
            </Text>
            {item.notes?.length > 0 && (
              <Text style={c.noteCount}>{item.notes.length} note{item.notes.length !== 1 ? 's' : ''}</Text>
            )}
          </View>
        ) : (
          <Text style={c.noCallText}>📵 Never called</Text>
        )}

        {/* Row 3: Note preview (optional) */}
        {(item.lastCallNote || item.lastCallSummary) ? (
          <View style={c.noteRow}>
            {item.lastCallSummary && (
              <Text style={c.summaryPill}>💬 {item.lastCallSummary}</Text>
            )}
            {item.lastCallNote && (
              <Text style={c.notePreview} numberOfLines={1}>📝 {item.lastCallNote}</Text>
            )}
          </View>
        ) : null}

        {/* Row 4: Follow-up (optional) */}
        {item.followUpDate ? (
          <View style={c.fuRow}>
            <Text style={c.fuText}>
              📅 {new Date(item.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
        ) : null}

        {/* Row 5: Action buttons — equal width, fixed height */}
        <View style={c.actions}>
          <TouchableOpacity
            style={[c.btn, c.btnCall]}
            onPress={() => Linking.openURL(`tel:${item.phone}`).catch(() => {})}
            activeOpacity={0.75}
          >
            <Text style={c.btnCallText}>📞 Call</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[c.btn, c.btnGhost]}
            onPress={() => onWhatsApp(item)}
            activeOpacity={0.75}
          >
            <Text style={c.btnGhostText}>💬 WA</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[c.btn, c.btnGhost]}
            onPress={() => onNote(item)}
            activeOpacity={0.75}
          >
            <Text style={c.btnGhostText}>📝 Note</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[c.btn, c.btnGhost]}
            onPress={() => onStatus(item)}
            activeOpacity={0.75}
          >
            <Text style={c.btnGhostText}>✏️ Status</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

// ── Status Sheet ──────────────────────────────────────────────────────────────

function StatusSheet({ lead, onClose, onSelect, updating }) {
  return (
    <Modal
      visible={!!lead}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={m.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={m.sheet}>
          <View style={m.handle} />
          <Text style={m.title}>Update Status</Text>
          {lead && <Text style={m.sub}>{lead.name} · {lead.phone}</Text>}
          <View style={m.statusGrid}>
            {Object.entries(STATUS).map(([key, cfg]) => {
              const isActive = lead?.status === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[m.statusOpt, { backgroundColor: cfg.bg }, isActive && { borderColor: cfg.fg, borderWidth: 2 }]}
                  onPress={() => !updating && onSelect(key)}
                  activeOpacity={0.75}
                >
                  <Text style={m.statusOptIcon}>{cfg.icon}</Text>
                  <Text style={[m.statusOptLabel, { color: cfg.fg }]}>{cfg.label}</Text>
                  {isActive && (
                    <View style={[m.checkBadge, { backgroundColor: cfg.fg }]}>
                      <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          {updating && <ActivityIndicator color={Colors.primary} style={{ marginTop: 8 }} />}
          <View style={{ height: 24 }} />
        </View>
      </View>
    </Modal>
  );
}

// ── Note Sheet ────────────────────────────────────────────────────────────────

function NoteSheet({ lead, onClose, onSave }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    await onSave(text.trim());
    setSaving(false);
    setText('');
  };

  return (
    <Modal
      visible={!!lead}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={m.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={m.sheet}>
          <View style={m.handle} />
          <Text style={m.title}>Add Note</Text>
          {lead && <Text style={m.sub}>{lead.name} · {lead.phone}</Text>}
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder="Write your note here…"
            placeholderTextColor={Colors.textMuted}
            style={m.noteInput}
            autoFocus
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={m.charCount}>{text.length}/500</Text>
          <View style={m.btnRow}>
            <TouchableOpacity style={m.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={m.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[m.saveBtn, (!text.trim() || saving) && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={!text.trim() || saving}
            >
              <Text style={m.saveText}>{saving ? 'Saving…' : 'Save Note'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: Platform.OS === 'ios' ? 20 : 8 }} />
        </View>
      </View>
    </Modal>
  );
}

// ── Filter Sheet ──────────────────────────────────────────────────────────────

function FilterSheet({ visible, dateFilter, customFrom, customTo, onApply, onClose }) {
  const [pendingDate, setPendingDate] = useState(dateFilter);
  const [pendingFrom, setPendingFrom] = useState(customFrom);
  const [pendingTo,   setPendingTo]   = useState(customTo);
  const [calSeg,      setCalSeg]      = useState('from');

  // Sync when opened
  useEffect(() => {
    if (visible) {
      setPendingDate(dateFilter);
      setPendingFrom(customFrom);
      setPendingTo(customTo);
      setCalSeg('from');
    }
  }, [visible]);

  const handleApply = () => {
    onApply({ dateFilter: pendingDate, customFrom: pendingFrom, customTo: pendingTo });
    onClose();
  };

  const handleReset = () => {
    setPendingDate('all');
    setPendingFrom(null);
    setPendingTo(null);
    setCalSeg('from');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={f.sheet}>
          <View style={f.handle} />
          <View style={f.topRow}>
            <Text style={f.title}>Filter Leads</Text>
            <TouchableOpacity style={f.resetBtn} onPress={handleReset}>
              <Text style={f.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={f.sectionLabel}>DATE RANGE</Text>
            <View style={f.chipGroup}>
              {DATE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[f.chip, pendingDate === opt.key && f.chipActive]}
                  onPress={() => {
                    setPendingDate(opt.key);
                    if (opt.key !== 'custom') { setPendingFrom(null); setPendingTo(null); }
                    else setCalSeg('from');
                  }}
                >
                  <Text style={[f.chipText, pendingDate === opt.key && f.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {pendingDate === 'custom' && (
              <View style={f.dateWrap}>
                {pendingFrom && pendingTo && (
                  <View style={f.rangeSummary}>
                    <Text style={f.rangeSummaryText}>📅 {fmtDate(pendingFrom)} → {fmtDate(pendingTo)}</Text>
                  </View>
                )}
                <View style={f.segRow}>
                  {['from', 'to'].map((seg) => {
                    const val = seg === 'from' ? pendingFrom : pendingTo;
                    return (
                      <TouchableOpacity
                        key={seg}
                        style={[f.segBtn, calSeg === seg && f.segBtnActive]}
                        onPress={() => setCalSeg(seg)}
                      >
                        <Text style={f.segLabel}>{seg.toUpperCase()}</Text>
                        <Text style={[f.segValue, val && { color: Colors.primary }]}>{fmtDate(val)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={f.calWrap}>
                  <MiniCalendar
                    value={calSeg === 'from' ? pendingFrom : pendingTo}
                    onChange={(d) => {
                      if (calSeg === 'from') {
                        if (pendingTo && d > pendingTo) { setPendingFrom(pendingTo); setPendingTo(d); }
                        else { setPendingFrom(d); setCalSeg('to'); }
                      } else {
                        if (pendingFrom && d < pendingFrom) { setPendingTo(pendingFrom); setPendingFrom(d); }
                        else setPendingTo(d);
                      }
                    }}
                  />
                </View>
              </View>
            )}
            <View style={{ height: 8 }} />
          </ScrollView>

          <View style={f.footer}>
            <TouchableOpacity style={f.applyBtn} onPress={handleApply}>
              <Text style={f.applyText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function LeadsScreen() {
  const [leads,      setLeads]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter,   setDateFilter]   = useState('all');
  const [customFrom,   setCustomFrom]   = useState(null);
  const [customTo,     setCustomTo]     = useState(null);
  const [showFilter,   setShowFilter]   = useState(false);
  const [noteTarget,   setNoteTarget]   = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchLeads = async () => {
    try {
      const res = await api.get('/api/leads/assigned', { params: { limit: 200 } });
      const data = res.data.data;
      setLeads(Array.isArray(data) ? data : (data?.leads || []));
    } catch {}
  };

  useEffect(() => {
    fetchLeads().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLeads();
    setRefreshing(false);
  };

  // Filtered list — memoised so it only recalculates when deps change
  const displayLeads = useMemo(() => {
    return leads.filter((l) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !(l.name  || '').toLowerCase().includes(q) &&
          !(l.phone || '').includes(search.trim())
        ) return false;
      }
      // Status
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      // Date
      if (dateFilter === 'custom') {
        const created = new Date(l.createdAt);
        if (customFrom && created < customFrom) return false;
        if (customTo) {
          const end = new Date(customTo); end.setHours(23, 59, 59, 999);
          if (created > end) return false;
        }
      } else {
        const boundary = getDateBoundary(dateFilter);
        if (boundary && new Date(l.createdAt) < boundary) return false;
      }
      return true;
    });
  }, [leads, search, statusFilter, dateFilter, customFrom, customTo]);

  // Per-status counts from full list (not filtered)
  const statusCounts = useMemo(() => {
    const acc = {};
    for (const key of Object.keys(STATUS)) acc[key] = 0;
    for (const l of leads) if (acc[l.status] !== undefined) acc[l.status]++;
    return acc;
  }, [leads]);

  const handleUpdateStatus = async (newStatus) => {
    if (!statusTarget || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      await api.put(`/api/leads/${statusTarget._id}`, { status: newStatus });
      setLeads((prev) =>
        prev.map((l) => l._id === statusTarget._id ? { ...l, status: newStatus } : l)
      );
      setStatusTarget(null);
    } catch {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveNote = async (text) => {
    if (!noteTarget) return;
    try {
      await api.post(`/api/leads/${noteTarget._id}/note`, { text });
      setNoteTarget(null);
      fetchLeads();
    } catch {
      Alert.alert('Error', 'Failed to add note');
    }
  };

  const handleWhatsApp = useCallback((item) => {
    const digits = (item.phone || '').replace(/\D/g, '');
    const phone  = digits.length === 10 ? `91${digits}` : digits;
    Linking.openURL(`whatsapp://send?phone=${phone}`).catch(() =>
      Linking.openURL(`https://wa.me/${phone}`).catch(() => {})
    );
  }, []);

  const onNotePress   = useCallback((item) => setNoteTarget(item),   []);
  const onStatusPress = useCallback((item) => setStatusTarget(item), []);

  const renderItem = useCallback(({ item }) => (
    <LeadCard
      item={item}
      onNote={onNotePress}
      onStatus={onStatusPress}
      onWhatsApp={handleWhatsApp}
    />
  ), [onNotePress, onStatusPress, handleWhatsApp]);

  const isFiltered = dateFilter !== 'all';

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.preLabel}>PIPELINE</Text>
            <Text style={s.heading}>My Leads</Text>
          </View>
          <View style={s.headerRight}>
            <View style={s.totalPill}>
              <Text style={s.totalText}>{leads.length}</Text>
            </View>
            <TouchableOpacity
              style={[s.filterBtn, isFiltered && s.filterBtnActive]}
              onPress={() => setShowFilter(true)}
            >
              <Text style={[s.filterText, isFiltered && s.filterTextActive]}>
                ⊞ {isFiltered ? '1 active' : 'Filter'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchRow}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Search name or phone…"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Status strip (primary filter — instant) ── */}
      <View style={s.stripWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.strip}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={[s.pill, statusFilter === 'all' && s.pillActive]}
            onPress={() => setStatusFilter('all')}
          >
            <Text style={[s.pillText, statusFilter === 'all' && s.pillTextActive]}>
              All · {leads.length}
            </Text>
          </TouchableOpacity>

          {Object.entries(STATUS).map(([key, st]) => {
            const active = statusFilter === key;
            return (
              <TouchableOpacity
                key={key}
                style={[s.pill, active && { backgroundColor: st.bg, borderColor: st.fg, borderWidth: 1.5 }]}
                onPress={() => setStatusFilter(active ? 'all' : key)}
              >
                <Text style={s.pillDotText}>{st.icon}</Text>
                <Text style={[s.pillText, active && { color: st.fg, fontWeight: '700' }]}>
                  {st.label}{statusCounts[key] > 0 ? ` · ${statusCounts[key]}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Active filter chip ── */}
      {(isFiltered || search.trim()) ? (
        <View style={s.activeFilterRow}>
          <Text style={s.activeFilterText}>
            Showing {displayLeads.length} of {leads.length} leads
          </Text>
          <TouchableOpacity
            onPress={() => {
              setStatusFilter('all');
              setDateFilter('all');
              setCustomFrom(null);
              setCustomTo(null);
              setSearch('');
            }}
          >
            <Text style={s.clearAllText}>Clear all ✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── List ── */}
      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={s.loadingText}>Loading leads…</Text>
        </View>
      ) : (
        <FlatList
          data={displayLeads}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Text style={s.emptyIcon}>🎯</Text>
              <Text style={s.emptyTitle}>
                {leads.length === 0 ? 'No leads yet' : 'No leads match'}
              </Text>
              <Text style={s.emptyHint}>
                {leads.length === 0
                  ? 'Your manager will assign leads to you'
                  : 'Try different filters or search terms'}
              </Text>
              {(isFiltered || search.trim() || statusFilter !== 'all') && (
                <TouchableOpacity
                  style={s.clearBtn}
                  onPress={() => { setStatusFilter('all'); setDateFilter('all'); setCustomFrom(null); setCustomTo(null); setSearch(''); }}
                >
                  <Text style={s.clearBtnText}>Clear all filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* ── Sheets ── */}
      <StatusSheet
        lead={statusTarget}
        onClose={() => setStatusTarget(null)}
        onSelect={handleUpdateStatus}
        updating={updatingStatus}
      />

      <NoteSheet
        lead={noteTarget}
        onClose={() => setNoteTarget(null)}
        onSave={handleSaveNote}
      />

      <FilterSheet
        visible={showFilter}
        dateFilter={dateFilter}
        customFrom={customFrom}
        customTo={customTo}
        onApply={({ dateFilter: df, customFrom: cf, customTo: ct }) => {
          setDateFilter(df);
          setCustomFrom(cf);
          setCustomTo(ct);
        }}
        onClose={() => setShowFilter(false)}
      />
    </View>
  );
}

// ── Card styles ───────────────────────────────────────────────────────────────

const c = StyleSheet.create({
  card:        { backgroundColor: '#fff', borderRadius: 16, marginBottom: 10, flexDirection: 'row', overflow: 'hidden', ...Shadows.card },
  accent:      { width: 4 },
  body:        { flex: 1, paddingHorizontal: 13, paddingVertical: 12 },

  topRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar:      { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarLetter:{ fontSize: 17, fontWeight: '800' },
  nameBlock:   { flex: 1, marginHorizontal: 10 },
  name:        { fontSize: 14, fontWeight: '700', color: Colors.text },
  phone:       { fontSize: 11, color: Colors.textSec, marginTop: 2 },
  badge:       { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3, gap: 3, flexShrink: 0, maxWidth: 120 },
  badgeIcon:   { fontSize: 11 },
  badgeLabel:  { fontSize: 10, fontWeight: '700', flexShrink: 1 },

  callRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  callText:    { flex: 1, fontSize: 12, color: Colors.textSec },
  noteCount:   { fontSize: 11, color: Colors.textMuted, marginLeft: 8, flexShrink: 0 },
  noCallText:  { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },

  noteRow:     { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginBottom: 4 },
  summaryPill: { fontSize: 11, color: Colors.textSec, fontWeight: '600', backgroundColor: '#F1F5F9', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  notePreview: { flex: 1, fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },

  fuRow:  { marginBottom: 4 },
  fuText: { fontSize: 11, fontWeight: '600', color: '#7C3AED', backgroundColor: '#EDE9FE', alignSelf: 'flex-start', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },

  // Action buttons — equal width, fixed height, no size-change glitch
  actions: { flexDirection: 'row', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.divider },
  btn:     { flex: 1, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  btnCall:      { backgroundColor: Colors.primary },
  btnCallText:  { color: '#fff', fontSize: 11, fontWeight: '700' },
  btnGhost:     { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  btnGhostText: { color: Colors.textSec, fontSize: 11, fontWeight: '600' },
});

// ── Status/Note sheet styles ──────────────────────────────────────────────────

const m = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheet:    { backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 12 },
  handle:   { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  title:    { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  sub:      { fontSize: 13, color: Colors.textSec, marginBottom: 16 },

  statusGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  statusOpt:       { width: '30%', borderRadius: 14, padding: 12, alignItems: 'center', position: 'relative', borderWidth: 1.5, borderColor: 'transparent' },
  statusOptIcon:   { fontSize: 22, marginBottom: 5 },
  statusOptLabel:  { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  checkBadge:      { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },

  noteInput:  { backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 14, color: Colors.text, fontSize: 14, textAlignVertical: 'top', minHeight: 110 },
  charCount:  { color: Colors.textMuted, fontSize: 11, textAlign: 'right', marginTop: 4, marginBottom: 16 },
  btnRow:     { flexDirection: 'row', gap: 10 },
  cancelBtn:  { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancelText: { color: Colors.textSec, fontSize: 14, fontWeight: '600' },
  saveBtn:    { flex: 1, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveText:   { color: '#fff', fontSize: 14, fontWeight: '700' },
});

// ── Screen + filter sheet styles ─────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header:     { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 20 : 16, paddingBottom: 12, ...Shadows.sm },
  headerTop:  { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  preLabel:   { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  heading:    { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  headerRight:{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 2 },
  totalPill:  { backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  totalText:  { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  filterBtn:  { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  filterBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: Colors.textSec },
  filterTextActive:{ color: Colors.primary },

  searchRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 42 },
  searchIcon:  { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text, paddingVertical: 0 },
  searchClear: { color: Colors.textMuted, fontSize: 14, paddingLeft: 8 },

  stripWrap: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.divider },
  strip:     { paddingHorizontal: 16, paddingVertical: 10, gap: 7 },
  pill:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  pillActive:{ backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillDotText:{ fontSize: 12 },
  pillText:   { fontSize: 12, fontWeight: '500', color: Colors.textSec },
  pillTextActive: { color: '#fff', fontWeight: '700' },

  activeFilterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.primaryLight + 'AA' },
  activeFilterText:{ fontSize: 12, color: Colors.primary, fontWeight: '600' },
  clearAllText:    { fontSize: 12, color: Colors.primary, fontWeight: '700' },

  listContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 40 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  loadingText: { marginTop: 12, color: Colors.textMuted, fontSize: 14 },

  emptyWrap:  { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon:  { fontSize: 52, marginBottom: 14 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textSec },
  emptyHint:  { fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 19 },
  clearBtn:   { marginTop: 20, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 24, backgroundColor: Colors.primaryLight },
  clearBtnText:{ fontSize: 13, fontWeight: '700', color: Colors.primary },
});

const f = StyleSheet.create({
  sheet:   { backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 12, paddingHorizontal: 20, maxHeight: '80%' },
  handle:  { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  topRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title:   { fontSize: 17, fontWeight: '700', color: Colors.text },
  resetBtn:{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  resetText:{ fontSize: 12, fontWeight: '600', color: Colors.textSec },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  chipGroup:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  chipActive:   { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:     { fontSize: 13, fontWeight: '600', color: Colors.textSec },
  chipTextActive:{ color: '#fff' },

  dateWrap:     { marginTop: 12, marginBottom: 8 },
  rangeSummary: { backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.primary },
  rangeSummaryText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  segRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  segBtn:     { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, padding: 10, backgroundColor: Colors.bg },
  segBtnActive:{ borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  segLabel:   { fontSize: 9, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  segValue:   { fontSize: 14, fontWeight: '700', color: Colors.text },

  calWrap:  { borderRadius: 14, backgroundColor: Colors.bg, padding: 12, borderWidth: 1, borderColor: Colors.border },
  footer:   { paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 34 : 20, borderTopWidth: 1, borderTopColor: Colors.divider },
  applyBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  applyText:{ fontSize: 15, fontWeight: '700', color: '#fff' },
});
