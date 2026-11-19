'use client';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../../lib/api';
import { isAdminUser } from '../../../lib/auth';
import { StatCard, PageHeader } from '../../../components/report-shared';
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
    <section className="panel overflow-hidden" aria-label={title || 'Team'}>
      {title && (
        <div className="panel-head flex-wrap">
          <h2 className="panel-title">{title}</h2>
          <p className="text-xs text-ink-3 tabular-nums">
            {rows.length} agents · {t.calls.toLocaleString('en-IN')} calls · {pct(t.connected, t.calls)}% connected · {t.converted} converted
          </p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="data-table min-w-[720px]">
          <thead>
            <tr>
              <th>Employee</th>
              <th className="!text-right">Calls</th>
              <th className="!text-right">Connected</th>
              <th className="!text-right">Talk time</th>
              <th className="!text-right">Of target</th>
              <th className="!text-right">Leads</th>
              <th className="!text-right">Converted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employeeId}>
                <td>
                  <a href={`/employees/${r.employeeId}`} className="font-medium text-ink hover:text-[var(--blue)] transition-colors">{r.employeeName}</a>
                  {!r.isActive && <span className="badge bg-gray-100 text-ink-3 ml-2">Inactive</span>}
                  {r.employeeCode && <span className="block text-xs text-ink-3">{r.employeeCode}</span>}
                </td>
                <td className="text-right tabular-nums">{r.totalCalls ? <b className="font-medium text-ink">{r.totalCalls.toLocaleString('en-IN')}</b> : <span className="text-ink-4">0</span>}</td>
                <td className="text-right tabular-nums">{r.totalCalls ? `${pct(r.connectedCalls, r.totalCalls)}%` : <span className="text-ink-4">—</span>}</td>
                <td className="text-right tabular-nums">{r.totalTalktime}</td>
                <td className="text-right tabular-nums">{r.targetAchievement == null ? <span className="text-ink-4">—</span> : <span className={r.targetAchievement >= 100 ? 'text-met font-medium' : ''}>{r.targetAchievement}%</span>}</td>
                <td className="text-right tabular-nums">{r.leadsAssigned}</td>
                <td className="text-right tabular-nums">{r.leadsConverted}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="!py-10 text-center text-ink-3">No employees in this team yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Admin: one row per team with totals; click a team to open its members (accordion, 200ms).
function TeamsSummary({ teams }) {
  const [open, setOpen] = useState(() => new Set());
  const toggle = (k) => setOpen((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  return (
    <section className="panel overflow-hidden" aria-label="Teams">
      <div className="panel-head">
        <div><h2 className="panel-title">Teams</h2><p className="panel-sub">Click a team to see its members</p></div>
        <button onClick={() => setOpen(open.size ? new Set() : new Set(teams.map(([n]) => n)))} className="btn-ghost btn-sm">
          {open.size ? 'Collapse all' : 'Expand all'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-[720px]">
          <thead>
            <tr><th>Team</th><th className="!text-right">Agents</th><th className="!text-right">Calls</th><th className="!text-right">Connected</th><th className="!text-right">Talk time</th><th className="!text-right">Converted</th></tr>
          </thead>
          <tbody>
            {teams.map(([name, list]) => {
              const t = sum(list);
              const isOpen = open.has(name);
              const active = list.filter((r) => r.isActive).length;
              return (
                <Fragment key={name}>
                  <tr onClick={() => toggle(name)} aria-expanded={isOpen} className="cursor-pointer">
                    <td>
                      <span className="flex items-center gap-2">
                        <svg className={`text-ink-3 transition-transform duration-200 ease-out ${isOpen ? 'rotate-90' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                        <span className={`font-medium ${name === 'Unassigned' ? 'text-ink-3' : 'text-ink'}`}>{name}</span>
                      </span>
                    </td>
                    <td className="text-right tabular-nums">{active}<span className="text-ink-3"> / {list.length}</span></td>
                    <td className="text-right tabular-nums">{t.calls ? <b className="font-medium text-ink">{t.calls.toLocaleString('en-IN')}</b> : <span className="text-ink-4">0</span>}</td>
                    <td className="text-right tabular-nums">{t.calls ? `${pct(t.connected, t.calls)}%` : <span className="text-ink-4">—</span>}</td>
                    <td className="text-right tabular-nums">{fmtDur(t.duration)}</td>
                    <td className="text-right tabular-nums">{t.converted}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} className="!p-0 !h-auto bg-gray-50">
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} className="overflow-hidden">
                          <div className="p-3"><TeamTable rows={list} /></div>
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
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
      <PageHeader
        title={admin ? 'Team reports' : 'My team'}
        description={admin ? 'Every manager / TL team and their employees' : `Employees whose TL name matches ${user?.name || 'yours'}`}
        actions={
          <div className="seg" role="group" aria-label="Period">
            {PRESETS.map((p) => (
              <button key={p.key} aria-pressed={preset === p.key} onClick={() => setPreset(p.key)}>{p.label}</button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={admin ? 'Teams' : 'Team size'} value={admin ? teams.length : rows.length} sub={admin ? `${rows.length} employees` : `${rows.filter((r) => r.isActive).length} active`} />
        <StatCard label="Calls" value={total.calls} sub={`${fmtDur(total.duration)} talk time`} />
        <StatCard label="Connected" value={`${pct(total.connected, total.calls)}%`} sub={`${total.connected} calls`} />
        <StatCard label="Leads converted" value={total.converted} sub={`of ${total.leads} assigned`} />
      </div>

      {loading ? (
        <div className="panel p-5 space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-9" />)}</div>
      ) : admin ? (
        <TeamsSummary teams={teams} />
      ) : (
        <TeamTable rows={rows} />
      )}
    </div>
  );
}
