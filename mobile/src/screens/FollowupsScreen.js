import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, StatusBar, Linking, Alert, Modal, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';
import ContactAvatar from '../components/ContactAvatar';
import TagChip from '../components/TagChip';
import MiniCalendar from '../components/MiniCalendar';
import CallHistoryModal from '../components/CallHistoryModal';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/shadows';
import { getPendingFollowUps, saveNote, getNote } from '../utils/callNotes';
import { getCached, setCached } from '../utils/cache';

const FOLLOWUP_LEADS_CACHE_KEY = 'followup_leads';

const RESCHEDULE_HOUR_SLOTS = [
  { label: '8 AM', h: 8 }, { label: '9 AM', h: 9 }, { label: '10 AM', h: 10 },
  { label: '11 AM', h: 11 }, { label: '12 PM', h: 12 }, { label: '1 PM', h: 13 },
  { label: '2 PM', h: 14 }, { label: '3 PM', h: 15 }, { label: '4 PM', h: 16 },
  { label: '5 PM', h: 17 }, { label: '6 PM', h: 18 }, { label: '7 PM', h: 19 },
  { label: '8 PM', h: 20 },
];

function RescheduleModal({ visible, item, onSave, onClose }) {
  const [mode, setMode]     = useState('quick'); // 'quick' | 'custom'
  const [selDate, setSelDate] = useState(null);
  const [selHour, setSelHour] = useState(10);

  const quickOptions = [
    { label: 'Today',     getDate: () => { const d = new Date(); d.setHours(selHour, 0, 0, 0); return d; } },
    { label: 'Tomorrow',  getDate: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(selHour, 0, 0, 0); return d; } },
    { label: 'Next Week', getDate: () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(selHour, 0, 0, 0); return d; } },
  ];

  const handleConfirm = () => {
    if (!selDate) return;
    const d = new Date(selDate);
    d.setHours(selHour, 0, 0, 0);
    onSave(d.toISOString());
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={rs.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={rs.sheet}>
          <View style={rs.handle} />
          <Text style={rs.title}>Reschedule Follow-up</Text>
          {item && (
            <Text style={rs.sub}>{item.contactName || item.contactNumber} · {item.contactNumber}</Text>
          )}

          {/* Mode tabs */}
          <View style={rs.modeTabs}>
            <TouchableOpacity
              style={[rs.modeTab, mode === 'quick' && rs.modeTabActive]}
              onPress={() => setMode('quick')}
            >
              <Text style={[rs.modeTabText, mode === 'quick' && rs.modeTabTextActive]}>Quick</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[rs.modeTab, mode === 'custom' && rs.modeTabActive]}
              onPress={() => setMode('custom')}
            >
              <Text style={[rs.modeTabText, mode === 'custom' && rs.modeTabTextActive]}>Custom Date</Text>
            </TouchableOpacity>
          </View>

          {mode === 'quick' && (
            <View style={rs.quickRow}>
              {quickOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  style={rs.quickBtn}
                  onPress={() => { setSelDate(opt.getDate()); }}
                >
                  <Text style={rs.quickBtnText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {mode === 'custom' && (
            <View style={rs.calWrap}>
              <MiniCalendar
                value={selDate}
                onChange={(d) => setSelDate(d)}
                minDate={new Date()}
              />
            </View>
          )}

          {/* Time picker */}
          <Text style={rs.timeLabel}>Time</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={rs.hourRow}>
            {RESCHEDULE_HOUR_SLOTS.map((slot) => (
              <TouchableOpacity
                key={slot.h}
                style={[rs.hourSlot, selHour === slot.h && rs.hourSlotActive]}
                onPress={() => setSelHour(slot.h)}
              >
                <Text style={[rs.hourText, selHour === slot.h && rs.hourTextActive]}>
                  {slot.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {selDate && (
            <Text style={rs.preview}>
              📅 {new Date(new Date(selDate).setHours(selHour, 0, 0, 0)).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </Text>
          )}

          <TouchableOpacity
            style={[rs.confirmBtn, !selDate && { opacity: 0.5 }]}
            onPress={handleConfirm}
            disabled={!selDate}
          >
            <Text style={rs.confirmText}>Confirm Reschedule</Text>
          </TouchableOpacity>
          <View style={{ height: 20 }} />
        </View>
      </View>
    </Modal>
  );
}

const BUCKET_FILTERS = ['All', 'Today', 'Upcoming', 'Overdue'];

const fmtShortDate = (d) => d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Select';
const SORT_OPTIONS   = [
  { key: 'soonest', label: 'Soonest first' },
  { key: 'latest',  label: 'Latest first'  },
  { key: 'name',    label: 'By name'        },
];

function dateBucket(dateStr) {
  if (!dateStr) return 'upcoming';
  const d     = new Date(dateStr);
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fu    = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (fu < today) return 'overdue';
  if (fu.getTime() === today.getTime()) return 'today';
  return 'upcoming';
}

function BucketBadge({ bucket }) {
  const map = {
    today:    { label: 'Today',    fg: Colors.primary, bg: Colors.primaryLight },
    upcoming: { label: 'Upcoming', fg: '#64748B',      bg: '#F1F5F9' },
    overdue:  { label: 'Overdue',  fg: Colors.danger,  bg: Colors.dangerBg },
  };
  const s = map[bucket] || map.upcoming;
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: s.fg }}>{s.label}</Text>
    </View>
  );
}

const FollowUpCard = memo(function FollowUpCard({ item, onDone, onReschedule, onHistory, onNote }) {
  const bucket = dateBucket(item.followUp?.date);
  const borderColor = bucket === 'overdue' ? Colors.danger : bucket === 'today' ? Colors.primary : '#E2E8F0';

  const formatDate = (ds) => {
    if (!ds) return '';
    const d = new Date(ds);
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[s.card, { borderLeftColor: borderColor, borderLeftWidth: 4 }]}>
      <View style={s.cardTop}>
        <ContactAvatar name={item.contactName} number={item.contactNumber} size={42} />
        <View style={s.cardMid}>
          <Text style={s.cardName}>{item.contactName || item.contactNumber || 'Unknown'}</Text>
          <Text style={s.cardNumber}>{item.contactNumber}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Text style={s.dateText}>📅 {formatDate(item.followUp?.date)}</Text>
            <BucketBadge bucket={bucket} />
          </View>
        </View>
      </View>

      {item.note ? (
        <View style={s.noteRow}>
          <Text style={s.noteText} numberOfLines={2}>📝 {item.note}</Text>
        </View>
      ) : null}

      {item.tags?.length > 0 && (
        <View style={s.tagsRow}>
          {item.tags.map((t) => <TagChip key={t} label={t} selected size="sm" />)}
        </View>
      )}

      <View style={s.actions}>
        <TouchableOpacity style={s.actionCall} onPress={() => Linking.openURL(`tel:${item.contactNumber}`).catch(() => {})}>
          <Text style={s.actionCallText}>📞 Call Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => onReschedule?.(item)}>
          <Text style={s.actionBtnText}>Reschedule</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => onNote?.(item)}>
          <Text style={s.actionBtnText}>📝 Note</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => onHistory?.(item)}>
          <Text style={s.actionBtnText}>🕘 History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, { backgroundColor: Colors.successBg, borderColor: Colors.success }]} onPress={() => onDone?.(item)}>
          <Text style={[s.actionBtnText, { color: Colors.success }]}>Done ✓</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default function FollowupsScreen({ onAddNote }) {
  const [items, setItems]         = useState([]);
  const [leads, setLeads]         = useState([]);
  const [filter, setFilter]       = useState('All');
  const [sort, setSort]           = useState('soonest');
  const [showSort, setShowSort]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rescheduleItem, setRescheduleItem] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);

  // Date range filter
  const [dateFrom, setDateFrom]           = useState(null);
  const [dateTo, setDateTo]               = useState(null);
  const [showDateRange, setShowDateRange] = useState(false);
  const [pendingFrom, setPendingFrom]     = useState(null);
  const [pendingTo, setPendingTo]         = useState(null);
  const [calDateSeg, setCalDateSeg]       = useState('from');

  const load = async () => {
    // Load local follow-ups (from call notes)
    const local = await getPendingFollowUps();

    // Load leads with followUpDate
    try {
      const res = await api.get('/api/leads/assigned');
      const leadItems = (res.data.data || [])
        .filter((l) => l.followUpDate)
        .map((l) => ({
          key:           `lead_${l._id}`,
          contactName:   l.name,
          contactNumber: l.phone,
          followUp:      { date: l.followUpDate, done: false },
          note:          l.notes?.[l.notes.length - 1]?.text || '',
          tags:          [],
          isLead:        true,
          leadId:        l._id,
        }));
      setLeads(leadItems);
      setCached(FOLLOWUP_LEADS_CACHE_KEY, leadItems);
    } catch {}

    setItems(local.map((f) => ({
      key:           f.key,
      contactName:   f.contactName || '',
      contactNumber: f.contactNumber || '',
      followUp:      f.followUp,
      note:          f.note,
      tags:          f.tags || [],
    })));
  };

  useEffect(() => {
    // Paint instantly from the last cached lead list instead of flashing the
    // "No follow-ups yet" empty state while the network round trip is in flight.
    getCached(FOLLOWUP_LEADS_CACHE_KEY).then((cached) => {
      if (cached) setLeads(cached);
    });
    load();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  const allItems = [...items, ...leads];

  const displayed = allItems
    .filter((item) => {
      if (filter !== 'All' && dateBucket(item.followUp?.date) !== filter.toLowerCase()) return false;
      if (dateFrom && new Date(item.followUp?.date) < dateFrom) return false;
      if (dateTo) {
        const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
        if (new Date(item.followUp?.date) > end) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === 'latest') return new Date(b.followUp?.date || 0) - new Date(a.followUp?.date || 0);
      if (sort === 'name')   return (a.contactName || '').localeCompare(b.contactName || '');
      return new Date(a.followUp?.date || 0) - new Date(b.followUp?.date || 0);
    });

  const counts = {
    All:      allItems.length,
    Today:    allItems.filter((i) => dateBucket(i.followUp?.date) === 'today').length,
    Upcoming: allItems.filter((i) => dateBucket(i.followUp?.date) === 'upcoming').length,
    Overdue:  allItems.filter((i) => dateBucket(i.followUp?.date) === 'overdue').length,
  };

  const handleDone = useCallback(async (item) => {
    Alert.alert('Mark as Done?', 'This follow-up will be removed from the list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Done',
        onPress: async () => {
          if (item.isLead) {
            try { await api.put(`/api/leads/${item.leadId}`, { followUpDate: null }); } catch {}
          } else {
            // Use the original key stored in item.key to mark done directly in AsyncStorage
            const existing = await AsyncStorage.getItem(item.key);
            if (existing) {
              const parsed = JSON.parse(existing);
              parsed.followUp = { ...parsed.followUp, done: true };
              await AsyncStorage.setItem(item.key, JSON.stringify(parsed));
            }
          }
          load();
        },
      },
    ]);
  }, [load]);

  const handleReschedule = useCallback(async (item, newDateIso) => {
    try {
      if (item.isLead) {
        await api.put(`/api/leads/${item.leadId}`, { followUpDate: newDateIso });
      } else {
        const existing = await AsyncStorage.getItem(item.key);
        if (existing) {
          const parsed = JSON.parse(existing);
          parsed.followUp = { ...parsed.followUp, date: newDateIso, done: false };
          await AsyncStorage.setItem(item.key, JSON.stringify(parsed));
        }
      }
    } catch {}
    setRescheduleItem(null);
    load();
  }, []);

  const renderFollowUp = useCallback(({ item }) => (
    <FollowUpCard
      item={item}
      onDone={handleDone}
      onReschedule={(i) => setRescheduleItem(i)}
      onHistory={(i) => setHistoryTarget({ contactNumber: i.contactNumber, contactName: i.contactName })}
      onNote={(i) => onAddNote?.(i)}
    />
  ), [handleDone, onAddNote]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={s.header}>
        <View>
          <Text style={s.preLabel}>REMINDERS</Text>
          <Text style={s.heading}>Follow-ups</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[s.sortBtn, (dateFrom || dateTo) && { backgroundColor: Colors.primaryLight, borderColor: Colors.primary }]}
            onPress={() => {
              setPendingFrom(dateFrom);
              setPendingTo(dateTo);
              setCalDateSeg('from');
              setShowDateRange(true);
            }}
          >
            <Text style={{ fontSize: 13, color: (dateFrom || dateTo) ? Colors.primary : Colors.textSec, fontWeight: '600' }}>
              📅 {dateFrom || dateTo ? 'Filtered' : 'Date'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.sortBtn, showSort && { backgroundColor: Colors.primaryLight, borderColor: Colors.primary }]}
            onPress={() => setShowSort(!showSort)}
          >
            <Text style={{ fontSize: 13, color: showSort ? Colors.primary : Colors.textSec, fontWeight: '600' }}>⇅ Sort</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary banner */}
      <View style={s.summaryBanner}>
        {[
          { label: 'Today',    count: counts.Today,    color: Colors.primary, bg: Colors.primaryLight },
          { label: 'Upcoming', count: counts.Upcoming, color: Colors.textSec, bg: Colors.bg },
          { label: 'Overdue',  count: counts.Overdue,  color: Colors.danger,  bg: Colors.dangerBg },
        ].map(({ label, count, color, bg }) => (
          <TouchableOpacity
            key={label}
            style={[s.summaryItem, filter === label && { backgroundColor: bg }]}
            onPress={() => setFilter(filter === label ? 'All' : label)}
          >
            <Text style={[s.summaryCount, { color }]}>{count}</Text>
            <Text style={s.summaryLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {showSort && (
        <View style={s.sortDrop}>
          {SORT_OPTIONS.map((o) => (
            <TouchableOpacity key={o.key} style={[s.sortItem, sort === o.key && s.sortItemActive]}
              onPress={() => { setSort(o.key); setShowSort(false); }}>
              <Text style={[s.sortItemText, sort === o.key && { color: Colors.primary, fontWeight: '700' }]}>{o.label}</Text>
              {sort === o.key && <Text style={{ color: Colors.primary }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Bucket filter chips */}
      <View style={s.chipRow}>
        {BUCKET_FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[s.chip, filter === f && s.chipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.chipText, filter === f && s.chipTextActive]}>{f}</Text>
            {counts[f] > 0 && (
              <View style={[s.chipBadge, { backgroundColor: filter === f ? '#fff' : '#E2E8F0' }]}>
                <Text style={[s.chipBadgeText, { color: filter === f ? Colors.primary : '#64748B' }]}>{counts[f]}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={displayed}
        keyExtractor={(item) => item.key}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={renderFollowUp}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyIcon}>📅</Text>
            <Text style={s.emptyText}>No follow-ups yet</Text>
            <Text style={s.emptyHint}>Swipe right on a call or tap "Follow" to add one</Text>
          </View>
        }
      />

      <RescheduleModal
        visible={!!rescheduleItem}
        item={rescheduleItem}
        onSave={(newDate) => handleReschedule(rescheduleItem, newDate)}
        onClose={() => setRescheduleItem(null)}
      />

      <CallHistoryModal
        visible={!!historyTarget}
        contactNumber={historyTarget?.contactNumber}
        contactName={historyTarget?.contactName}
        onClose={() => setHistoryTarget(null)}
      />

      {/* Date Range Sheet */}
      <Modal visible={showDateRange} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShowDateRange(false)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowDateRange(false)} />
          <View style={dr.sheet}>
            <View style={dr.handle} />
            <Text style={dr.title}>Filter by Date Range</Text>

            {/* From / To segment buttons */}
            <View style={dr.segRow}>
              <TouchableOpacity
                style={[dr.segBtn, calDateSeg === 'from' && dr.segBtnActive]}
                onPress={() => setCalDateSeg('from')}
              >
                <Text style={dr.segLabel}>FROM</Text>
                <Text style={[dr.segValue, pendingFrom && { color: Colors.primary }]}>{fmtShortDate(pendingFrom)}</Text>
              </TouchableOpacity>
              <Text style={dr.segArrow}>→</Text>
              <TouchableOpacity
                style={[dr.segBtn, calDateSeg === 'to' && dr.segBtnActive]}
                onPress={() => setCalDateSeg('to')}
              >
                <Text style={dr.segLabel}>TO</Text>
                <Text style={[dr.segValue, pendingTo && { color: Colors.primary }]}>{fmtShortDate(pendingTo)}</Text>
              </TouchableOpacity>
            </View>

            {pendingFrom && pendingTo && (
              <View style={dr.summaryChip}>
                <Text style={dr.summaryText}>📅 {fmtShortDate(pendingFrom)} → {fmtShortDate(pendingTo)}</Text>
              </View>
            )}

            <View style={dr.calWrap}>
              <MiniCalendar
                value={calDateSeg === 'from' ? pendingFrom : pendingTo}
                onChange={(d) => {
                  if (calDateSeg === 'from') {
                    setPendingFrom(d);
                    if (pendingTo && d > pendingTo) setPendingTo(null);
                    setCalDateSeg('to');
                  } else {
                    setPendingTo(d);
                    if (pendingFrom && d < pendingFrom) setPendingFrom(null);
                  }
                }}
                minDate={calDateSeg === 'to' && pendingFrom ? pendingFrom : undefined}
              />
            </View>

            <TouchableOpacity
              style={[dr.applyBtn, !pendingFrom && { opacity: 0.5 }]}
              onPress={() => {
                setDateFrom(pendingFrom);
                setDateTo(pendingTo);
                setShowDateRange(false);
              }}
              disabled={!pendingFrom}
            >
              <Text style={dr.applyText}>Apply Range</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={dr.clearBtn}
              onPress={() => {
                setDateFrom(null); setDateTo(null);
                setPendingFrom(null); setPendingTo(null);
                setShowDateRange(false);
              }}
            >
              <Text style={dr.clearText}>Clear Date Filter</Text>
            </TouchableOpacity>
            <View style={{ height: 24 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  header:  { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.divider },
  preLabel:{ fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  heading: { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },

  summaryBanner: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryItem:  { flex: 1, alignItems: 'center', paddingVertical: 12, borderRightWidth: 1, borderRightColor: Colors.divider },
  summaryCount: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },

  chipRow:      { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, gap: 6, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.divider },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border },
  chipActive:   { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:     { fontSize: 12, fontWeight: '600', color: Colors.textSec },
  chipTextActive:{ color: '#fff' },
  chipBadge:    { borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  chipBadgeText:{ fontSize: 10, fontWeight: '700' },

  list:  { paddingHorizontal: 16, paddingBottom: 40 },

  card:         { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden', ...Shadows.card },
  cardTop:      { flexDirection: 'row', alignItems: 'center', padding: 12 },
  cardMid:      { flex: 1, marginLeft: 12 },
  cardName:     { fontSize: 14, fontWeight: '700', color: Colors.text },
  cardNumber:   { fontSize: 11, color: Colors.textSec, marginTop: 1 },
  dateText:     { fontSize: 12, color: Colors.textSec },

  noteRow:      { borderTopWidth: 1, borderTopColor: Colors.divider, marginHorizontal: 14, paddingVertical: 8 },
  noteText:     { fontSize: 13, color: Colors.textSec, lineHeight: 18 },
  tagsRow:      { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, paddingBottom: 8 },

  actions:      { flexDirection: 'row', gap: 6, padding: 10, borderTopWidth: 1, borderTopColor: Colors.divider },
  actionCall:   { flex: 1, backgroundColor: Colors.primary, borderRadius: 9, height: 36, alignItems: 'center', justifyContent: 'center' },
  actionCallText:{ color: '#fff', fontSize: 12, fontWeight: '700' },
  actionBtn:    { flex: 1, backgroundColor: '#fff', borderRadius: 9, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  actionBtnText:{ color: Colors.textSec, fontSize: 12, fontWeight: '600' },

  emptyWrap:  { alignItems: 'center', paddingTop: 80 },
  emptyIcon:  { fontSize: 48, marginBottom: 14 },
  emptyText:  { fontSize: 16, fontWeight: '700', color: Colors.textSec },
  emptyHint:  { fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center', paddingHorizontal: 32 },

  sortBtn:       { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border },
  sortDrop:      { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, overflow: 'hidden', ...Shadows.md },
  sortItem:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  sortItemActive:{ backgroundColor: Colors.primaryLight },
  sortItemText:  { fontSize: 14, color: Colors.textSec },
});

const dr = StyleSheet.create({
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

const rs = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 12 },
  handle:      { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  title:       { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  sub:         { fontSize: 13, color: Colors.textSec, marginBottom: 16 },

  modeTabs:        { flexDirection: 'row', gap: 10, marginBottom: 16 },
  modeTab:         { flex: 1, borderRadius: 12, paddingVertical: 9, alignItems: 'center', backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  modeTabActive:   { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  modeTabText:     { fontSize: 13, fontWeight: '600', color: Colors.textSec },
  modeTabTextActive: { color: Colors.primary, fontWeight: '700' },

  quickRow:    { flexDirection: 'row', gap: 8, marginBottom: 16 },
  quickBtn:    { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary },
  quickBtnText:{ fontSize: 13, fontWeight: '700', color: Colors.primary },

  calWrap:     { borderRadius: 14, backgroundColor: Colors.bg, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },

  timeLabel:   { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  hourRow:     { gap: 8, paddingBottom: 16 },
  hourSlot:    { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  hourSlotActive:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  hourText:        { fontSize: 12, fontWeight: '600', color: '#334155' },
  hourTextActive:  { color: '#fff', fontWeight: '700' },

  preview:     { fontSize: 13, fontWeight: '600', color: Colors.primary, textAlign: 'center', marginBottom: 14, marginTop: 4 },
  confirmBtn:  { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
