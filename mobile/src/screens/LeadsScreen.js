import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, TextInput, Modal, RefreshControl, StatusBar,
  ScrollView, Linking, ActivityIndicator, Platform, Animated,
} from 'react-native';
import api from '../lib/api';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/shadows';
import MiniCalendar from '../components/MiniCalendar';
import BulkUploadModal from '../components/BulkUploadModal';

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

const DATE_PRESETS = [
  { key: 'all',    label: 'All Time'  },
  { key: 'today',  label: 'Today'     },
  { key: 'week',   label: 'This Week' },
  { key: 'month',  label: 'Month'     },
  { key: 'custom', label: '📅 Custom' },
];

const ATTEMPT_OPTIONS = [
  { key: 'all', label: 'All'        },
  { key: '0',   label: '0 Calls'    },
  { key: '1-2', label: '1–2'        },
  { key: '3-5', label: '3–5'        },
  { key: '6+',  label: '6+'         },
];

const SORTS = [
  { key: 'newest',   label: 'Newest first'    },
  { key: 'oldest',   label: 'Oldest first'    },
  { key: 'name_az',  label: 'Name A → Z'      },
  { key: 'attempts', label: 'Most call attempts' },
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
  const st      = STATUS[item.status] || { fg: '#64748B', bg: '#F1F5F9', label: item.status || 'Unknown', icon: '❓' };
  const lastAgo = timeAgo(item.lastCallAt);

  return (
    <View style={c.card}>
      <View style={[c.accent, { backgroundColor: st.fg }]} />
      <View style={c.body}>
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

        {(lastAgo || item.lastCallDuration > 0) ? (
          <View style={c.callRow}>
            <Text style={c.callText} numberOfLines={1}>
              📞 {item.lastCallType ? `${item.lastCallType} · ` : ''}{lastAgo}
              {item.lastCallDuration > 0 ? ` · ${Math.floor(item.lastCallDuration / 60)}m ${item.lastCallDuration % 60}s` : ''}
            </Text>
            <View style={c.callRowRight}>
              {(item.attempts > 0) && (
                <View style={c.attemptsTag}>
                  <Text style={c.attemptsTagText}>{item.attempts}×</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={c.callRow}>
            <Text style={c.noCallText}>📵 Never called</Text>
          </View>
        )}

        {item.lastCallNote ? (
          <Text style={c.notePreview} numberOfLines={1}>📝 {item.lastCallNote}</Text>
        ) : null}

        {item.followUpDate ? (
          <View style={c.fuRow}>
            <Text style={c.fuText}>
              📅 {new Date(item.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
        ) : null}

        <View style={c.actions}>
          <TouchableOpacity
            style={[c.btn, c.btnCall]}
            onPress={() => Linking.openURL(`tel:${item.phone}`).catch(() => {})}
            activeOpacity={0.75}
          >
            <Text style={c.btnCallText}>📞 Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[c.btn, c.btnGhost]} onPress={() => onWhatsApp(item)} activeOpacity={0.75}>
            <Text style={c.btnGhostText}>💬 WA</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[c.btn, c.btnGhost]} onPress={() => onNote(item)} activeOpacity={0.75}>
            <Text style={c.btnGhostText}>📝 Note</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[c.btn, c.btnGhost]} onPress={() => onStatus(item)} activeOpacity={0.75}>
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
    <Modal visible={!!lead} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
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
    <Modal visible={!!lead} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
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

// ── Sort Sheet ────────────────────────────────────────────────────────────────

function SortSheet({ visible, value, onSelect, onClose }) {
  const translateY = useRef(new Animated.Value(300)).current;
  useEffect(() => {
    Animated.spring(translateY, { toValue: visible ? 0 : 300, useNativeDriver: true, damping: 20, mass: 0.7 }).start();
  }, [visible]);
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={so.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[so.sheet, { transform: [{ translateY }] }]}>
        <View style={so.handle} />
        <Text style={so.title}>Sort Leads</Text>
        {SORTS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={so.row}
            onPress={() => { onSelect(s.key); onClose(); }}
          >
            <Text style={[so.label, value === s.key && so.labelActive]}>{s.label}</Text>
            {value === s.key && <Text style={so.check}>✓</Text>}
          </TouchableOpacity>
        ))}
        <View style={{ height: 24 }} />
      </Animated.View>
    </Modal>
  );
}
const so = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.5)' },
  sheet:   { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12 },
  handle:  { width: 38, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 18 },
  title:   { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  row:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  label:   { fontSize: 15, fontWeight: '500', color: Colors.textSec },
  labelActive: { color: Colors.primary, fontWeight: '700' },
  check:   { fontSize: 16, color: Colors.primary, fontWeight: '700' },
});

