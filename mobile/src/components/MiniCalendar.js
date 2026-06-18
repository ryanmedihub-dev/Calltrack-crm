import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export default function MiniCalendar({ value, onChange, minDate, maxDate }) {
  const init = value ? new Date(value) : new Date();
  const [vy, setVy] = useState(init.getFullYear());
  const [vm, setVm] = useState(init.getMonth());

  const firstDay    = new Date(vy, vm, 1).getDay();
  const daysInMonth = new Date(vy, vm + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const sel    = value ? new Date(value) : null;
  const isSel  = (d) => sel && sel.getFullYear() === vy && sel.getMonth() === vm && sel.getDate() === d;
  const isToday= (d) => { const t = new Date(); return t.getFullYear() === vy && t.getMonth() === vm && t.getDate() === d; };
  const isDis  = (d) => {
    if (!d) return true;
    const dt = new Date(vy, vm, d);
    if (minDate && dt < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return true;
    if (maxDate && dt > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) return true;
    return false;
  };

  const prev = () => { if (vm === 0) { setVy(y => y - 1); setVm(11); } else setVm(m => m - 1); };
  const next = () => { if (vm === 11) { setVy(y => y + 1); setVm(0); } else setVm(m => m + 1); };

  return (
    <View>
      <View style={c.hdr}>
        <TouchableOpacity onPress={prev} style={c.nav}>
          <Text style={c.navTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={c.monthLabel}>{MONTHS[vm]} {vy}</Text>
        <TouchableOpacity onPress={next} style={c.nav}>
          <Text style={c.navTxt}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={c.dayRow}>
        {DAYS.map((d) => <Text key={d} style={c.dayHdr}>{d}</Text>)}
      </View>

      <View style={c.grid}>
        {cells.map((d, i) => {
          const dis = isDis(d);
          const selected = d && isSel(d);
          const today = d && isToday(d);
          return (
            <TouchableOpacity
              key={i}
              style={c.cell}
              onPress={() => !dis && d && onChange(new Date(vy, vm, d))}
              activeOpacity={dis ? 1 : 0.7}
            >
              {d ? (
                <View style={[c.circle, selected && c.circleSel, !selected && today && c.circleToday]}>
                  <Text style={[c.dayTxt, selected && c.dayTxtSel, !selected && today && c.dayTxtToday, dis && c.dayTxtDis]}>
                    {d}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const c = StyleSheet.create({
  hdr:          { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  nav:          { width: 30, height: 30, borderRadius: 8, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  navTxt:       { fontSize: 20, color: '#334155', fontWeight: '700', lineHeight: 24 },
  monthLabel:   { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#0F172A' },
  dayRow:       { flexDirection: 'row', marginBottom: 2 },
  dayHdr:       { flex: 1, textAlign: 'center', fontSize: 10, color: '#94A3B8', fontWeight: '600', paddingVertical: 3 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap' },
  cell:         { width: `${100 / 7}%`, height: 36, justifyContent: 'center', alignItems: 'center' },
  circle:       { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  circleSel:    { backgroundColor: Colors.primary },
  circleToday:  { borderWidth: 1.5, borderColor: Colors.primary },
  dayTxt:       { fontSize: 12, color: '#334155', fontWeight: '500' },
  dayTxtSel:    { color: '#fff', fontWeight: '700' },
  dayTxtToday:  { color: Colors.primary, fontWeight: '700' },
  dayTxtDis:    { color: '#CBD5E1' },
});
