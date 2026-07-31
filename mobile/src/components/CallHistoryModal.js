import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import api from '../lib/api';
import { Colors } from '../theme/colors';

const TYPE_CFG = {
  incoming: { color: Colors.incoming, icon: '↙', label: 'Incoming' },
  outgoing: { color: Colors.outgoing, icon: '↗', label: 'Outgoing' },
  missed:   { color: Colors.missed,   icon: '↙', label: 'Missed'   },
  rejected: { color: Colors.rejected, icon: '✕', label: 'Rejected' },
};

const STATUS_CFG = {
  interested:     { label: 'Interested',     color: '#16A34A' },
  contacted:      { label: 'Contacted',      color: '#2563EB' },
  not_connected:  { label: 'Not Connected',  color: '#64748B' },
  not_interested: { label: 'Not Interested', color: '#DC2626' },
  follow_up:      { label: 'Follow Up',      color: '#7C3AED' },
  booking_done:   { label: 'Booking Done',   color: '#059669' },
  converted:      { label: 'Converted',      color: '#059669' },
  lost:           { label: 'Lost',           color: '#6B7280' },
};

function fmtTs(ts) {
  return new Date(ts).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function fmtDur(sec) {
  if (!sec || sec < 1) return null;
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// Shows every past call to a single number, each with its own remarks/status — not just the
// single most-recent lastCallNote a Lead stores. Opened from the "History" action on
// CallCard/LeadCard/FollowUpCard.
export default function CallHistoryModal({ visible, contactNumber, contactName, onClose }) {
  const [loading, setLoading] = useState(false);
  const [calls,   setCalls]   = useState([]);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!visible || !contactNumber) return;
    setLoading(true);
    setError(null);
    api.get(`/api/calls/history/${encodeURIComponent(contactNumber)}`)
      .then((res) => setCalls(res.data?.data || []))
      .catch(() => setError('Could not load call history'))
      .finally(() => setLoading(false));
  }, [visible, contactNumber]);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.topRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={1}>{contactName || contactNumber}</Text>
              <Text style={s.sub}>{contactNumber}</Text>
            </View>
            {!loading && (
              <View style={s.countBadge}><Text style={s.countText}>{calls.length}</Text></View>
            )}
            <TouchableOpacity onPress={onClose} style={s.closeBtn}><Text style={s.closeX}>✕</Text></TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator style={{ paddingVertical: 32 }} color={Colors.primary} />
          ) : error ? (
            <Text style={s.empty}>{error}</Text>
          ) : (
            <FlatList
              data={calls}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const tc = TYPE_CFG[item.callType] || { color: Colors.textMuted, icon: '↕', label: item.callType };
                const sc = STATUS_CFG[item.callStatus];
                const dur = fmtDur(item.duration);
                return (
                  <View style={s.row}>
                    <View style={s.rowTop}>
                      <View style={[s.dot, { backgroundColor: tc.color + '18' }]}>
                        <Text style={{ color: tc.color, fontSize: 14 }}>{tc.icon}</Text>
                      </View>
                      <Text style={[s.typeLabel, { color: tc.color }]}>{tc.label}</Text>
                      {dur && <Text style={s.dur}>· {dur}</Text>}
                      <Text style={s.time}>{fmtTs(item.timestamp)}</Text>
                    </View>
                    <Text style={s.employee}>{item.employeeName || 'Unknown'}</Text>
                    {sc && (
                      <View style={[s.statusPill, { backgroundColor: sc.color + '18' }]}>
                        <Text style={[s.statusText, { color: sc.color }]}>{sc.label}</Text>
                      </View>
                    )}
                    {!!item.remarks && <Text style={s.note}>{item.remarks}</Text>}
                  </View>
                );
              }}
              ListEmptyComponent={<Text style={s.empty}>No past calls to this number</Text>}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '82%', paddingBottom: 8 },
  handle:     { width: 38, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  topRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider, gap: 10 },
  title:      { fontSize: 16, fontWeight: '700', color: Colors.text },
  sub:        { fontSize: 12, color: Colors.textSec, marginTop: 1 },
  countBadge: { backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  countText:  { fontSize: 12, fontWeight: '700', color: Colors.primary },
  closeBtn:   { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  closeX:     { fontSize: 12, fontWeight: '700', color: Colors.textSec },

  row:        { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  rowTop:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:        { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  typeLabel:  { fontSize: 12, fontWeight: '700' },
  dur:        { fontSize: 12, color: Colors.textSec },
  time:       { flex: 1, fontSize: 11, color: Colors.textMuted, textAlign: 'right' },
  employee:   { fontSize: 11, color: Colors.textMuted, marginTop: 4, marginLeft: 36 },
  statusPill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6, marginLeft: 36 },
  statusText: { fontSize: 11, fontWeight: '700' },
  note:       { fontSize: 13, color: Colors.text, marginTop: 6, marginLeft: 36 },
  empty:      { textAlign: 'center', color: Colors.textMuted, marginTop: 32, marginBottom: 32, fontSize: 14 },
});
