import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Alert, Share, ActivityIndicator, Platform,
} from 'react-native';
import api from '../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/shadows';
import ContactAvatar from '../components/ContactAvatar';
import SimPickerModal from '../components/SimPickerModal';

const MENU_SECTIONS = [
  {
    title: 'Tools',
    items: [
      { icon: '📤', label: 'Export CSV',    sublabel: 'Download your call history', key: 'export', iconBg: Colors.tealBg },
      { icon: '📋', label: 'Templates',     sublabel: 'Note & message templates',    key: 'templates', iconBg: Colors.purpleBg },
      { icon: '🔔', label: 'Notifications', sublabel: 'Call alerts & reminders',     key: 'notifications', iconBg: Colors.warningBg },
    ],
  },
  {
    title: 'Account',
    items: [
      { icon: '🔒', label: 'SIM Settings',  sublabel: 'Choose which SIM to track',  key: 'sim',  iconBg: Colors.primaryLight },
      { icon: '❓', label: 'Help & Support', sublabel: 'FAQs and contact us',        key: 'help', iconBg: Colors.successBg },
      { icon: '🚪', label: 'Logout',         sublabel: null,                         key: 'logout', danger: true, iconBg: Colors.dangerBg },
    ],
  },
];

const QUICK_STATS = [
  { key: 'today', label: 'Today',   icon: '📞', color: Colors.primary },
  { key: 'week',  label: 'Week',    icon: '📊', color: Colors.success },
  { key: 'month', label: 'Month',   icon: '📅', color: Colors.warning },
];

export default function MoreScreen({ onLogout }) {
  const [user,          setUser]          = useState(null);
  const [showSimPicker, setShowSimPicker] = useState(false);
  const [exporting,     setExporting]     = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('user').then((s) => { if (s) setUser(JSON.parse(s)); });
  }, []);

  const quickStats = user?.stats || {};

  const handleMenu = async (key) => {
    if (key === 'logout') {
      Alert.alert('Logout?', 'You will need to log in again.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove(['token', 'user', 'tracked_sim_id']);
            onLogout?.();
          },
        },
      ]);
    } else if (key === 'sim') {
      setShowSimPicker(true);
    } else if (key === 'export') {
      const userId = user?._id;
      if (!userId) return;
      setExporting(true);
      try {
        const res   = await api.get(`/api/calls/employee/${userId}`, { params: { limit: 500 } });
        const calls = res.data.data?.calls || [];
        const headers = ['Date', 'Time', 'Contact Name', 'Number', 'Type', 'Duration (s)'];
        const rows = calls.map((c) => {
          const d = new Date(c.timestamp);
          return [
            d.toLocaleDateString('en-IN'),
            d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            `"${(c.contactName || '').replace(/"/g, '""')}"`,
            c.contactNumber || '',
            c.callType || '',
            c.duration || 0,
          ];
        });
        const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
        await Share.share({ title: 'Call History Export', message: csv });
      } catch {
        Alert.alert('Export Failed', 'Could not export call history. Check your connection.');
      } finally {
        setExporting(false);
      }
    } else if (key === 'help') {
      Alert.alert('Help & Support', 'For help, contact your admin or write to support@calltracker.app');
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile hero */}
        <View style={s.hero}>
          <View style={s.heroDec1} />
          <View style={s.heroDec2} />
          <View style={s.heroInner}>
            <ContactAvatar name={user?.name || 'User'} number="" size={60} />
            <View style={s.heroMid}>
              <Text style={s.heroName}>{user?.name || 'Loading…'}</Text>
              <Text style={s.heroRole}>{user?.role || 'Sales Agent'}</Text>
              {!!user?.phone && <Text style={s.heroPhone}>{user.phone}</Text>}
            </View>
            <View style={s.activeBadge}>
              <Text style={s.activeBadgeText}>● Active</Text>
            </View>
          </View>
        </View>

        {/* Quick stats strip */}
        <View style={s.statsStrip}>
          {QUICK_STATS.map(({ key, label, icon, color }) => (
            <View key={key} style={s.statsItem}>
              <Text style={s.statsIcon}>{icon}</Text>
              <Text style={[s.statsValue, { color }]}>
                {quickStats[key] ?? 0}
              </Text>
              <Text style={s.statsLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Menu sections */}
        {MENU_SECTIONS.map((section) => (
          <View key={section.title} style={s.section}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <View style={s.sectionCard}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    s.menuItem,
                    idx < section.items.length - 1 && s.menuItemBorder,
                    item.disabled && { opacity: 0.4 },
                  ]}
                  onPress={() => !item.disabled && handleMenu(item.key)}
                  activeOpacity={0.7}
                >
                  <View style={[s.menuIcon, { backgroundColor: item.iconBg || Colors.primaryLight }]}>
                    <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                  </View>
                  <View style={s.menuMid}>
                    <Text style={[s.menuLabel, item.danger && { color: Colors.danger }]}>{item.label}</Text>
                    {item.sublabel && <Text style={s.menuSub}>{item.sublabel}</Text>}
                  </View>
                  {!item.danger && <Text style={s.menuArrow}>›</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {exporting && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 }}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={{ color: Colors.primary, fontSize: 13, fontWeight: '600' }}>Exporting…</Text>
          </View>
        )}

        <Text style={s.version}>CallTrack v1.0 · Built with ♥</Text>
      </ScrollView>

      <SimPickerModal visible={showSimPicker} onClose={() => setShowSimPicker(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingBottom: 48 },

  hero: {
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === 'android' ? 48 : 56,
    paddingBottom: 28,
    paddingHorizontal: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  heroDec1: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)', top: -40, right: -30 },
  heroDec2: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -10, left: 10 },
  heroInner:   { flexDirection: 'row', alignItems: 'center', gap: 14, position: 'relative' },
  heroMid:     { flex: 1 },
  heroName:    { fontSize: 18, fontWeight: '800', color: '#fff' },
  heroRole:    { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  heroPhone:   { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  activeBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  statsStrip: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    ...Shadows.card,
  },
  statsItem: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRightWidth: 1, borderRightColor: Colors.divider },
  statsIcon: { fontSize: 16, marginBottom: 4 },
  statsValue:{ fontSize: 20, fontWeight: '800' },
  statsLabel:{ fontSize: 10, color: Colors.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },

  section:      { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: 4, marginBottom: 8 },
  sectionCard:  { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', ...Shadows.sm },

  menuItem:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  menuIcon:       { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  menuMid:        { flex: 1 },
  menuLabel:      { fontSize: 14, fontWeight: '600', color: Colors.text },
  menuSub:        { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  menuArrow:      { fontSize: 22, color: Colors.border },

  version: { textAlign: 'center', fontSize: 12, color: Colors.textMuted, marginTop: 8, marginBottom: 8 },
});
