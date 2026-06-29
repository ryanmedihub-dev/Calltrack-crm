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

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS = {
  new:           { fg: '#1A6BFF', bg: '#EBF2FF', label: 'New',           icon: '🆕' },
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
  { key: 'all', label: 'All'     },
  { key: '0',   label: '0 Calls' },
  { key: '1-2', label: '1–2'     },
  { key: '3-5', label: '3–5'     },
  { key: '6+',  label: '6+'      },
];

const SORTS = [
  { key: 'newest',   label: 'Newest first'      },
  { key: 'oldest',   label: 'Oldest first'      },
  { key: 'name_az',  label: 'Name A → Z'        },
  { key: 'attempts', label: 'Most call attempts' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDateBoundary(key) {
  const now = new Date();
  if (key === 'today') { const d = new Date(now); d.setHours(0,0,0,0); return d; }
  if (key === 'week')  { const d = new Date(now); d.setDate(d.getDate()-7); d.setHours(0,0,0,0); return d; }
  if (key === 'month') { const d = new Date(now); d.setDate(1); d.setHours(0,0,0,0); return d; }
  return null;
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1d ago';
  if (days < 30)  return `${days}d ago`;
  return `${Math.floor(days/30)}mo ago`;
}

const fmtDate = (d) => d
  ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  : 'Select';

const fmtDur = (sec) => {
  if (!sec) return null;
  const m = Math.floor(sec/60), s = sec%60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

// ── Lead Card ─────────────────────────────────────────────────────────────────

const LeadCard = memo(function LeadCard({ item, onNote, onStatus, onWhatsApp }) {
  const st      = STATUS[item.status] || { fg: '#64748B', bg: '#F1F5F9', label: item.status || 'Unknown', icon: '❓' };
  const lastAgo = timeAgo(item.lastCallAt);
  const dur     = fmtDur(item.lastCallDuration);

  return (
    <View style={lc.wrap}>
      <View style={[lc.bar, { backgroundColor: st.fg }]} />
      <View style={lc.body}>
        <View style={lc.topRow}>
          <View style={[lc.avatar, { backgroundColor: st.bg }]}>
            <Text style={[lc.avatarLetter, { color: st.fg }]}>
              {item.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={lc.nameBlock}>
            <Text style={lc.name} numberOfLines={1}>{item.name || 'Unknown'}</Text>
            <Text style={lc.phone}>{item.phone}</Text>
          </View>
          <View style={[lc.badge, { backgroundColor: st.bg, borderColor: st.fg + '40' }]}>
            <Text style={lc.badgeIcon}>{st.icon}</Text>
            <Text style={[lc.badgeLabel, { color: st.fg }]} numberOfLines={1}>{st.label}</Text>
          </View>
        </View>

        {(lastAgo || item.attempts > 0) ? (
          <View style={lc.callRow}>
            <Text style={lc.callInfo} numberOfLines={1}>
              {item.lastCallType ? `${item.lastCallType}` : '📞'}
              {lastAgo ? ` · ${lastAgo}` : ''}
              {dur ? ` · ${dur}` : ''}
            </Text>
            {item.attempts > 0 && (
              <View style={lc.attBadge}>
                <Text style={lc.attTxt}>{item.attempts}×</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={lc.noCall}>📵 Never called</Text>
        )}

        {!!item.lastCallNote && (
          <Text style={lc.note} numberOfLines={1}>📝 {item.lastCallNote}</Text>
        )}
        {!!item.followUpDate && (
          <View style={lc.fuWrap}>
            <Text style={lc.fuTxt}>
              📅 {new Date(item.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
        )}

        <View style={lc.actions}>
          <TouchableOpacity style={[lc.btn, lc.btnCall]}
            onPress={() => Linking.openURL(`tel:${item.phone}`).catch(()=>{})} activeOpacity={0.8}>
            <Text style={lc.btnCallTxt}>📞 Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[lc.btn, lc.btnGhost]} onPress={() => onWhatsApp(item)} activeOpacity={0.8}>
            <Text style={lc.btnGhostTxt}>💬 WA</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[lc.btn, lc.btnGhost]} onPress={() => onNote(item)} activeOpacity={0.8}>
            <Text style={lc.btnGhostTxt}>📝 Note</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[lc.btn, lc.btnGhost]} onPress={() => onStatus(item)} activeOpacity={0.8}>
            <Text style={lc.btnGhostTxt}>✏️ Status</Text>
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
      <View style={sh.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={sh.sheet}>
          <View style={sh.handle} />
          <Text style={sh.title}>Update Status</Text>
          {lead && <Text style={sh.sub}>{lead.name} · {lead.phone}</Text>}
          <View style={sh.grid}>
            {Object.entries(STATUS).map(([key, cfg]) => {
              const isActive = lead?.status === key;
              return (
                <TouchableOpacity key={key} activeOpacity={0.75}
                  style={[sh.opt, { backgroundColor: cfg.bg }, isActive && { borderColor: cfg.fg, borderWidth: 2 }]}
                  onPress={() => !updating && onSelect(key)}>
                  <Text style={sh.optIcon}>{cfg.icon}</Text>
                  <Text style={[sh.optLabel, { color: cfg.fg }]}>{cfg.label}</Text>
                  {isActive && (
                    <View style={[sh.check, { backgroundColor: cfg.fg }]}>
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
  const [text, setText]     = useState('');
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
      <View style={sh.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={sh.sheet}>
          <View style={sh.handle} />
          <Text style={sh.title}>Add Note</Text>
          {lead && <Text style={sh.sub}>{lead.name} · {lead.phone}</Text>}
          <TextInput value={text} onChangeText={setText} multiline
            placeholder="Write your note…" placeholderTextColor={Colors.textMuted}
            style={sh.input} autoFocus maxLength={500} textAlignVertical="top" />
          <Text style={sh.charCnt}>{text.length}/500</Text>
          <View style={sh.btnRow}>
            <TouchableOpacity style={sh.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={sh.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[sh.saveBtn, (!text.trim()||saving) && { opacity:0.5 }]}
              onPress={handleSave} disabled={!text.trim()||saving}>
              <Text style={sh.saveTxt}>{saving ? 'Saving…' : 'Save Note'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: Platform.OS === 'ios' ? 20 : 8 }} />
        </View>
      </View>
    </Modal>
  );
}

// ── Custom Date Sheet ─────────────────────────────────────────────────────────

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
          {['from', 'to'].map(sg => {
            const val = sg === 'from' ? pFrom : pTo;
            return (
              <TouchableOpacity key={sg} style={[cds.seg, seg === sg && cds.segActive]} onPress={() => setSeg(sg)}>
                <Text style={cds.segLbl}>{sg.toUpperCase()}</Text>
                <Text style={[cds.segVal, val && { color: Colors.primary }]}>{fmtDate(val)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {pFrom && pTo && (
          <View style={cds.rangeSummary}>
            <Text style={cds.rangeText}>📅 {fmtDate(pFrom)} → {fmtDate(pTo)}</Text>
          </View>
        )}
        <View style={cds.calWrap}>
          <MiniCalendar
            value={seg === 'from' ? pFrom : pTo}
            onChange={d => {
              if (seg === 'from') { setPFrom(d); if (pTo && d > pTo) setPTo(null); setSeg('to'); }
              else { if (pFrom && d < pFrom) { setPFrom(d); setPTo(pFrom); } else setPTo(d); }
            }}
          />
        </View>
        <TouchableOpacity style={[cds.applyBtn, !pFrom && { opacity:0.5 }]}
          onPress={() => { onApply(pFrom, pTo); onClose(); }} disabled={!pFrom}>
          <Text style={cds.applyTxt}>Apply Range</Text>
        </TouchableOpacity>
        <TouchableOpacity style={cds.clearBtn} onPress={() => { onApply(null, null); onClose(); }}>
          <Text style={cds.clearTxt}>Clear Date Filter</Text>
        </TouchableOpacity>
        <View style={{ height: 24 }} />
      </Animated.View>
    </Modal>
  );
}

// ── Filter Sheet (date + attempts + sort) ─────────────────────────────────────

function FilterSheet({ visible, datePreset, attemptsFilter, sort, customFrom, customTo,
  onDateChange, onAttemptsChange, onSortChange, onCustomDate, onClearAll, onClose }) {
  const translateY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    Animated.spring(translateY, { toValue: visible ? 0 : 600, useNativeDriver: true, damping: 20, mass: 0.8 }).start();
  }, [visible]);

  if (!visible) return null;

  const hasCustom = datePreset === 'custom' && (customFrom || customTo);
  const activeCount = (datePreset !== 'all' ? 1 : 0) + (attemptsFilter !== 'all' ? 1 : 0) + (sort !== 'newest' ? 1 : 0);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={fs.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[fs.sheet, { transform: [{ translateY }] }]}>
        <View style={fs.handle} />

        {/* Header */}
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
            {DATE_PRESETS.map(dp => {
              const active   = datePreset === dp.key;
              const isCustom = dp.key === 'custom';
              return (
                <TouchableOpacity key={dp.key} activeOpacity={0.8}
                  style={[fs.chip, active && (isCustom ? fs.chipCustom : fs.chipActive)]}
                  onPress={() => { onDateChange(dp.key); if (isCustom) onCustomDate(); }}>
                  <Text style={[fs.chipTxt, active && (isCustom ? fs.chipTxtCustom : fs.chipTxtActive)]}>
                    {dp.label}
                    {isCustom && hasCustom ? `: ${fmtDate(customFrom)}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Attempts */}
          <Text style={fs.sectionLabel}>CALL ATTEMPTS</Text>
          <View style={fs.chipGroup}>
            {ATTEMPT_OPTIONS.map(opt => {
              const active = attemptsFilter === opt.key;
              return (
                <TouchableOpacity key={opt.key} activeOpacity={0.8}
                  style={[fs.chip, active && fs.chipActive]}
                  onPress={() => onAttemptsChange(opt.key)}>
                  <Text style={[fs.chipTxt, active && fs.chipTxtActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Sort */}
          <Text style={fs.sectionLabel}>SORT BY</Text>
          <View style={fs.sortGroup}>
            {SORTS.map(s => {
              const active = sort === s.key;
              return (
                <TouchableOpacity key={s.key} activeOpacity={0.8}
                  style={[fs.sortRow, active && fs.sortRowActive]}
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
  const [showFilter,     setShowFilter]     = useState(false);
  const [showCustomDate, setShowCustomDate] = useState(false);
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

  const { displayLeads, statusCounts } = useMemo(() => {
    // Single pass: base filter (no status) → counts, then filter by status → sorted display
    const q = search.trim().toLowerCase();
    const base = leads.filter(l => {
      if (q && !(l.name||'').toLowerCase().includes(q) && !(l.phone||'').includes(search.trim())) return false;
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

    // Counts from base
    const counts = { all: base.length };
    for (const key of Object.keys(STATUS)) counts[key] = 0;
    for (const l of base) if (counts[l.status] !== undefined) counts[l.status]++;

    // Display: apply status filter on base, then sort
    const display = (statusFilter === 'all' ? base : base.filter(l => l.status === statusFilter))
      .slice()
      .sort((a, b) => {
        if (sort === 'oldest')   return new Date(a.createdAt) - new Date(b.createdAt);
        if (sort === 'name_az')  return (a.name||'').localeCompare(b.name||'');
        if (sort === 'attempts') return (b.attempts||0) - (a.attempts||0);
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

    return { displayLeads: display, statusCounts: counts };
  }, [leads, search, statusFilter, datePreset, customFrom, customTo, attemptsFilter, sort]);

  const handleUpdateStatus = async (newStatus) => {
    if (!statusTarget || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      await api.put(`/api/leads/${statusTarget._id}`, { status: newStatus });
      setLeads(prev => prev.map(l => l._id === statusTarget._id ? { ...l, status: newStatus } : l));
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
    const digits = (item.phone||'').replace(/\D/g,'');
    const phone  = digits.length === 10 ? `91${digits}` : digits;
    Linking.openURL(`whatsapp://send?phone=${phone}`).catch(() =>
      Linking.openURL(`https://wa.me/${phone}`).catch(()=>{})
    );
  }, []);

  const clearAll = () => {
    setStatusFilter('all'); setDatePreset('all'); setCustomFrom(null);
    setCustomTo(null); setAttemptsFilter('all'); setSearch(''); setSort('newest');
  };

  const filterActiveCount = (datePreset !== 'all' ? 1 : 0) + (attemptsFilter !== 'all' ? 1 : 0) + (sort !== 'newest' ? 1 : 0);
  const hasActiveFilters  = filterActiveCount > 0 || search.trim() || statusFilter !== 'all';

  const renderItem = useCallback(({ item }) => (
    <LeadCard item={item}
      onNote={item => setNoteTarget(item)}
      onStatus={item => setStatusTarget(item)}
      onWhatsApp={handleWhatsApp}
    />
  ), [handleWhatsApp]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
      {showSearch ? (
        <View style={s.searchBar}>
          <Text style={s.searchIco}>🔍</Text>
          <TextInput ref={searchRef} style={s.searchInput}
            placeholder="Search name or phone…" placeholderTextColor={Colors.textMuted}
            value={search} onChangeText={setSearch} autoFocus />
          <TouchableOpacity onPress={() => { setSearch(''); setShowSearch(false); }}>
            <Text style={s.searchClear}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.hdr}>
          <View>
            <Text style={s.preLabel}>PIPELINE</Text>
            <Text style={s.heading}>My Leads</Text>
          </View>
          <View style={s.hdrRight}>
            <View style={s.totalPill}>
              <Text style={s.totalTxt}>{leads.length}</Text>
            </View>
            <TouchableOpacity style={s.iconBtn} onPress={() => setShowSearch(true)} activeOpacity={0.8}>
              <Text style={s.iconTxt}>🔍</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.iconBtn, filterActiveCount > 0 && s.iconBtnActive]}
              onPress={() => setShowFilter(true)} activeOpacity={0.8}>
              <Text style={[s.iconTxt, filterActiveCount > 0 && { color: Colors.primary }]}>⊘</Text>
              {filterActiveCount > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeTxt}>{filterActiveCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Status pills (always visible) ── */}
      <View style={s.statusWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statusRow}>
          <TouchableOpacity style={[s.pill, statusFilter === 'all' && s.pillActive]}
            onPress={() => setStatusFilter('all')} activeOpacity={0.8}>
            <Text style={[s.pillTxt, statusFilter === 'all' && s.pillTxtActive]}>
              All · {statusCounts.all}
            </Text>
          </TouchableOpacity>
          {Object.entries(STATUS).map(([key, st]) => {
            if (!statusCounts[key]) return null;
            const active = statusFilter === key;
            return (
              <TouchableOpacity key={key} activeOpacity={0.8}
                style={[s.pill, active && { backgroundColor: st.bg, borderColor: st.fg, borderWidth: 1.5 }]}
                onPress={() => setStatusFilter(active ? 'all' : key)}>
                <Text style={s.pillIcon}>{st.icon}</Text>
                <Text style={[s.pillTxt, active && { color: st.fg, fontWeight: '700' }]}>
                  {st.label} · {statusCounts[key]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Active filter summary ── */}
      {hasActiveFilters && (
        <View style={s.summaryBar}>
          <Text style={s.summaryTxt}>
            {displayLeads.length} of {leads.length} leads
            {filterActiveCount > 0 ? ` · ${filterActiveCount} filter${filterActiveCount !== 1 ? 's' : ''}` : ''}
          </Text>
          <TouchableOpacity onPress={clearAll}>
            <Text style={s.clearTxt}>Clear ✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── List ── */}
      {loading ? (
        <View style={s.loadWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={s.loadTxt}>Loading leads…</Text>
        </View>
      ) : (
        <FlatList
          data={displayLeads}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={7}
          initialNumToRender={12}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Text style={s.emptyIco}>🎯</Text>
              <Text style={s.emptyTit}>{leads.length === 0 ? 'No leads yet' : 'No leads match'}</Text>
              <Text style={s.emptyHnt}>
                {leads.length === 0 ? 'Your assigned leads will appear here' : 'Try adjusting your filters'}
              </Text>
              {hasActiveFilters && (
                <TouchableOpacity style={s.clearBtn} onPress={clearAll} activeOpacity={0.8}>
                  <Text style={s.clearBtnTxt}>Clear all filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* ── Sheets ── */}
      <StatusSheet lead={statusTarget} onClose={() => setStatusTarget(null)}
        onSelect={handleUpdateStatus} updating={updatingStatus} />
      <NoteSheet lead={noteTarget} onClose={() => setNoteTarget(null)} onSave={handleSaveNote} />
      <FilterSheet
        visible={showFilter}
        datePreset={datePreset}
        attemptsFilter={attemptsFilter}
        sort={sort}
        customFrom={customFrom}
        customTo={customTo}
        onDateChange={v => { setDatePreset(v); }}
        onAttemptsChange={setAttemptsFilter}
        onSortChange={setSort}
        onCustomDate={() => setShowCustomDate(true)}
        onClearAll={() => { setDatePreset('all'); setCustomFrom(null); setCustomTo(null); setAttemptsFilter('all'); setSort('newest'); }}
        onClose={() => setShowFilter(false)}
      />
      <CustomDateSheet visible={showCustomDate} from={customFrom} to={customTo}
        onApply={(f, t) => { setCustomFrom(f); setCustomTo(t); }}
        onClose={() => setShowCustomDate(false)} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const lc = StyleSheet.create({
  wrap:        { backgroundColor: '#fff', borderRadius: 16, marginBottom: 10, flexDirection: 'row', overflow: 'hidden', ...Shadows.card },
  bar:         { width: 4 },
  body:        { flex: 1, paddingHorizontal: 13, paddingVertical: 12 },
  topRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar:      { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarLetter:{ fontSize: 18, fontWeight: '800' },
  nameBlock:   { flex: 1, marginHorizontal: 10 },
  name:        { fontSize: 14, fontWeight: '700', color: Colors.text },
  phone:       { fontSize: 12, color: Colors.textSec, marginTop: 2 },
  badge:       { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, gap: 3, flexShrink: 0, maxWidth: 130, borderWidth: 1 },
  badgeIcon:   { fontSize: 11 },
  badgeLabel:  { fontSize: 10, fontWeight: '700', flexShrink: 1 },
  callRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  callInfo:    { flex: 1, fontSize: 12, color: Colors.textSec },
  attBadge:    { backgroundColor: '#EFF6FF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  attTxt:      { fontSize: 10, fontWeight: '700', color: '#1A6BFF' },
  noCall:      { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  note:        { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic', marginBottom: 4 },
  fuWrap:      { marginBottom: 4, alignSelf: 'flex-start' },
  fuTxt:       { fontSize: 11, fontWeight: '600', color: '#7C3AED', backgroundColor: '#EDE9FE', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  actions:     { flexDirection: 'row', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.divider },
  btn:         { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnCall:     { backgroundColor: Colors.primary },
  btnCallTxt:  { color: '#fff', fontSize: 12, fontWeight: '700' },
  btnGhost:    { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  btnGhostTxt: { color: Colors.textSec, fontSize: 12, fontWeight: '600' },
});

const sh = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheet:     { backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 12 },
  handle:    { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  title:     { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  sub:       { fontSize: 13, color: Colors.textSec, marginBottom: 16 },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  opt:       { width: '30%', borderRadius: 14, padding: 12, alignItems: 'center', position: 'relative', borderWidth: 1.5, borderColor: 'transparent' },
  optIcon:   { fontSize: 22, marginBottom: 5 },
  optLabel:  { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  check:     { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
  input:     { backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 14, color: Colors.text, fontSize: 14, minHeight: 110 },
  charCnt:   { color: Colors.textMuted, fontSize: 11, textAlign: 'right', marginTop: 4, marginBottom: 16 },
  btnRow:    { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center' },
  cancelTxt: { color: Colors.textSec, fontSize: 14, fontWeight: '600' },
  saveBtn:   { flex: 1, backgroundColor: Colors.primary, borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center' },
  saveTxt:   { color: '#fff', fontSize: 14, fontWeight: '700' },
});

const cds = StyleSheet.create({
  overlay:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.5)' },
  sheet:      { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12 },
  handle:     { width: 38, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  title:      { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  segRow:     { flexDirection: 'row', gap: 10, marginBottom: 12 },
  seg:        { flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, padding: 12, backgroundColor: Colors.bg },
  segActive:  { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  segLbl:     { fontSize: 9, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  segVal:     { fontSize: 15, fontWeight: '700', color: Colors.text },
  rangeSummary: { backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12, alignSelf: 'center', borderWidth: 1, borderColor: Colors.primary },
  rangeText:  { fontSize: 13, fontWeight: '700', color: Colors.primary },
  calWrap:    { borderRadius: 14, backgroundColor: Colors.bg, padding: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  applyBtn:   { backgroundColor: Colors.primary, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  applyTxt:   { fontSize: 15, fontWeight: '700', color: '#fff' },
  clearBtn:   { height: 40, alignItems: 'center', justifyContent: 'center' },
  clearTxt:   { fontSize: 13, fontWeight: '600', color: Colors.textSec },
});

const fs = StyleSheet.create({
  overlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.5)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '85%', backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12 },
  handle:      { width: 38, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  hdr:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title:       { fontSize: 18, fontWeight: '800', color: Colors.text },
  clearAllBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FEE2E2', borderRadius: 20 },
  clearAllTxt: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  sectionLabel:{ fontSize: 10, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },
  chipGroup:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip:        { height: 34, justifyContent: 'center', borderRadius: 999, paddingHorizontal: 13, backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border },
  chipActive:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipCustom:  { backgroundColor: '#EDE9FE', borderColor: '#7C3AED' },
  chipTxt:     { fontSize: 12, fontWeight: '600', color: Colors.textSec },
  chipTxtActive:  { color: '#fff', fontWeight: '700' },
  chipTxtCustom:  { color: '#7C3AED', fontWeight: '700' },
  sortGroup:   { marginBottom: 20 },
  sortRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  sortRowActive:{ },
  sortLabel:   { fontSize: 14, fontWeight: '500', color: Colors.textSec },
  sortLabelActive: { color: Colors.primary, fontWeight: '700' },
  sortCheck:   { fontSize: 15, fontWeight: '700', color: Colors.primary },
  doneBtn:     { backgroundColor: Colors.primary, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  doneTxt:     { fontSize: 15, fontWeight: '700', color: '#fff' },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  hdr:       { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 18 : 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: Colors.divider },
  preLabel:  { fontSize: 10, fontWeight: '800', color: Colors.primary, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 },
  heading:   { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  hdrRight:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  totalPill: { backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  totalTxt:  { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  iconBtn:   { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', ...Shadows.sm },
  iconBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  iconTxt:   { fontSize: 16 },
  badge:     { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  badgeTxt:  { fontSize: 8, fontWeight: '800', color: '#fff' },

  searchBar:   { margin: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 13, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 44, ...Shadows.sm },
  searchIco:   { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  searchClear: { fontSize: 14, color: Colors.textMuted, padding: 4 },

  statusWrap:  { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.divider },
  statusRow:   { paddingHorizontal: 14, paddingVertical: 9, gap: 7 },
  pill:        { height: 34, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 11, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  pillActive:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillIcon:    { fontSize: 12 },
  pillTxt:     { fontSize: 12, fontWeight: '500', color: Colors.textSec },
  pillTxtActive: { color: '#fff', fontWeight: '700' },

  summaryBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.primaryLight },
  summaryTxt: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  clearTxt:   { fontSize: 11, color: Colors.primary, fontWeight: '700' },

  list:      { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 40 },
  loadWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  loadTxt:   { marginTop: 12, color: Colors.textMuted, fontSize: 14 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIco:  { fontSize: 52, marginBottom: 14 },
  emptyTit:  { fontSize: 17, fontWeight: '700', color: Colors.textSec },
  emptyHnt:  { fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 19 },
  clearBtn:  { marginTop: 20, paddingHorizontal: 24, height: 42, borderRadius: 24, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  clearBtnTxt: { fontSize: 13, fontWeight: '700', color: Colors.primary },
});