// ── Custom Date Sheet ────────────────────────────────────────────────────────

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
      <TouchableOpacity style={cds.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[cds.sheet, { transform: [{ translateY }] }]}>
        <View style={cds.handle} />
        <Text style={cds.title}>Custom Date Range</Text>
        <View style={cds.segRow}>
          {['from', 'to'].map((s) => {
            const val = s === 'from' ? pFrom : pTo;
            return (
              <TouchableOpacity key={s} style={[cds.seg, seg === s && cds.segActive]} onPress={() => setSeg(s)}>
                <Text style={cds.segLabel}>{s.toUpperCase()}</Text>
                <Text style={[cds.segValue, val && { color: Colors.primary }]}>{fmtDate(val)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {(pFrom && pTo) && (
          <View style={cds.rangeSummary}>
            <Text style={cds.rangeSummaryText}>📅 {fmtDate(pFrom)} → {fmtDate(pTo)}</Text>
          </View>
        )}
        <View style={cds.calWrap}>
          <MiniCalendar
            value={seg === 'from' ? pFrom : pTo}
            onChange={(d) => {
              if (seg === 'from') { setPFrom(d); if (pTo && d > pTo) setPTo(null); setSeg('to'); }
              else { if (pFrom && d < pFrom) { setPFrom(d); setPTo(pFrom); } else setPTo(d); }
            }}
          />
        </View>
        <TouchableOpacity
          style={[cds.applyBtn, !pFrom && { opacity: 0.5 }]}
          onPress={() => { onApply(pFrom, pTo); onClose(); }}
          disabled={!pFrom}
        >
          <Text style={cds.applyText}>Apply Range</Text>
        </TouchableOpacity>
        <TouchableOpacity style={cds.clearBtn} onPress={() => { onApply(null, null); onClose(); }}>
          <Text style={cds.clearText}>Clear Date Filter</Text>
        </TouchableOpacity>
        <View style={{ height: 24 }} />
      </Animated.View>
    </Modal>
  );
}
const cds = StyleSheet.create({
  overlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.5)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12 },
  handle:      { width: 38, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  title:       { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  segRow:      { flexDirection: 'row', gap: 10, marginBottom: 12 },
  seg:         { flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, padding: 12, backgroundColor: Colors.bg },
  segActive:   { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  segLabel:    { fontSize: 9, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  segValue:    { fontSize: 15, fontWeight: '700', color: Colors.text },
  rangeSummary:{ backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12, alignSelf: 'center', borderWidth: 1, borderColor: Colors.primary },
  rangeSummaryText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  calWrap:     { borderRadius: 14, backgroundColor: Colors.bg, padding: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  applyBtn:    { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  applyText:   { fontSize: 15, fontWeight: '700', color: '#fff' },
  clearBtn:    { paddingVertical: 10, alignItems: 'center' },
  clearText:   { fontSize: 13, fontWeight: '600', color: Colors.textSec },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function LeadsScreen() {
  const [leads,          setLeads]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [search,         setSearch]         = useState('');
  const [showSearch,     setShowSearch]     = useState(false);
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [datePreset,     setDatePreset]     = useState('all');
  const [customFrom,     setCustomFrom]     = useState(null);
  const [customTo,       setCustomTo]       = useState(null);
  const [attemptsFilter, setAttemptsFilter] = useState('all');
  const [sort,           setSort]           = useState('newest');
  const [noteTarget,     setNoteTarget]     = useState(null);
  const [statusTarget,   setStatusTarget]   = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showSort,       setShowSort]       = useState(false);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const searchRef = useRef(null);

  const fetchLeads = async () => {
    try {
      const res  = await api.get('/api/leads/assigned', { params: { limit: 200 } });
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

  // Filtered + sorted list
  const displayLeads = useMemo(() => {
    let result = leads.filter((l) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!(l.name || '').toLowerCase().includes(q) && !(l.phone || '').includes(search.trim())) return false;
      }
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (datePreset === 'custom') {
        const created = new Date(l.createdAt);
        if (customFrom && created < customFrom) return false;
        if (customTo) { const end = new Date(customTo); end.setHours(23,59,59,999); if (created > end) return false; }
      } else {
        const b = getDateBoundary(datePreset);
        if (b && new Date(l.createdAt) < b) return false;
      }
      if (attemptsFilter !== 'all') {
        const att = l.attempts || 0;
        if (attemptsFilter === '0'   && att !== 0)             return false;
        if (attemptsFilter === '1-2' && (att < 1 || att > 2)) return false;
        if (attemptsFilter === '3-5' && (att < 3 || att > 5)) return false;
        if (attemptsFilter === '6+'  && att < 6)              return false;
      }
      return true;
    });

    result.sort((a, b) => {
      if (sort === 'oldest')   return new Date(a.createdAt) - new Date(b.createdAt);
      if (sort === 'name_az')  return (a.name || '').localeCompare(b.name || '');
      if (sort === 'attempts') return (b.attempts || 0) - (a.attempts || 0);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return result;
  }, [leads, search, statusFilter, datePreset, customFrom, customTo, attemptsFilter, sort]);

  // Status counts: from base that excludes statusFilter (so badges show count if you click that status)
  const statusCounts = useMemo(() => {
    const acc = { all: 0 };
    for (const key of Object.keys(STATUS)) acc[key] = 0;
    const base = leads.filter((l) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!(l.name || '').toLowerCase().includes(q) && !(l.phone || '').includes(search.trim())) return false;
      }
      if (datePreset === 'custom') {
        const created = new Date(l.createdAt);
        if (customFrom && created < customFrom) return false;
        if (customTo) { const end = new Date(customTo); end.setHours(23,59,59,999); if (created > end) return false; }
      } else {
        const b = getDateBoundary(datePreset);
        if (b && new Date(l.createdAt) < b) return false;
      }
      if (attemptsFilter !== 'all') {
        const att = l.attempts || 0;
        if (attemptsFilter === '0'   && att !== 0)             return false;
        if (attemptsFilter === '1-2' && (att < 1 || att > 2)) return false;
        if (attemptsFilter === '3-5' && (att < 3 || att > 5)) return false;
        if (attemptsFilter === '6+'  && att < 6)              return false;
      }
      return true;
    });
    acc.all = base.length;
    for (const l of base) if (acc[l.status] !== undefined) acc[l.status]++;
    return acc;
  }, [leads, search, datePreset, customFrom, customTo, attemptsFilter]);

  const handleUpdateStatus = async (newStatus) => {
    if (!statusTarget || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      await api.put(`/api/leads/${statusTarget._id}`, { status: newStatus });
      setLeads((prev) => prev.map((l) => l._id === statusTarget._id ? { ...l, status: newStatus } : l));
      setStatusTarget(null);
    } catch { Alert.alert('Error', 'Failed to update status'); }
    finally { setUpdatingStatus(false); }
  };

  const handleSaveNote = async (text) => {
    if (!noteTarget) return;
    try {
      await api.post(`/api/leads/${noteTarget._id}/note`, { text });
      setNoteTarget(null);
      fetchLeads();
    } catch { Alert.alert('Error', 'Failed to add note'); }
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
    <LeadCard item={item} onNote={onNotePress} onStatus={onStatusPress} onWhatsApp={handleWhatsApp} />
  ), [onNotePress, onStatusPress, handleWhatsApp]);

  const hasActiveFilters = datePreset !== 'all' || attemptsFilter !== 'all' || search.trim() || statusFilter !== 'all' || sort !== 'newest';
  const activeCount      = (datePreset !== 'all' ? 1 : 0) + (attemptsFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) + (sort !== 'newest' ? 1 : 0);

  const clearAll = () => {
    setStatusFilter('all'); setDatePreset('all'); setCustomFrom(null);
    setCustomTo(null); setAttemptsFilter('all'); setSearch(''); setSort('newest');
  };

  const hasCustom = datePreset === 'custom' && (customFrom || customTo);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
      {showSearch ? (
        <View style={s.searchBar}>
          <Text style={s.searchBarIcon}>🔍</Text>
          <TextInput
            ref={searchRef}
            style={s.searchBarInput}
            placeholder="Search name or phone…"
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
            <Text style={s.preLabel}>PIPELINE</Text>
            <Text style={s.heading}>My Leads</Text>
          </View>
          <View style={s.headerRight}>
            <View style={s.totalPill}>
              <Text style={s.totalText}>{leads.length}</Text>
            </View>
            <TouchableOpacity style={s.iconBtn} onPress={() => setShowSearch(true)}>
              <Text style={s.iconText}>🔍</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.iconBtn, sort !== 'newest' && s.iconBtnActive]}
              onPress={() => setShowSort(true)}
            >
              <Text style={[s.iconText, sort !== 'newest' && { color: Colors.primary }]}>⇅</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.iconBtn, s.uploadBtn]} onPress={() => setShowBulkUpload(true)}>
              <Text style={s.uploadBtnText}>⬆ Upload</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Date preset chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.dateRow}
        style={s.dateRowWrap}
      >
        {DATE_PRESETS.map((dp) => {
          const active   = datePreset === dp.key;
          const isCustom = dp.key === 'custom';
          return (
            <TouchableOpacity
              key={dp.key}
              style={[s.dateChip, active && (isCustom ? s.dateChipCustom : s.dateChipActive)]}
              onPress={() => { setDatePreset(dp.key); if (isCustom) setShowCustomDate(true); }}
            >
              <Text style={[s.dateChipText, active && (isCustom ? s.dateChipTextCustom : s.dateChipTextActive)]}>
                {dp.label}{isCustom && hasCustom ? `: ${fmtDate(customFrom)}${customTo ? `→${fmtDate(customTo)}` : ''}` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Attempts chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.attRow}
        style={s.attRowWrap}
      >
        <Text style={s.attLabel}>Calls:</Text>
        {ATTEMPT_OPTIONS.map((opt) => {
          const active = attemptsFilter === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[s.attChip, active && s.attChipActive]}
              onPress={() => setAttemptsFilter(opt.key)}
            >
              <Text style={[s.attChipText, active && s.attChipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Status pills ── */}
      <View style={s.statusWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statusRow}>
          <TouchableOpacity
            style={[s.pill, statusFilter === 'all' && s.pillActive]}
            onPress={() => setStatusFilter('all')}
          >
            <Text style={[s.pillText, statusFilter === 'all' && s.pillTextActive]}>
              All · {statusCounts.all}
            </Text>
          </TouchableOpacity>
          {Object.entries(STATUS).map(([key, st]) => {
            const active = statusFilter === key;
            if (!statusCounts[key]) return null;
            return (
              <TouchableOpacity
                key={key}
                style={[s.pill, active && { backgroundColor: st.bg, borderColor: st.fg, borderWidth: 1.5 }]}
                onPress={() => setStatusFilter(active ? 'all' : key)}
              >
                <Text style={s.pillIcon}>{st.icon}</Text>
                <Text style={[s.pillText, active && { color: st.fg, fontWeight: '700' }]}>
                  {st.label} · {statusCounts[key]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Results summary / clear bar ── */}
      {hasActiveFilters && (
        <View style={s.summaryBar}>
          <Text style={s.summaryText}>
            {displayLeads.length} of {leads.length} leads
            {activeCount > 0 ? ` · ${activeCount} filter${activeCount !== 1 ? 's' : ''}` : ''}
          </Text>
          <TouchableOpacity onPress={clearAll}>
            <Text style={s.clearAllText}>Clear all ✕</Text>
          </TouchableOpacity>
        </View>
      )}

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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Text style={s.emptyIcon}>🎯</Text>
              <Text style={s.emptyTitle}>{leads.length === 0 ? 'No leads yet' : 'No leads match'}</Text>
              <Text style={s.emptyHint}>
                {leads.length === 0 ? 'Upload leads via CSV or your manager will assign them' : 'Try different filters or search terms'}
              </Text>
              {hasActiveFilters && (
                <TouchableOpacity style={s.clearBtn} onPress={clearAll}>
                  <Text style={s.clearBtnText}>Clear all filters</Text>
                </TouchableOpacity>
              )}
              {leads.length === 0 && (
                <TouchableOpacity style={s.uploadEmptyBtn} onPress={() => setShowBulkUpload(true)}>
                  <Text style={s.uploadEmptyText}>⬆ Upload Leads via CSV</Text>
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
      <SortSheet
        visible={showSort}
        value={sort}
        onSelect={setSort}
        onClose={() => setShowSort(false)}
      />
      <CustomDateSheet
        visible={showCustomDate}
        from={customFrom}
        to={customTo}
        onApply={(f, t) => { setCustomFrom(f); setCustomTo(t); }}
        onClose={() => setShowCustomDate(false)}
      />
      <BulkUploadModal
        visible={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        onUploaded={() => { setShowBulkUpload(false); fetchLeads(); }}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
  callRowRight:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  attemptsTag: { backgroundColor: '#EFF6FF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  attemptsTagText: { fontSize: 10, fontWeight: '700', color: '#3B82F6' },
  noCallText:  { fontSize: 12, color: Colors.textMuted },
  notePreview: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic', marginBottom: 4 },
  fuRow:       { marginBottom: 4 },
  fuText:      { fontSize: 11, fontWeight: '600', color: '#7C3AED', backgroundColor: '#EDE9FE', alignSelf: 'flex-start', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  actions:     { flexDirection: 'row', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.divider },
  btn:         { flex: 1, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  btnCall:     { backgroundColor: Colors.primary },
  btnCallText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  btnGhost:    { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  btnGhostText:{ color: Colors.textSec, fontSize: 11, fontWeight: '600' },
});

const m = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheet:      { backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 12 },
  handle:     { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  title:      { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  sub:        { fontSize: 13, color: Colors.textSec, marginBottom: 16 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  statusOpt:  { width: '30%', borderRadius: 14, padding: 12, alignItems: 'center', position: 'relative', borderWidth: 1.5, borderColor: 'transparent' },
  statusOptIcon:  { fontSize: 22, marginBottom: 5 },
  statusOptLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  checkBadge: { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
  noteInput:  { backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 14, color: Colors.text, fontSize: 14, textAlignVertical: 'top', minHeight: 110 },
  charCount:  { color: Colors.textMuted, fontSize: 11, textAlign: 'right', marginTop: 4, marginBottom: 16 },
  btnRow:     { flexDirection: 'row', gap: 10 },
  cancelBtn:  { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancelText: { color: Colors.textSec, fontSize: 14, fontWeight: '600' },
  saveBtn:    { flex: 1, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveText:   { color: '#fff', fontSize: 14, fontWeight: '700' },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header:      { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 18 : 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: Colors.divider },
  preLabel:    { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  heading:     { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 2 },
  totalPill:   { backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  totalText:   { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  iconBtn:     { width: 36, height: 36, borderRadius: 11, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', ...Shadows.sm },
  iconBtnActive:{ backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  iconText:    { fontSize: 15 },
  uploadBtn:   { width: 'auto', paddingHorizontal: 10, backgroundColor: '#059669' + '22', borderColor: '#059669' },
  uploadBtnText: { fontSize: 11, fontWeight: '700', color: '#059669' },

  searchBar:      { margin: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 13, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 44, ...Shadows.sm },
  searchBarIcon:  { fontSize: 14, marginRight: 8 },
  searchBarInput: { flex: 1, fontSize: 14, color: Colors.text },
  searchClear:    { fontSize: 14, color: Colors.textMuted, padding: 4 },

  dateRowWrap: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.divider },
  dateRow:     { paddingHorizontal: 14, paddingVertical: 9, gap: 7 },
  dateChip:    { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border },
  dateChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dateChipCustom: { backgroundColor: '#EDE9FE', borderColor: '#7C3AED' },
  dateChipText:   { fontSize: 12, fontWeight: '600', color: Colors.textSec },
  dateChipTextActive:  { color: '#fff', fontWeight: '700' },
  dateChipTextCustom:  { color: '#7C3AED', fontWeight: '700' },

  attRowWrap:     { backgroundColor: '#FAFAFA', borderBottomWidth: 1, borderBottomColor: Colors.divider },
  attRow:         { paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  attLabel:       { fontSize: 11, fontWeight: '700', color: Colors.textMuted, marginRight: 2 },
  attChip:        { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border },
  attChipActive:  { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  attChipText:    { fontSize: 11, fontWeight: '600', color: Colors.textSec },
  attChipTextActive: { color: '#fff', fontWeight: '700' },

  statusWrap: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.divider },
  statusRow:  { paddingHorizontal: 14, paddingVertical: 9, gap: 7 },
  pill:       { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  pillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillIcon:   { fontSize: 12 },
  pillText:   { fontSize: 12, fontWeight: '500', color: Colors.textSec },
  pillTextActive: { color: '#fff', fontWeight: '700' },

  summaryBar:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 7, backgroundColor: Colors.primaryLight },
  summaryText:  { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  clearAllText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },

  listContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 40 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  loadingText: { marginTop: 12, color: Colors.textMuted, fontSize: 14 },

  emptyWrap:     { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon:     { fontSize: 52, marginBottom: 14 },
  emptyTitle:    { fontSize: 17, fontWeight: '700', color: Colors.textSec },
  emptyHint:     { fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 19 },
  clearBtn:      { marginTop: 20, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 24, backgroundColor: Colors.primaryLight },
  clearBtnText:  { fontSize: 13, fontWeight: '700', color: Colors.primary },
  uploadEmptyBtn:{ marginTop: 12, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 24, backgroundColor: '#D1FAE5', borderWidth: 1.5, borderColor: '#059669' },
  uploadEmptyText: { fontSize: 13, fontWeight: '700', color: '#059669' },
});
