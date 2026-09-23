import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ScrollView, Animated, ActivityIndicator,
  Platform, Alert,
} from 'react-native';
import api from '../lib/api';
import { Colors } from '../theme/colors';

// ── Valid status values (must match backend enum) ─────────────────────────────
const VALID_STATUSES = new Set([
  'new','not_connected','low','contacted','engaged','interested','warm','hot','high_engagement',
  'not_interested','follow_up','booking_done','converted','lost',
]);

const STATUS_ALIASES = {
  'new': 'new', 'fresh': 'new', 'lead': 'new',
  'not connected': 'not_connected', 'not_connected': 'not_connected', 'no answer': 'not_connected', 'busy': 'not_connected',
  'low': 'low',
  'contacted': 'contacted', 'called': 'contacted', 'reached': 'contacted',
  'engaged': 'engaged',
  'interested': 'interested',
  'warm': 'warm', 'strong interest': 'warm',
  'hot': 'hot',
  'high engagement': 'high_engagement', 'high_engagement': 'high_engagement',
  'not interested': 'not_interested', 'not_interested': 'not_interested', 'cold': 'not_interested',
  'follow up': 'follow_up', 'follow_up': 'follow_up', 'callback': 'follow_up', 'follow-up': 'follow_up',
  'booking done': 'booking_done', 'booking_done': 'booking_done', 'booked': 'booking_done',
  'converted': 'converted', 'closed': 'converted', 'won': 'converted',
  'lost': 'lost', 'dead': 'lost', 'rejected': 'lost',
};

// ── CSV Parser ─────────────────────────────────────────────────────────────────
function parseCSV(raw) {
  const lines = raw.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { rows: [], errors: ['Need at least a header row and one data row'] };

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''));

  const nameIdx   = header.findIndex((h) => ['name','fullname','full_name','contact','contactname'].includes(h));
  const phoneIdx  = header.findIndex((h) => ['phone','mobile','number','phonenumber','contact_number','mobilenumber'].includes(h));
  const statusIdx = header.findIndex((h) => ['status','leadstatus','stage'].includes(h));

  if (nameIdx === -1 || phoneIdx === -1) {
    return { rows: [], errors: ['Could not find "Name" and "Phone" columns. Please check your CSV header row.'] };
  }

  const rows = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const name  = cols[nameIdx] || '';
    const phone = (cols[phoneIdx] || '').replace(/\D/g, '');
    let   status = 'new';

    if (!name) { errors.push(`Row ${i + 1}: missing name`); continue; }
    if (phone.length < 7) { errors.push(`Row ${i + 1}: invalid phone "${cols[phoneIdx]}"`); continue; }

    if (statusIdx !== -1 && cols[statusIdx]) {
      const raw = cols[statusIdx].trim().toLowerCase();
      status = STATUS_ALIASES[raw] || (VALID_STATUSES.has(raw) ? raw : 'new');
    }

    rows.push({ name, phone, status });
  }

  return { rows, errors };
}

