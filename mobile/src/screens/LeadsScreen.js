import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, TextInput, Modal, RefreshControl, StatusBar,
  ScrollView, Linking, ActivityIndicator,
} from 'react-native';
import api from '../lib/api';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/shadows';
import MiniCalendar from '../components/MiniCalendar';

const STATUS = {
  new:            { fg: '#2563EB', bg: '#DBEAFE', label: 'New',          icon: '🆕' },
  contacted:      { fg: '#7C3AED', bg: '#EDE9FE', label: 'Contacted',    icon: '📞' },
  interested:     { fg: '#D97706', bg: '#FEF3C7', label: 'Interested',   icon: '👍' },
  not_interested: { fg: '#DC2626', bg: '#FEE2E2', label: 'Not Interested', icon: '👎' },
  converted:      { fg: '#16A34A', bg: '#DCFCE7', label: 'Converted',    icon: '🎉' },
  lost:           { fg: '#6B7280', bg: '#F3F4F6', label: 'Lost',         icon: '💀' },
};

const DATE_OPTIONS = [
  { key: 'all',    label: 'All Time'   },
  { key: 'today',  label: 'Today'      },
  { key: 'week',   label: 'This Week'  },
  { key: 'month',  label: 'This Month' },
  { key: 'custom', label: 'Custom'     },
];

function getLeadDateBoundary(key) {
  const now = new Date();
  if (key === 'today') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
  if (key === 'week')  { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
  if (key === 'month') { const d = new Date(now); d.setDate(1); d.setHours(0, 0, 0, 0); return d; }
  return null;
}

const fmtDate = (d) => d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Select';

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30)  return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

// ── LeadCard ──────────────────────────────────────────────────────────────────

