import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, TextInput, Modal, RefreshControl, StatusBar, ScrollView,
} from 'react-native';
import api from '../lib/api';
import { C } from '../theme';
import { Colors } from '../theme/colors';
import MiniCalendar from '../components/MiniCalendar';

const STATUS = {
  new:            { fg: '#2563EB', bg: '#DBEAFE', label: 'New' },
  contacted:      { fg: '#7C3AED', bg: '#EDE9FE', label: 'Contacted' },
  interested:     { fg: '#D97706', bg: '#FEF3C7', label: 'Interested' },
  not_interested: { fg: '#DC2626', bg: '#FEE2E2', label: 'Not Interested' },
  converted:      { fg: '#16A34A', bg: '#DCFCE7', label: 'Converted' },
  lost:           { fg: '#6B7280', bg: '#F3F4F6', label: 'Lost' },
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

export default function LeadsScreen() {
  const [leads, setLeads]           = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [noteModal, setNoteModal]   = useState(null);
  const [noteText, setNoteText]     = useState('');
  const [saving, setSaving]         = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter]     = useState('all');
  const [customFrom, setCustomFrom]     = useState(null);
  const [customTo, setCustomTo]         = useState(null);

  // Filter sheet state
  const [showFilter, setShowFilter]         = useState(false);
  const [pendingStatus, setPendingStatus]   = useState('all');
  const [pendingDate, setPendingDate]       = useState('all');
  const [pendingFrom, setPendingFrom]       = useState(null);
  const [pendingTo, setPendingTo]           = useState(null);
  const [calTarget, setCalTarget]           = useState(null);

  const fetchLeads = async () => {
    try {
      const res = await api.get('/api/leads/assigned');
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

  const displayLeads = leads.filter((l) => {
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

  const activeCount = [statusFilter !== 'all', dateFilter !== 'all'].filter(Boolean).length;
  const pendingActiveCount = [pendingStatus !== 'all', pendingDate !== 'all'].filter(Boolean).length;

  const openFilter = () => {
    setPendingStatus(statusFilter);
    setPendingDate(dateFilter);
    setPendingFrom(customFrom);
    setPendingTo(customTo);
    setCalTarget(null);
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

  const renderItem = ({ item }) => {
    const st = STATUS[item.status] || { fg: C.textMuted, bg: C.bg, label: item.status };
    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={[s.initials, { backgroundColor: st.bg }]}>
            <Text style={[s.initialsText, { color: st.fg }]}>
              {item.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.leadName}>{item.name}</Text>
            <Text style={s.leadPhone}>{item.phone}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: st.bg }]}>
            <Text style={[s.badgeText, { color: st.fg }]}>{st.label}</Text>
          </View>
        </View>

        {item.followUpDate && (
          <View style={s.followUpRow}>
            <Text style={s.followUpLabel}>Follow-up</Text>
            <Text style={s.followUpDate}>{new Date(item.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
          </View>
        )}

        <View style={s.cardFooter}>
          <View style={s.notesWrap}>
            <Text style={s.notesDot}>●</Text>
            <Text style={s.notesCount}>{item.notes?.length || 0} note{item.notes?.length !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => { setNoteModal(item); setNoteText(''); }}>
            <Text style={s.addBtnText}>+ Add Note</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={s.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.heading}>My Leads</Text>
        </View>
        <View style={s.topBarRight}>
          <View style={s.countBadge}>
            <Text style={s.countText}>{leads.length}</Text>
          </View>
          <TouchableOpacity
            onPress={openFilter}
            style={[s.filterBtn, activeCount > 0 && s.filterBtnActive]}
          >
            <Text style={[s.filterBtnText, activeCount > 0 && s.filterBtnTextActive]}>
              ⊞{activeCount > 0 ? ` ${activeCount}` : ' Filter'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={displayLeads}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyIcon}>🎯</Text>
            <Text style={s.emptyText}>No leads found</Text>
            {activeCount > 0 && (
              <TouchableOpacity
                style={s.clearFilterBtn}
                onPress={() => { setStatusFilter('all'); setDateFilter('all'); setCustomFrom(null); setCustomTo(null); }}
              >
                <Text style={s.clearFilterText}>Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Note Modal */}
      <Modal visible={!!noteModal} transparent animationType="slide" statusBarTranslucent>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Add Note</Text>
            <Text style={s.sheetSub}>{noteModal?.name}</Text>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              multiline
              numberOfLines={5}
              placeholder="Write your note here…"
              placeholderTextColor={C.textMuted}
              style={s.noteInput}
              autoFocus
              maxLength={500}
            />
            <Text style={s.charCount}>{noteText.length}/500</Text>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setNoteModal(null); setNoteText(''); }} disabled={saving}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, (!noteText.trim() || saving) && s.saveBtnDisabled]}
                onPress={handleAddNote}
                disabled={!noteText.trim() || saving}
              >
                <Text style={s.saveText}>{saving ? 'Saving…' : 'Save Note'}</Text>
              </TouchableOpacity>
            </View>
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
              <Text style={fs.title}>Filter Leads</Text>
              <TouchableOpacity onPress={resetFilter} style={fs.resetBtn}>
                <Text style={fs.resetText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* STATUS */}
              <Text style={fs.sectionLabel}>STATUS</Text>
              <View style={fs.chipGroup}>
                {['all', ...Object.keys(STATUS)].map((key) => {
                  const cfg = STATUS[key] || { label: 'All Status', fg: '#64748B', bg: '#F1F5F9' };
                  const active = pendingStatus === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[fs.chip, active && (key === 'all' ? fs.chipActive : { backgroundColor: cfg.bg, borderColor: cfg.fg })]}
                      onPress={() => setPendingStatus(key)}
                    >
                      <Text style={[fs.chipText, active && (key === 'all' ? fs.chipTextActive : { color: cfg.fg, fontWeight: '700' })]}>
                        {key === 'all' ? 'All Status' : cfg.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* DATE RANGE */}
              <Text style={fs.sectionLabel}>DATE RANGE</Text>
              <View style={fs.chipGroup}>
                {DATE_OPTIONS.map((df) => (
                  <TouchableOpacity
                    key={df.key}
                    style={[fs.chip, pendingDate === df.key && fs.chipActive]}
                    onPress={() => { setPendingDate(df.key); if (df.key !== 'custom') setCalTarget(null); }}
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
  root:       { flex: 1, backgroundColor: C.bg },
  topBar:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  heading:    { color: C.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  topBarRight:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  countBadge: { backgroundColor: C.primaryLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countText:  { color: C.primary, fontSize: 13, fontWeight: '700' },
  filterBtn:  { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  filterBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  filterBtnText:   { fontSize: 12, fontWeight: '600', color: '#64748B' },
  filterBtnTextActive: { color: Colors.primary },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  card:       { backgroundColor: C.surface, borderRadius: 12, padding: 12, marginBottom: 12, shadowColor: C.shadow, elevation: 2 },
  cardTop:    { flexDirection: 'row', alignItems: 'center' },
  initials:   { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  initialsText: { fontSize: 16, fontWeight: '700' },
  leadName:   { color: C.text, fontSize: 13, fontWeight: '700' },
  leadPhone:  { color: C.textSec, fontSize: 11, marginTop: 1 },
  badge:      { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  badgeText:  { fontSize: 11, fontWeight: '700' },

  followUpRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  followUpLabel:{ color: C.textMuted, fontSize: 11, fontWeight: '500' },
  followUpDate: { color: C.rejected, fontSize: 12, fontWeight: '600' },

  cardFooter:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  notesWrap:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  notesDot:     { color: C.textMuted, fontSize: 8 },
  notesCount:   { color: C.textMuted, fontSize: 12 },
  addBtn:       { backgroundColor: C.primaryLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  addBtnText:   { color: C.primary, fontSize: 12, fontWeight: '700' },

  emptyWrap:      { alignItems: 'center', paddingTop: 60 },
  emptyIcon:      { fontSize: 36, marginBottom: 10 },
  emptyText:      { fontSize: 15, fontWeight: '600', color: C.textMuted },
  clearFilterBtn: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.primaryLight },
  clearFilterText:{ fontSize: 13, fontWeight: '600', color: Colors.primary },

  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  sheetHandle:{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  sheetSub:   { color: C.textSec, fontSize: 13, marginBottom: 16 },
  noteInput:  { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, color: C.text, fontSize: 14, textAlignVertical: 'top', minHeight: 110 },
  charCount:  { color: C.textMuted, fontSize: 11, textAlign: 'right', marginTop: 4, marginBottom: 16 },
  modalBtns:  { flexDirection: 'row', gap: 10 },
  cancelBtn:  { flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancelText: { color: C.textSec, fontSize: 14, fontWeight: '600' },
  saveBtn:    { flex: 1, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.5 },
  saveText:   { color: '#fff', fontSize: 14, fontWeight: '700' },
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
  dateBtnActive:{ borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  dateBtnLabel:{ fontSize: 10, fontWeight: '700', color: '#94A3B8', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateBtnValue:{ fontSize: 14, fontWeight: '700', color: '#0F172A' },
  dateSep:     { color: '#94A3B8', fontSize: 16 },
  calWrap:     { borderRadius: 14, backgroundColor: '#F8F9FB', padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  footer:      { paddingTop: 12, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  applyBtn:    { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  applyText:   { fontSize: 15, fontWeight: '700', color: '#fff' },
});