// ── Step indicator ─────────────────────────────────────────────────────────────
function StepDot({ n, active, done }) {
  return (
    <View style={[st.dot, done && st.dotDone, active && st.dotActive]}>
      <Text style={[st.dotText, (active || done) && { color: '#fff' }]}>
        {done ? '✓' : n}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  dot:      { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  dotActive:{ backgroundColor: Colors.primary, borderColor: Colors.primary },
  dotDone:  { backgroundColor: '#059669', borderColor: '#059669' },
  dotText:  { fontSize: 12, fontWeight: '800', color: Colors.textMuted },
});

// ── Main Component ─────────────────────────────────────────────────────────────
export default function BulkUploadModal({ visible, onClose, onUploaded }) {
  const [step,       setStep]       = useState(1); // 1=paste, 2=preview, 3=done
  const [csvText,    setCsvText]    = useState('');
  const [parsed,     setParsed]     = useState([]);
  const [parseErrors,setParseErrors]= useState([]);
  const [uploading,  setUploading]  = useState(false);
  const [result,     setResult]     = useState(null); // { inserted, skipped, errors }
  const translateY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) { setStep(1); setCsvText(''); setParsed([]); setParseErrors([]); setResult(null); }
    Animated.spring(translateY, {
      toValue: visible ? 0 : 600,
      useNativeDriver: true,
      damping: 22, mass: 0.85,
    }).start();
  }, [visible]);

  const handleParse = () => {
    const { rows, errors } = parseCSV(csvText);
    setParsed(rows);
    setParseErrors(errors);
    if (rows.length > 0) setStep(2);
  };

  const handleUpload = async () => {
    if (!parsed.length) return;
    setUploading(true);
    try {
      const res = await api.post('/api/leads/bulk-upload', { leads: parsed });
      setResult(res.data);
      setStep(3);
    } catch (e) {
      Alert.alert('Upload failed', e?.response?.data?.error || 'Something went wrong. Please try again.');
    } finally { setUploading(false); }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>
        {/* Header */}
        <View style={s.handle} />
        <View style={s.topRow}>
          <Text style={s.title}>Bulk Upload Leads</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Steps */}
        <View style={s.stepsRow}>
          {[
            { n: 1, label: 'Paste CSV' },
            { n: 2, label: 'Preview'  },
            { n: 3, label: 'Done'     },
          ].map((item, idx, arr) => (
            <React.Fragment key={item.n}>
              <View style={s.stepItem}>
                <StepDot n={item.n} active={step === item.n} done={step > item.n} />
                <Text style={[s.stepLabel, step === item.n && { color: Colors.primary, fontWeight: '700' }]}>
                  {item.label}
                </Text>
              </View>
              {idx < arr.length - 1 && <View style={s.stepLine} />}
            </React.Fragment>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
          {/* ── Step 1: Paste CSV ── */}
          {step === 1 && (
            <View style={s.stepContent}>
              <View style={s.infoBox}>
                <Text style={s.infoTitle}>📋 How to upload</Text>
                <Text style={s.infoText}>1. Open your Excel/Google Sheet</Text>
                <Text style={s.infoText}>2. Make sure columns are: <Text style={s.infoCode}>Name, Phone, Status</Text> (Status is optional)</Text>
                <Text style={s.infoText}>3. Select all rows → Copy</Text>
                <Text style={s.infoText}>4. Paste below</Text>
              </View>

              <View style={s.exampleBox}>
                <Text style={s.exampleTitle}>Example format:</Text>
                <Text style={s.exampleCode}>Name,Phone,Status{'\n'}Rahul Sharma,9876543210,interested{'\n'}Priya Singh,8765432109,new</Text>
              </View>

              <Text style={s.fieldLabel}>Paste your CSV data</Text>
              <TextInput
                style={s.csvInput}
                multiline
                textAlignVertical="top"
                placeholder={'Name,Phone,Status\nRahul Sharma,9876543210,new\n…'}
                placeholderTextColor={Colors.textMuted}
                value={csvText}
                onChangeText={setCsvText}
                autoCorrect={false}
                autoCapitalize="none"
              />

              {parseErrors.length > 0 && (
                <View style={s.errorBox}>
                  {parseErrors.map((e, i) => (
                    <Text key={i} style={s.errorText}>⚠ {e}</Text>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[s.primaryBtn, !csvText.trim() && { opacity: 0.45 }]}
                onPress={handleParse}
                disabled={!csvText.trim()}
              >
                <Text style={s.primaryBtnText}>Parse & Preview →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 2: Preview ── */}
          {step === 2 && (
            <View style={s.stepContent}>
              <View style={s.previewHeader}>
                <View style={s.previewBadge}>
                  <Text style={s.previewBadgeText}>{parsed.length} leads ready</Text>
                </View>
                {parseErrors.length > 0 && (
                  <Text style={s.previewWarn}>{parseErrors.length} row{parseErrors.length !== 1 ? 's' : ''} skipped</Text>
                )}
              </View>

              {parseErrors.length > 0 && (
                <View style={s.warnBox}>
                  {parseErrors.map((e, i) => <Text key={i} style={s.warnText}>⚠ {e}</Text>)}
                </View>
              )}

              {/* Table header */}
              <View style={s.tableHeader}>
                <Text style={[s.th, { flex: 2 }]}>Name</Text>
                <Text style={[s.th, { flex: 2 }]}>Phone</Text>
                <Text style={[s.th, { flex: 1.5 }]}>Status</Text>
              </View>

              {parsed.slice(0, 30).map((row, i) => (
                <View key={i} style={[s.tableRow, i % 2 === 1 && { backgroundColor: Colors.bg }]}>
                  <Text style={[s.td, { flex: 2 }]} numberOfLines={1}>{row.name}</Text>
                  <Text style={[s.td, { flex: 2 }]}>{row.phone}</Text>
                  <Text style={[s.tdStatus, { flex: 1.5 }]} numberOfLines={1}>{row.status}</Text>
                </View>
              ))}
              {parsed.length > 30 && (
                <Text style={s.moreRows}>…and {parsed.length - 30} more rows</Text>
              )}

              <View style={s.btnRow}>
                <TouchableOpacity style={s.secondaryBtn} onPress={() => setStep(1)}>
                  <Text style={s.secondaryBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.primaryBtn, { flex: 2 }, uploading && { opacity: 0.7 }]}
                  onPress={handleUpload}
                  disabled={uploading}
                >
                  {uploading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.primaryBtnText}>Upload {parsed.length} Leads ✓</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Step 3: Done ── */}
          {step === 3 && result && (
            <View style={[s.stepContent, s.doneContent]}>
              <View style={s.doneIcon}>
                <Text style={{ fontSize: 44 }}>🎉</Text>
              </View>
              <Text style={s.doneTitle}>Upload Complete!</Text>

              <View style={s.resultGrid}>
                <View style={[s.resultBox, { backgroundColor: '#D1FAE5' }]}>
                  <Text style={[s.resultNum, { color: '#059669' }]}>{result.inserted ?? result.data?.inserted ?? 0}</Text>
                  <Text style={[s.resultLabel, { color: '#059669' }]}>Inserted</Text>
                </View>
                <View style={[s.resultBox, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[s.resultNum, { color: '#D97706' }]}>{result.skipped ?? result.data?.skipped ?? 0}</Text>
                  <Text style={[s.resultLabel, { color: '#D97706' }]}>Skipped</Text>
                </View>
                <View style={[s.resultBox, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={[s.resultNum, { color: '#DC2626' }]}>{result.errors ?? result.data?.errors ?? 0}</Text>
                  <Text style={[s.resultLabel, { color: '#DC2626' }]}>Errors</Text>
                </View>
              </View>

              <Text style={s.doneHint}>Skipped = duplicates (same phone already in system)</Text>

              <TouchableOpacity style={s.primaryBtn} onPress={onUploaded}>
                <Text style={s.primaryBtnText}>View Leads →</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.55)' },
  sheet:    { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 12, maxHeight: '92%' },
  handle:   { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  topRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title:    { fontSize: 18, fontWeight: '800', color: Colors.text },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 13, color: Colors.textSec },

  stepsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  stepItem: { alignItems: 'center', gap: 5 },
  stepLabel:{ fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.border, marginHorizontal: 6, marginBottom: 14 },

  stepContent: { paddingBottom: 8 },

  infoBox:    { backgroundColor: '#EFF6FF', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#BFDBFE' },
  infoTitle:  { fontSize: 13, fontWeight: '700', color: '#1D4ED8', marginBottom: 8 },
  infoText:   { fontSize: 12, color: '#1E40AF', marginBottom: 3 },
  infoCode:   { fontWeight: '700', backgroundColor: '#DBEAFE', borderRadius: 4, paddingHorizontal: 4 },

  exampleBox:  { backgroundColor: '#F8F9FB', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  exampleTitle:{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, marginBottom: 6 },
  exampleCode: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: Colors.text, lineHeight: 18 },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 },
  csvInput:   { backgroundColor: Colors.bg, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, padding: 14, height: 150, fontSize: 12, color: Colors.text, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', lineHeight: 18, marginBottom: 14 },

  errorBox:  { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#FCA5A5' },
  errorText: { fontSize: 12, color: '#DC2626', marginBottom: 2 },

  warnBox:   { backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FDE68A' },
  warnText:  { fontSize: 12, color: '#92400E', marginBottom: 2 },

  previewHeader:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  previewBadge:    { backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#6EE7B7' },
  previewBadgeText:{ fontSize: 12, fontWeight: '700', color: '#059669' },
  previewWarn:     { fontSize: 12, color: '#D97706', fontWeight: '600' },

  tableHeader: { flexDirection: 'row', backgroundColor: Colors.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 2 },
  th:          { fontSize: 10, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow:    { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  td:          { fontSize: 12, color: Colors.text },
  tdStatus:    { fontSize: 11, fontWeight: '700', color: Colors.primary },
  moreRows:    { textAlign: 'center', fontSize: 12, color: Colors.textMuted, paddingVertical: 10 },

  btnRow:       { flexDirection: 'row', gap: 10, marginTop: 16 },
  primaryBtn:   { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  secondaryBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSec },

  doneContent: { alignItems: 'center', paddingTop: 16 },
  doneIcon:    { width: 88, height: 88, borderRadius: 44, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  doneTitle:   { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 20 },
  resultGrid:  { flexDirection: 'row', gap: 12, marginBottom: 14 },
  resultBox:   { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
  resultNum:   { fontSize: 28, fontWeight: '900', marginBottom: 2 },
  resultLabel: { fontSize: 12, fontWeight: '700' },
  doneHint:    { fontSize: 11, color: Colors.textMuted, marginBottom: 20, textAlign: 'center' },
});
