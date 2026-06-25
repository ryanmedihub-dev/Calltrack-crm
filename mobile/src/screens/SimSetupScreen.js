import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, StatusBar, Platform,
} from 'react-native';
import { getAvailableSims, setTrackedSim } from '../services/simService';
import { Colors } from '../theme/colors';

const SIM_COLORS = ['#6366F1', '#16A34A', '#D97706', '#DC2626'];

export default function SimSetupScreen({ onDone }) {
  const [sims,     setSims]     = useState([]);
  const [selected, setSelected] = useState(-1);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    getAvailableSims().then((list) => {
      setSims(list || []);
      // If exactly one SIM found, pre-select it
      if (list?.length === 1) setSelected(list[0].subscriptionId);
      setLoading(false);
    });
  }, []);

  const handleContinue = async () => {
    setSaving(true);
    await setTrackedSim(selected);
    setSaving(false);
    onDone();
  };

  const options = [
    { subscriptionId: -1, displayName: 'All SIMs', carrierName: 'Track calls from every SIM card', slotIndex: -1 },
    ...sims,
  ];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />

      {/* Top section */}
      <View style={s.top}>
        <View style={s.iconWrap}>
          <Text style={s.icon}>📱</Text>
        </View>
        <Text style={s.heading}>Select SIM Card</Text>
        <Text style={s.sub}>
          Choose which SIM card's calls to track.{'\n'}
          Only calls from the selected SIM will appear in your history.
        </Text>
      </View>

      {/* SIM list */}
      <ScrollView
        style={s.list}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={s.loadingText}>Reading SIM cards…</Text>
          </View>
        ) : (
          options.map((sim, idx) => {
            const active   = selected === sim.subscriptionId;
            const isAll    = sim.subscriptionId === -1;
            const simColor = isAll ? Colors.primary : (SIM_COLORS[sim.slotIndex] || Colors.primary);

            return (
              <TouchableOpacity
                key={String(sim.subscriptionId)}
                style={[s.card, active && { borderColor: simColor, borderWidth: 2, backgroundColor: Colors.primaryLight + '22' }]}
                onPress={() => setSelected(sim.subscriptionId)}
                activeOpacity={0.75}
              >
                {/* Left accent bar */}
                <View style={[s.accent, { backgroundColor: active ? simColor : '#E2E8F0' }]} />

                <View style={[s.simBadge, { backgroundColor: active ? simColor : '#F1F5F9' }]}>
                  <Text style={{ fontSize: 18 }}>{isAll ? '📶' : '📱'}</Text>
                </View>

                <View style={s.cardMid}>
                  <Text style={[s.cardName, active && { color: simColor }]}>{sim.displayName}</Text>
                  <Text style={s.cardSub}>
                    {isAll
                      ? sim.carrierName
                      : `${sim.carrierName || 'Unknown'}${sim.number ? '  ·  ' + sim.number : ''}  ·  Slot ${sim.slotIndex + 1}`}
                  </Text>
                  {!isAll && (
                    <View style={[s.slotTag, { backgroundColor: simColor + '18' }]}>
                      <Text style={[s.slotTagText, { color: simColor }]}>SIM {sim.slotIndex + 1}</Text>
                    </View>
                  )}
                </View>

                {/* Radio */}
                <View style={[s.radio, active && { borderColor: simColor }]}>
                  {active && <View style={[s.radioDot, { backgroundColor: simColor }]} />}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {!loading && sims.length === 0 && (
          <View style={s.noSimWrap}>
            <Text style={s.noSimIcon}>📵</Text>
            <Text style={s.noSimText}>No SIMs detected</Text>
            <Text style={s.noSimHint}>
              Grant phone permissions and restart the app, or continue with "All SIMs" selected.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        <Text style={s.footerHint}>
          {selected === -1
            ? 'All SIM cards will be tracked'
            : `Tracking SIM in slot ${options.find((o) => o.subscriptionId === selected)?.slotIndex !== undefined ? options.find((o) => o.subscriptionId === selected)?.slotIndex + 1 : '?'}`}
        </Text>
        <TouchableOpacity
          style={[s.continueBtn, (saving || loading) && { opacity: 0.6 }]}
          onPress={handleContinue}
          disabled={saving || loading}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : (
              <View style={s.continueBtnInner}>
                <Text style={s.continueBtnText}>Continue</Text>
                <Text style={s.continueBtnArrow}>→</Text>
              </View>
            )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  top: { alignItems: 'center', paddingTop: Platform.OS === 'android' ? 56 : 72, paddingHorizontal: 32, paddingBottom: 28, backgroundColor: '#fff' },
  iconWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  icon:     { fontSize: 38 },
  heading:  { fontSize: 24, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5, marginBottom: 10, textAlign: 'center' },
  sub:      { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 21 },

  list:        { flex: 1 },
  listContent: { padding: 20, gap: 12 },

  loadingWrap: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 14, color: '#94A3B8', fontSize: 14 },

  card:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1.5, borderColor: '#E2E8F0', overflow: 'hidden', paddingRight: 16, paddingVertical: 14, gap: 14 },
  accent:  { width: 4, alignSelf: 'stretch' },
  simBadge:{ width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  cardMid: { flex: 1 },
  cardName:{ fontSize: 15, fontWeight: '700', color: '#0F172A' },
  cardSub: { fontSize: 12, color: '#64748B', marginTop: 3, lineHeight: 17 },
  slotTag: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 5 },
  slotTagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },

  radio:    { width: 24, height: 24, borderRadius: 12, borderWidth: 2.5, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },

  noSimWrap: { alignItems: 'center', paddingTop: 40 },
  noSimIcon: { fontSize: 44, marginBottom: 14 },
  noSimText: { fontSize: 17, fontWeight: '700', color: '#475569' },
  noSimHint: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19, paddingHorizontal: 24, marginTop: 8 },

  footer:       { padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  footerHint:   { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginBottom: 12 },
  continueBtn:  { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  continueBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  continueBtnText:  { fontSize: 16, fontWeight: '800', color: '#fff' },
  continueBtnArrow: { fontSize: 18, color: 'rgba(255,255,255,0.8)' },
});
