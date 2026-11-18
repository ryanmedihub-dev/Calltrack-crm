'use client';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../lib/api';
import { isAdminUser } from '../../../lib/auth';
import StatCard from '../../../components/StatCard';
import { todayIST } from '../../../components/DateRangeFilter';

// Manager/TL: only their own team comes back (the backend scopes /employees-periodic by tlName).
// Admin: every employee, grouped here by team (tlName) so each manager/TL's report is visible.
const PRESETS = [
  { key: 0,  label: 'Today' },
  { key: 6,  label: 'Last 7 days' },
  { key: 29, label: 'Last 30 days' },
];

function daysAgo(n) {
  const d = new Date(`${todayIST()}T00:00:00`);
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA');
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

function sum(rows) {
  return rows.reduce((t, r) => ({
    calls: t.calls + r.totalCalls,
    connected: t.connected + r.connectedCalls,
    duration: t.duration + r.totalDuration,
    leads: t.leads + r.leadsAssigned,
    converted: t.converted + r.leadsConverted,
  }), { calls: 0, connected: 0, duration: 0, leads: 0, converted: 0 });
}

function fmtDur(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function TeamTable({ title, rows }) {
  const t = sum(rows);
  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E2E8F4' }}>
      {title && (
        <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-2" style={{ borderBottom: '1px solid #EAECF0', background: '#F8FAFC' }}>
          <p className="text-sm font-bold" style={{ color: '#0F172A' }}>{title}</p>
          <p className="text-xs tabular-nums" style={{ color: '#64748B' }}>
            {rows.length} agents · {t.calls} calls · {pct(t.connected, t.calls)}% connected · {t.converted} converted
          </p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider" style={{ color: '#94A3B8' }}>
              <th className="px-5 py-2.5 font-semibold">Employee</th>
              <th className="px-3 py-2.5 font-semibold text-right">Calls</th>
              <th className="px-3 py-2.5 font-semibold text-right">Connected</th>
              <th className="px-3 py-2.5 font-semibold text-right">Talk time</th>
              <th className="px-3 py-2.5 font-semibold text-right">Target</th>
              <th className="px-3 py-2.5 font-semibold text-right">Leads</th>
              <th className="px-5 py-2.5 font-semibold text-right">Converted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employeeId} style={{ borderTop: '1px solid #F1F5F9' }}>
                <td className="px-5 py-2.5">
                  <a href={`/employees/${r.employeeId}`} className="font-semibold hover:underline" style={{ color: '#0F172A' }}>{r.employeeName}</a>
                  {!r.isActive && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#FEF2F2', color: '#DC2626' }}>INACTIVE</span>}
                  {r.employeeCode && <span className="block text-[11px]" style={{ color: '#94A3B8' }}>{r.employeeCode}</span>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.totalCalls}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.connectedCalls} <span style={{ color: '#94A3B8' }}>({pct(r.connectedCalls, r.totalCalls)}%)</span></td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.totalTalktime}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.targetAchievement == null ? '—' : `${r.targetAchievement}%`}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.leadsAssigned}</td>
                <td className="px-5 py-2.5 text-right tabular-nums">{r.leadsConverted}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-sm" style={{ color: '#94A3B8' }}>No employees in this team.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const [user, setUser]       = useState(null);
  const [preset, setPreset]   = useState(0);
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get('/api/auth/me').then((r) => setUser(r.data.data)).catch(() => {}); }, []);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    api.get('/api/reports/employees-periodic', { params: { tab: 'directory', startDate: daysAgo(preset), endDate: todayIST() } })
      .then((r) => { if (!ignore) setRows(r.data.data?.employees || []); })
      .catch((e) => toast.error(e.response?.data?.error || 'Failed to load team report'))
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [preset]);

  const admin = isAdminUser(user);
  const total = sum(rows);
  const teams = useMemo(() => {
    // Same team regardless of case/spaces ("Rahul" = " rahul"), matching the backend.
    const m = new Map();
    for (const r of [...rows].sort((a, b) => b.totalCalls - a.totalCalls)) {
      const label = (r.tlName || '').trim() || 'Unassigned';
      const k = label.toLowerCase();
      if (!m.has(k)) m.set(k, [label, []]);
      m.get(k)[1].push(r);
    }
    return [...m.values()].sort(([a], [b]) => (a === 'Unassigned') - (b === 'Unassigned') || a.localeCompare(b));
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: '#0F172A', letterSpacing: '-0.02em' }}>
            {admin ? 'Team Reports' : 'My Team'}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
            {admin
              ? 'Every manager / TL team and their employees'
              : `Employees assigned to ${user?.name || 'you'} (by TL name)`}
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#F1F5F9' }}>
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => setPreset(p.key)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg"
              style={preset === p.key ? { background: '#fff', color: '#0F172A', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : { color: '#64748B' }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={admin ? 'Teams' : 'Team size'} value={admin ? teams.length : rows.length} sub={admin ? `${rows.length} employees` : `${rows.filter((r) => r.isActive).length} active`} icon="👥" color="blue" />
        <StatCard title="Calls" value={total.calls} sub={`${fmtDur(total.duration)} talk time`} icon="📞" color="teal" />
        <StatCard title="Connected" value={`${pct(total.connected, total.calls)}%`} sub={`${total.connected} calls`} icon="✅" color="green" />
        <StatCard title="Leads converted" value={total.converted} sub={`of ${total.leads} assigned`} icon="🎯" color="orange" />
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-10 text-center text-sm" style={{ border: '1px solid #E2E8F4', color: '#94A3B8' }}>Loading…</div>
      ) : admin ? (
        teams.map(([name, list]) => <TeamTable key={name} title={name} rows={list} />)
      ) : (
        <TeamTable rows={rows} />
      )}
    </div>
  );
}