const LeadCard = memo(function LeadCard({ item, onNote, onStatusPress }) {
  const st = STATUS[item.status] || { fg: '#64748B', bg: '#F1F5F9', label: item.status, icon: '?' };
  const lastCallAgo = timeAgo(item.lastCallAt);
  const followUpFmt = item.followUpDate
    ? new Date(item.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null;
  const dur = item.lastCallDuration > 0
    ? ` · ${Math.floor(item.lastCallDuration / 60)}m ${item.lastCallDuration % 60}s`
    : '';

  return (
    <View style={s.card}>
      <View style={[s.cardAccent, { backgroundColor: st.fg }]} />
      <View style={s.cardBody}>

        {/* Top: avatar + name + phone + status badge */}
        <View style={s.cardTop}>
          <View style={[s.avatar, { backgroundColor: st.bg }]}>
            <Text style={[s.avatarText, { color: st.fg }]}>
              {item.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.leadName} numberOfLines={1}>{item.name}</Text>
            <Text style={s.leadPhone}>{item.phone}</Text>
          </View>
          <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[s.statusBadgeText, { color: st.fg }]}>{st.label}</Text>
          </View>
        </View>

        {/* Middle: last call + notes count */}
        <View style={s.midRow}>
          {lastCallAgo
            ? <Text style={s.lastCallText} numberOfLines={1}>
                📞 {item.lastCallType ? `${item.lastCallType} · ` : ''}{lastCallAgo}{dur}
              </Text>
            : <Text style={s.neverCalledText}>📵 Never called</Text>
          }
          {item.notes?.length > 0 && (
            <Text style={s.notesCount}>{item.notes.length} note{item.notes.length !== 1 ? 's' : ''}</Text>
          )}
        </View>

        {/* Last call summary + note preview */}
        {(item.lastCallSummary || item.lastCallNote) && (
          <View style={s.summaryRow}>
            {item.lastCallSummary && (
              <View style={[s.summaryPill, { backgroundColor: '#F1F5F9' }]}>
                <Text style={s.summaryPillText}>💬 {item.lastCallSummary}</Text>
              </View>
            )}
            {item.lastCallNote && (
              <Text style={s.notePreview} numberOfLines={1}>📝 {item.lastCallNote}</Text>
            )}
          </View>
        )}

        {/* Follow-up pill */}
        {followUpFmt && (
          <View style={s.fuPill}>
            <Text style={s.fuPillText}>📅 Follow-up: {followUpFmt}</Text>
          </View>
        )}

        {/* Action row */}
        <View style={s.actionRow}>
          <TouchableOpacity
            style={s.callBtn}
            onPress={() => Linking.openURL(`tel:${item.phone}`).catch(() => {})}
          >
            <Text style={s.callBtnText}>📞 Call Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={() => onNote(item)}>
            <Text style={s.iconBtnText}>📝 Note</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={() => onStatusPress(item)}>
            <Text style={s.iconBtnText}>✏️ Status</Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
});

// ── StatusSheet ───────────────────────────────────────────────────────────────

function StatusSheet({ lead, onClose, onSelect, updating }) {
  return (
    <Modal
      visible={!!lead}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={ss.sheet}>
          <View style={ss.handle} />
          <Text style={ss.title}>Update Status</Text>
          {lead && (
            <Text style={ss.sub}>{lead.name} · {lead.phone}</Text>
          )}
          <View style={ss.grid}>
            {Object.entries(STATUS).map(([key, cfg]) => {
              const isActive = lead?.status === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[ss.optCard, { backgroundColor: cfg.bg }, isActive && { borderWidth: 2, borderColor: cfg.fg }]}
                  onPress={() => !updating && onSelect(key)}
                  activeOpacity={0.75}
                >
                  <Text style={ss.optIcon}>{cfg.icon}</Text>
                  <Text style={[ss.optLabel, { color: cfg.fg }]}>{cfg.label}</Text>
                  {isActive && (
                    <View style={[ss.optCheck, { backgroundColor: cfg.fg }]}>
                      <Text style={{ color: '#fff', fontSize: 8 }}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          {updating && <ActivityIndicator color={Colors.primary} style={{ marginTop: 8, marginBottom: 4 }} />}
          <View style={{ height: 20 }} />
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function LeadsScreen() {
  const [leads, setLeads]               = useState([]);
  const [refreshing, setRefreshing]     = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [noteModal, setNoteModal]       = useState(null);
  const [noteText, setNoteText]         = useState('');
  const [saving, setSaving]             = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter]     = useState('all');
  const [customFrom, setCustomFrom]     = useState(null);
  const [customTo, setCustomTo]         = useState(null);
  const [statusSheetLead, setStatusSheetLead]   = useState(null);
  const [updatingStatus, setUpdatingStatus]     = useState(false);

  const [showFilter, setShowFilter]       = useState(false);
  const [pendingStatus, setPendingStatus] = useState('all');
  const [pendingDate, setPendingDate]     = useState('all');
  const [pendingFrom, setPendingFrom]     = useState(null);
  const [pendingTo, setPendingTo]         = useState(null);
  const [calTarget, setCalTarget]         = useState(null);

  const fetchLeads = async () => {
    try {
      const res = await api.get('/api/leads/assigned', { params: { limit: 200 } });
      const payload = res.data.data;
      setLeads(Array.isArray(payload) ? payload : (payload?.leads || []));
    } catch {}
  };

  useEffect(() => { fetchLeads(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLeads();
    setRefreshing(false);
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      await api.post(`/api/leads/${noteModal._id}/note`, { text: noteText.trim() });
      Alert.alert('Saved', 'Note added successfully');
      setNoteModal(null);
      setNoteText('');
      fetchLeads();
    } catch {
      Alert.alert('Error', 'Failed to add note');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!statusSheetLead || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      await api.put(`/api/leads/${statusSheetLead._id}`, { status: newStatus });
      setLeads((prev) =>
        prev.map((l) => l._id === statusSheetLead._id ? { ...l, status: newStatus } : l)
      );
      setStatusSheetLead(null);
    } catch {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const statusCounts = Object.keys(STATUS).reduce((acc, key) => {
    acc[key] = leads.filter((l) => l.status === key).length;
    return acc;
  }, {});

  const displayLeads = leads.filter((l) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch  = (l.name  || '').toLowerCase().includes(q);
      const phoneMatch = (l.phone || '').includes(searchQuery.trim());
      if (!nameMatch && !phoneMatch) return false;
    }
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (dateFilter === 'custom') {
      if (customFrom && new Date(l.createdAt) < customFrom) return false;
      if (customTo) {
        const end = new Date(customTo); end.setHours(23, 59, 59, 999);
        if (new Date(l.createdAt) > end) return false;
      }
    } else {
      const boundary = getLeadDateBoundary(dateFilter);
      if (boundary && new Date(l.createdAt) < boundary) return false;
    }
    return true;
  });

  const activeCount        = [statusFilter !== 'all', dateFilter !== 'all'].filter(Boolean).length;
  const pendingActiveCount = [pendingStatus !== 'all', pendingDate !== 'all'].filter(Boolean).length;

  const openFilter = () => {
    setPendingStatus(statusFilter);
    setPendingDate(dateFilter);
    setPendingFrom(customFrom);
    setPendingTo(customTo);
    setCalTarget(dateFilter === 'custom' ? 'from' : null);
    setShowFilter(true);
  };

  const applyFilter = () => {
    setStatusFilter(pendingStatus);
    setDateFilter(pendingDate);
    setCustomFrom(pendingFrom);
    setCustomTo(pendingTo);
    setShowFilter(false);
  };

  const resetFilter = () => {
    setPendingStatus('all');
    setPendingDate('all');
    setPendingFrom(null);
    setPendingTo(null);
    setCalTarget(null);
  };

  const onNotePress = useCallback((item) => {
    setNoteModal(item);
    setNoteText('');
  }, []);

  const onStatusPress = useCallback((item) => {
    setStatusSheetLead(item);
  }, []);

  const renderItem = useCallback(({ item }) => (
    <LeadCard item={item} onNote={onNotePress} onStatusPress={onStatusPress} />
  ), [onNotePress, onStatusPress]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.preLabel}>PIPELINE</Text>
            <Text style={s.heading}>My Leads</Text>
          </View>
          <View style={s.headerRight}>
            <View style={s.totalBadge}>
              <Text style={s.totalText}>{leads.length} total</Text>
            </View>
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

        {/* Search */}
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Search by name or phone…"
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={s.searchClear}>
              <Text style={s.searchClearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Status strip ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.strip}
      >
        <TouchableOpacity
          style={[s.pill, statusFilter === 'all' && s.pillActive]}
          onPress={() => setStatusFilter('all')}
        >
          <Text style={[s.pillText, statusFilter === 'all' && s.pillTextActive]}>
            All · {leads.length}
          </Text>
        </TouchableOpacity>
        {Object.entries(STATUS).map(([key, st]) => (
          <TouchableOpacity
            key={key}
            style={[s.pill, statusFilter === key && { backgroundColor: st.bg, borderColor: st.fg }]}
            onPress={() => setStatusFilter(statusFilter === key ? 'all' : key)}
          >
            <View style={[s.pillDot, { backgroundColor: st.fg }]} />
            <Text style={[s.pillText, statusFilter === key && { color: st.fg, fontWeight: '700' }]}>
              {st.label}{statusCounts[key] > 0 ? ` · ${statusCounts[key]}` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── List ── */}
      <FlatList
        data={displayLeads}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={s.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyIcon}>🎯</Text>
            <Text style={s.emptyText}>
              {leads.length === 0 ? 'No leads assigned yet' : 'No leads found'}
            </Text>
            <Text style={s.emptyHint}>
              {leads.length === 0
                ? 'Your manager will assign leads to you'
                : 'Try clearing filters or adjusting your search'}
            </Text>
            {(activeCount > 0 || searchQuery.trim()) && (
              <TouchableOpacity
                style={s.clearBtn}
                onPress={() => {
                  setStatusFilter('all'); setDateFilter('all');
                  setCustomFrom(null); setCustomTo(null); setSearchQuery('');
                }}
              >
                <Text style={s.clearBtnText}>Clear all</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* ── Status sheet ── */}
      <StatusSheet
        lead={statusSheetLead}
        onClose={() => setStatusSheetLead(null)}
        onSelect={handleUpdateStatus}
        updating={updatingStatus}
      />

      {/* ── Note modal ── */}
      <Modal
        visible={!!noteModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => { setNoteModal(null); setNoteText(''); }}
      >
        <View style={s.overlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => { setNoteModal(null); setNoteText(''); }}
          />
          <View style={s.noteSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Add Note</Text>
            <Text style={s.sheetSub}>{noteModal?.name} · {noteModal?.phone}</Text>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              multiline
              placeholder="Write your note here…"
              placeholderTextColor={Colors.textMuted}
              style={s.noteInput}
              autoFocus
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={s.charCount}>{noteText.length}/500</Text>
            <View style={s.modalBtns}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => { setNoteModal(null); setNoteText(''); }}
                disabled={saving}
              >
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, (!noteText.trim() || saving) && { opacity: 0.5 }]}
                onPress={handleAddNote}
                disabled={!noteText.trim() || saving}
              >
                <Text style={s.saveText}>{saving ? 'Saving…' : 'Save Note'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Filter sheet ── */}
      <Modal
        visible={showFilter}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowFilter(false)}
      >
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowFilter(false)} />
          <View style={fs.sheet}>
            <View style={fs.handle} />
            <View style={fs.topRow}>
              <Text style={fs.title}>Filter Leads</Text>
              <TouchableOpacity onPress={resetFilter} style={fs.resetBtn}>
                <Text style={fs.resetText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={fs.sectionLabel}>STATUS</Text>
              <View style={fs.chipGroup}>
                {['all', ...Object.keys(STATUS)].map((key) => {
                  const cfg = STATUS[key] || { label: 'All Status', fg: '#64748B', bg: '#F1F5F9' };
                  const active = pendingStatus === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        fs.chip,
                        active && (key === 'all'
                          ? fs.chipActive
                          : { backgroundColor: cfg.bg, borderColor: cfg.fg }),
                      ]}
                      onPress={() => setPendingStatus(key)}
                    >
                      {key !== 'all' && <View style={[fs.chipDot, { backgroundColor: cfg.fg }]} />}
                      <Text style={[
                        fs.chipText,
                        active && (key === 'all'
                          ? fs.chipTextActive
                          : { color: cfg.fg, fontWeight: '700' }),
                      ]}>
                        {key === 'all' ? 'All Status' : cfg.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={fs.divider} />

              <Text style={fs.sectionLabel}>DATE RANGE</Text>
              <View style={fs.chipGroup}>
                {DATE_OPTIONS.map((df) => (
                  <TouchableOpacity
                    key={df.key}
                    style={[fs.chip, pendingDate === df.key && fs.chipActive]}
                    onPress={() => {
                      setPendingDate(df.key);
                      if (df.key === 'custom') setCalTarget('from');
                      else setCalTarget(null);
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
                  {/* Summary chip */}
                  {pendingFrom && pendingTo && (
                    <View style={fs.rangeSummary}>
                      <Text style={fs.rangeSummaryText}>
                        📅 {fmtDate(pendingFrom)} → {fmtDate(pendingTo)}
                      </Text>
                    </View>
                  )}

                  {/* Segmented From / To tabs */}
                  <View style={fs.segRow}>
                    <TouchableOpacity
                      style={[fs.segBtn, calTarget === 'from' && fs.segBtnActive]}
                      onPress={() => setCalTarget('from')}
                    >
                      <Text style={fs.segLabel}>FROM</Text>
                      <Text style={[fs.segValue, pendingFrom && { color: Colors.primary }]}>{fmtDate(pendingFrom)}</Text>
                    </TouchableOpacity>
                    <Text style={fs.segArrow}>→</Text>
                    <TouchableOpacity
                      style={[fs.segBtn, calTarget === 'to' && fs.segBtnActive]}
                      onPress={() => setCalTarget('to')}
                    >
                      <Text style={fs.segLabel}>TO</Text>
                      <Text style={[fs.segValue, pendingTo && { color: Colors.primary }]}>{fmtDate(pendingTo)}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Always-visible calendar */}
                  <View style={fs.calWrap}>
                    <MiniCalendar
                      value={calTarget === 'from' ? pendingFrom : pendingTo}
                      onChange={(d) => {
                        if (calTarget === 'from') {
                          if (pendingTo && d > pendingTo) {
                            setPendingFrom(pendingTo);
                            setPendingTo(d);
                          } else {
                            setPendingFrom(d);
                            setCalTarget('to');
                          }
                        } else {
                          if (pendingFrom && d < pendingFrom) {
                            setPendingTo(pendingFrom);
                            setPendingFrom(d);
                          } else {
                            setPendingTo(d);
                          }
                        }
                      }}
                    />
                  </View>
                </View>
              )}

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

// ── Card + List styles ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header:     { backgroundColor: Colors.surface, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, ...Shadows.sm },
  headerTop:  { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  preLabel:   { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  heading:    { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  headerRight:{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 3 },
  totalBadge: { backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  totalText:  { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  filterBtn:  { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  filterBtnActive:     { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  filterBtnText:       { fontSize: 12, fontWeight: '600', color: Colors.textSec },
  filterBtnTextActive: { color: Colors.primary },

  searchWrap:      { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 42 },
  searchIcon:      { fontSize: 14, marginRight: 8 },
  searchInput:     { flex: 1, fontSize: 13, color: Colors.text },
  searchClear:     { padding: 4 },
  searchClearText: { color: Colors.textMuted, fontSize: 13 },

  strip: { paddingHorizontal: 16, paddingVertical: 10, gap: 7 },
  pill:  { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  pillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillDot:    { width: 7, height: 7, borderRadius: 4 },
  pillText:   { fontSize: 12, fontWeight: '500', color: Colors.textSec },
  pillTextActive: { color: '#fff', fontWeight: '700' },

  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },

  card:      { backgroundColor: Colors.surface, borderRadius: 16, marginBottom: 10, overflow: 'hidden', flexDirection: 'row', ...Shadows.card },
  cardAccent:{ width: 4 },
  cardBody:  { flex: 1, padding: 13 },

  cardTop:       { flexDirection: 'row', alignItems: 'center' },
  avatar:        { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  avatarText:    { fontSize: 18, fontWeight: '800' },
  leadName:      { fontSize: 14, fontWeight: '700', color: Colors.text },
  leadPhone:     { fontSize: 11, color: Colors.textSec, marginTop: 2 },
  statusBadge:   { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, marginLeft: 8, flexShrink: 0 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },

  midRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 },
  lastCallText:   { flex: 1, fontSize: 12, color: Colors.textSec },
  neverCalledText:{ flex: 1, fontSize: 12, color: Colors.textMuted },
  notesCount:     { fontSize: 11, color: Colors.textMuted, marginLeft: 8 },

  summaryRow:     { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  summaryPill:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  summaryPillText:{ fontSize: 11, color: Colors.textSec, fontWeight: '600' },
  notePreview:    { flex: 1, fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },

  fuPill:     { alignSelf: 'flex-start', backgroundColor: '#EDE9FE', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, marginTop: 7 },
  fuPillText: { fontSize: 11, fontWeight: '600', color: '#7C3AED' },

  actionRow: { flexDirection: 'row', gap: 7, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.divider },
  callBtn:   { flex: 1.4, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 9, alignItems: 'center', ...Shadows.sm },
  callBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  iconBtn:   { flex: 1, backgroundColor: Colors.bg, borderRadius: 10, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  iconBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textSec },

  emptyWrap: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 52, marginBottom: 14 },
  emptyText: { fontSize: 17, fontWeight: '700', color: Colors.textSec },
  emptyHint: { fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center', paddingHorizontal: 32, lineHeight: 19 },
  clearBtn:  { marginTop: 20, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 24, backgroundColor: Colors.primaryLight },
  clearBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  overlay:     { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  noteSheet:   { backgroundColor: Colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 24, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:  { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  sheetSub:    { fontSize: 13, color: Colors.textSec, marginBottom: 16 },
  noteInput:   { backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 14, color: Colors.text, fontSize: 14, textAlignVertical: 'top', minHeight: 110 },
  charCount:   { color: Colors.textMuted, fontSize: 11, textAlign: 'right', marginTop: 4, marginBottom: 16 },
  modalBtns:   { flexDirection: 'row', gap: 10 },
  cancelBtn:   { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancelText:  { color: Colors.textSec, fontSize: 14, fontWeight: '600' },
  saveBtn:     { flex: 1, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveText:    { color: '#fff', fontSize: 14, fontWeight: '700' },
});

// ── StatusSheet styles ────────────────────────────────────────────────────────

const ss = StyleSheet.create({
  sheet:    { backgroundColor: Colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 12 },
  handle:   { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  title:    { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  sub:      { fontSize: 13, color: Colors.textSec, marginBottom: 18 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optCard:  { width: '30%', borderRadius: 14, padding: 12, alignItems: 'center', position: 'relative', borderWidth: 1.5, borderColor: 'transparent' },
  optIcon:  { fontSize: 22, marginBottom: 6 },
  optLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  optCheck: { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
});

// ── Filter sheet styles ───────────────────────────────────────────────────────

const fs = StyleSheet.create({
  sheet:    { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 20, maxHeight: '88%' },
  handle:   { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  topRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title:    { fontSize: 17, fontWeight: '700', color: Colors.text },
  resetBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  resetText:{ fontSize: 12, fontWeight: '600', color: Colors.textSec },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  divider:      { height: 1, backgroundColor: Colors.divider, marginVertical: 16 },

  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip:      { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  chipActive:{ backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipDot:   { width: 7, height: 7, borderRadius: 4 },
  chipText:  { fontSize: 13, fontWeight: '600', color: Colors.textSec },
  chipTextActive: { color: '#fff' },

  customDateWrap: { marginTop: 12, marginBottom: 8 },

  rangeSummary:     { backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.primary },
  rangeSummaryText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  segRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  segBtn:      { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, padding: 10, backgroundColor: Colors.bg },
  segBtnActive:{ borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  segLabel:    { fontSize: 9, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  segValue:    { fontSize: 14, fontWeight: '700', color: Colors.text },
  segArrow:    { color: Colors.textMuted, fontSize: 16 },

  calWrap:        { borderRadius: 14, backgroundColor: Colors.bg, padding: 12, borderWidth: 1, borderColor: Colors.border },

  footer:   { paddingTop: 12, paddingBottom: 24, borderTopWidth: 1, borderTopColor: Colors.divider },
  applyBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', ...Shadows.sm },
  applyText:{ fontSize: 15, fontWeight: '700', color: '#fff' },
});
