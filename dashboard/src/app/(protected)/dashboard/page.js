'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Pusher from 'pusher-js';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import api from '../../../lib/api';
import { getAllEmployeesSafe } from '../../../lib/employees';
import { STATUSES, STATUS_LABELS, statusStyle } from '../../../lib/leadStatus';
import DateRangeFilter, { formatRangeLabel, rangeToDates } from '../../../components/DateRangeFilter';
import MultiSelect from '../../../components/MultiSelect';
import {
  DataTable, PageHeader, CallBadge, ChartTip, EmptyState, Truncate, TYPE_META, fmtNum, RefreshIco,
} from '../../../components/report-shared';

/* ── The chase is measured against the working shift (IST hours).
   ponytail: fixed shift window; move to a settings value if teams work different hours. ── */
const SHIFT_START = 10; // 10:00 IST
const SHIFT_END = 19;   // 19:00 IST
const EASE_OUT = [0.23, 1, 0.32, 1];

function parseUTC(ts) {
  if (!ts) return new Date(NaN);
  const s = String(ts).trim();
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s)) return new Date(s);
  return new Date(s + 'Z');
}
const fmtTime = (ts) => parseUTC(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }).toUpperCase();
const hourLabel = (h) => `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;
const istNow = () => {
  const p = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', hour12: false }).split(':');
  return { h: parseInt(p[0], 10) % 24, m: parseInt(p[1], 10) };
};
const fmtDur = (s) => {
  if (!s) return '0m';
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};
// Lower-case relative words mid-sentence ('created today'), never dates ('created 02 Nov').
const inline = (label) => (/^(today|yesterday|this week|all time)$/i.test(label) ? label.toLowerCase() : label);
const daysBetween = (a, b) => (a && b ? Math.round((new Date(b) - new Date(a)) / 86400000) + 1 : 1);

/* ── Chase maths: how far through the window are we, so what should be done by now ── */
function chaseClock(isToday) {
  if (!isToday) return { elapsed: 1, hoursLeft: 0, state: 'closed' };
  const { h, m } = istNow();
  const t = h + m / 60;
  const len = SHIFT_END - SHIFT_START;
  if (t < SHIFT_START) return { elapsed: 0, hoursLeft: len, state: 'before' };
  if (t >= SHIFT_END) return { elapsed: 1, hoursLeft: 0, state: 'after' };
  return { elapsed: (t - SHIFT_START) / len, hoursLeft: SHIFT_END - t, state: 'live' };
}

/* ── Small pieces ─────────────────────────────────────────────────── */
function Score({ label, value, unit, sub, tone, className = "" }) {
  return (
    <div className={`px-5 py-4 min-w-0 ${className}`}>
      <p className="stat-label">{label}</p>
      <p className={`stat-number mt-1 ${tone === 'behind' ? 'text-behind' : tone === 'met' ? 'text-met' : ''}`}>
        {value}{unit && <span className="text-[15px] font-medium text-ink-3 ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-ink-3 mt-1 truncate">{sub}</p>}
    </div>
  );
}

function Meter({ value, max, tone }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="progress-bar w-full">
      <div className="progress-fill" style={{ width: `${pct}%`, background: tone === 'met' ? 'var(--met)' : tone === 'behind' ? 'var(--behind)' : 'var(--blue)' }} />
    </div>
  );
}

function CreateLeadModal({ call, employees, onClose }) {
  const [form, setForm] = useState({
    name: call?.contactName && call.contactName !== 'Unknown' ? call.contactName : '',
    phone: call?.contactNumber || '',
    email: '',
    assignedTo: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/api/leads/from-call', { ...form, callId: call?._id, source: 'Call' });
      onClose(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create the lead. Check the details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE_OUT }}>
      <div className="absolute inset-0 bg-[rgba(26,23,38,0.45)]" onClick={() => onClose()} />
      <motion.div role="dialog" aria-modal="true" aria-labelledby="lead-modal-title"
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.25, ease: EASE_OUT }}
        className="relative w-full max-w-md bg-white rounded-xl shadow-2xl">
        <div className="flex items-start justify-between px-5 pt-5">
          <div>
            <h2 id="lead-modal-title" className="text-base font-semibold text-ink">Create lead from call</h2>
            <p className="text-[13px] text-ink-3 mt-0.5 tabular-nums">{call?.contactNumber}</p>
          </div>
          <button onClick={() => onClose()} aria-label="Close" className="btn-ghost btn-icon btn-sm w-8 -mr-1.5 -mt-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <form onSubmit={submit} className="px-5 pb-5 pt-4 space-y-4">
          {error && <p role="alert" className="text-[13px] text-behind bg-[var(--behind-50)] rounded-lg px-3 py-2">{error}</p>}
          <label className="block">
            <span className="form-label">Full name</span>
            <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="form-label">Phone</span>
              <input className="form-input tabular-nums" value={form.phone} readOnly disabled />
            </label>
            <label className="block">
              <span className="form-label">Email <span className="text-ink-3 font-normal">(optional)</span></span>
              <input type="email" className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
          </div>
          <label className="block">
            <span className="form-label">Assign to</span>
            <MultiSelect multiple={false} placeholder="Leave unassigned" ariaLabel="Assign to"
              value={form.assignedTo} onChange={(v) => setForm({ ...form, assignedTo: v })}
              options={employees.map((e) => [e._id, `${e.name}${e.ryanEmployeeCode ? ` (${e.ryanEmployeeCode})` : ''}`])} />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => onClose()} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary min-w-[112px]">{loading ? 'Creating…' : 'Create lead'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [liveFeed, setLiveFeed] = useState([]);
  const [freshIds, setFreshIds] = useState(() => new Set());
  const [employees, setEmployees] = useState([]);
  const [leadModal, setLeadModal] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [leadStats, setLeadStats] = useState({});
  const [dateRange, setDateRange] = useState({ range: 'today', startDate: null, endDate: null });
  const [fitCalls, setFitCalls] = useState(false); // chart y-scale: target (honest pace) or calls (readable shape)
  const [, setTick] = useState(0); // re-evaluates "now" for the chase every minute
  const dateRangeRef = useRef(dateRange);

  useEffect(() => { dateRangeRef.current = dateRange; }, [dateRange]);

  const fetchStats = async (spin = false) => {
    if (spin) setRefreshing(true);
    try {
      const dr = dateRangeRef.current;
      const params = { range: dr.range };
      if (dr.range === 'custom') { params.startDate = dr.startDate; params.endDate = dr.endDate; }
      const r = await api.get('/api/calls/stats', { params });
      setStats(r.data.data);
    } catch { } finally {
      setRefreshing(false);
    }
  };

  // Filtered like fetchStats so pipeline counts match the selected range, and so each row's
  // deep link into /reports/lead lands on the same set of leads it counted.
  const fetchLeadStats = async () => {
    try {
      const dr = dateRangeRef.current;
      const params = { limit: 1, range: dr.range };
      if (dr.range === 'custom') { params.startDate = dr.startDate; params.endDate = dr.endDate; }
      const results = await Promise.all(
        STATUSES.map((key) =>
          api.get('/api/leads', { params: { ...params, status: key } })
            .then((r) => ({ key, count: r.data.data?.total ?? 0 }))
            .catch(() => ({ key, count: 0 })),
        ),
      );
      const map = {};
      results.forEach((r) => { map[r.key] = r.count; });
      setLeadStats(map);
    } catch { }
  };

  useEffect(() => {
    setStats(null);
    fetchStats();
    fetchLeadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  useEffect(() => {
    getAllEmployeesSafe(api).then(setEmployees).catch(() => { });
    api.get('/api/calls/realtime').then((r) => setLiveFeed((r.data.data || []).slice(0, 30))).catch(() => { });
    const interval = setInterval(fetchStats, 30000);
    const clock = setInterval(() => setTick((t) => t + 1), 60000);
    if (!process.env.NEXT_PUBLIC_PUSHER_KEY) return () => { clearInterval(interval); clearInterval(clock); };
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2' });
    const channel = pusher.subscribe('managers');
    channel.bind('new_call_log', (data) => {
      setLiveFeed((prev) => [data, ...prev].slice(0, 30));
      const id = data._id || `${data.contactNumber}-${data.timestamp}`;
      setFreshIds((s) => new Set(s).add(id));
      setTimeout(() => setFreshIds((s) => { const n = new Set(s); n.delete(id); return n; }), 1600);
      fetchStats();
    });
    return () => {
      clearInterval(interval);
      clearInterval(clock);
      channel.unbind_all();
      pusher.unsubscribe('managers');
      pusher.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Derived chase ───────────────────────────────────────────── */
  const isToday = dateRange.range === 'today';
  const selected = stats?.selected || stats?.today;
  const yest = stats?.yesterday;
  const rangeLabel = formatRangeLabel(dateRange);
  const { fromDate, toDate } = rangeToDates(dateRange);
  const days = dateRange.range === 'all' ? null : daysBetween(fromDate, toDate);
  const clock = chaseClock(isToday);

  const agents = useMemo(() => {
    const byId = new Map((selected?.employeeStats || []).map((e) => [e.employeeId, e]));
    const rows = employees
      .filter((e) => e.role === 'employee' && e.isActive !== false)
      .map((e) => {
        const s = byId.get(String(e._id));
        byId.delete(String(e._id));
        return { id: String(e._id), name: e.name, tl: e.tlName || '', code: e.ryanEmployeeCode || '', target: (e.dailyTarget || 0) * (days || 1), done: s?.count || 0, connected: s?.connectedCalls || 0, missed: s?.missed || 0, last: s?.lastCallAt || null };
      });
    // Callers not in the employee list (e.g. deactivated mid-range) still count toward the totals.
    byId.forEach((s) => rows.push({ id: s.employeeId, name: s.name, tl: s.tlName || '', code: '', target: (s.dailyTarget || 0) * (days || 1), done: s.count, connected: s.connectedCalls, missed: s.missed, last: s.lastCallAt }));
    return rows.map((r) => {
      const expected = Math.round(r.target * clock.elapsed);
      const gap = r.done - expected;
      const tone = r.target > 0 && r.done >= r.target ? 'met' : r.target > 0 && clock.state !== 'before' && gap < 0 ? 'behind' : null;
      return { ...r, expected, gap, need: Math.max(0, r.target - r.done), pct: r.target ? Math.round((r.done / r.target) * 100) : null, connRate: r.done ? Math.round((r.connected / r.done) * 100) : 0, tone };
    });
  }, [employees, selected, days, clock.elapsed, clock.state]);

  const teamTarget = agents.reduce((a, r) => a + r.target, 0);
  const done = selected?.totalCalls || 0;
  const need = Math.max(0, teamTarget - done);
  const shiftLen = SHIFT_END - SHIFT_START;
  const requiredRate = clock.state === 'live' && clock.hoursLeft > 0 ? Math.ceil(need / clock.hoursLeft) : clock.state === 'before' ? Math.ceil(teamTarget / shiftLen) : null;
  const elapsedHours = clock.elapsed * shiftLen;
  const currentRate = clock.state === 'live' && elapsedHours > 0.25 ? Math.round(done / elapsedHours) : clock.state === 'after' ? Math.round(done / shiftLen) : null;
  const expectedNow = Math.round(teamTarget * clock.elapsed);
  const rateTone = requiredRate != null && currentRate != null ? (currentRate >= requiredRate ? 'met' : 'behind') : null;
  const vsYest = isToday && yest?.totalCalls ? Math.round(((done - yest.totalCalls) / yest.totalCalls) * 100) : null;

  const worm = useMemo(() => {
    const perHour = selected?.callsPerHour || [];
    const active = perHour.filter((p) => p.count > 0).map((p) => p.hour);
    const lo = Math.min(SHIFT_START, ...(active.length ? active : [SHIFT_START]));
    const hi = Math.max(SHIFT_END - 1, ...(active.length ? active : [SHIFT_END - 1]));
    const nowH = isToday ? istNow().h : 23;
    let cum = 0;
    const out = [];
    for (let h = lo; h <= hi; h++) {
      cum += perHour.find((p) => p.hour === h)?.count || 0;
      const frac = Math.max(0, Math.min(1, (h + 1 - SHIFT_START) / shiftLen));
      out.push({ hour: h, label: hourLabel(h), actual: h <= nowH ? cum : null, target: teamTarget ? Math.round(teamTarget * frac) : null });
    }
    return out;
  }, [selected, isToday, teamTarget, shiftLen]);

  const behind = agents.filter((a) => a.tone === 'behind').sort((a, b) => a.gap - b.gap);
  const notStarted = isToday && clock.state !== 'before' ? agents.filter((a) => a.done === 0).length : 0;

  const mix = ['outgoing', 'incoming', 'missed', 'rejected'].map((k) => ({ key: k, ...TYPE_META[k], value: selected?.[k] || 0 }));
  const mixTotal = mix.reduce((a, m) => a + m.value, 0);

  const totalLeads = Object.values(leadStats).reduce((a, b) => a + b, 0);
  const maxLead = Math.max(1, ...Object.values(leadStats));
  const loadingStats = !stats;

  // When today is empty, offer the last day that has data instead of a dead screen.
  const lastActiveDay = stats?.latestActivityTs ? new Date(stats.latestActivityTs).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : null;
  const emptyToday = isToday && stats && done === 0;

  const agentColumns = [
    {
      key: 'name', label: 'Agent', width: '24%',
      render: (r) => (
        <Link href={`/employees/${r.id}`} className="block min-w-0 group/a">
          <span className="block font-medium text-ink truncate group-hover/a:text-[var(--blue)]">{r.name}</span>
          <span className="block text-xs text-ink-3 truncate">{r.tl ? `TL ${r.tl}` : 'No team lead'}{r.code ? ` · ${r.code}` : ''}</span>
        </Link>
      ),
      filterValue: (r) => `${r.name} ${r.tl} ${r.code}`,
    },
    {
      key: 'pct', label: 'Calls vs target', width: '24%',
      render: (r) => (
        <div className="flex items-center gap-3 min-w-0">
          <span className="tabular-nums text-ink w-[76px] shrink-0"><b className="font-semibold">{fmtNum(r.done)}</b><span className="text-ink-3"> / {r.target ? fmtNum(r.target) : '—'}</span></span>
          {r.target > 0 && <Meter value={r.done} max={r.target} tone={r.tone} />}
        </div>
      ),
      searchable: false,
    },
    {
      key: 'gap', label: isToday ? 'Vs pace' : 'Vs target', align: 'right', width: '13%',
      render: (r) => r.target === 0 ? <span className="text-ink-4">No target</span>
        : r.tone === 'met' ? <span className="text-met font-medium">Target met</span>
        : clock.state === 'before' ? <span className="text-ink-3">—</span>
        : r.gap < 0 ? <span className="text-behind font-medium tabular-nums">{fmtNum(r.gap)}</span>
        : <span className="text-ink-2 tabular-nums">+{fmtNum(r.gap)}</span>,
      searchable: false,
    },
    { key: 'need', label: 'Need', align: 'right', width: '9%', searchable: false, render: (r) => (r.target ? fmtNum(r.need) : '—') },
    { key: 'connRate', label: 'Connected', align: 'right', width: '11%', searchable: false, render: (r) => (r.done ? `${r.connRate}%` : '—') },
    { key: 'missed', label: 'Missed', align: 'right', width: '9%', searchable: false, render: (r) => (r.missed ? <span className="text-behind tabular-nums">{fmtNum(r.missed)}</span> : <span className="text-ink-4">0</span>) },
    { key: 'last', label: 'Last call', align: 'right', width: '10%', searchable: false, render: (r) => (r.last ? <span className="tabular-nums">{fmtTime(r.last)}</span> : <span className="text-ink-4">—</span>) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={isToday
          ? `${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' })} · shift ${hourLabel(SHIFT_START)}–${hourLabel(SHIFT_END)} IST`
          : `${rangeLabel}${days ? ` · ${days} day${days > 1 ? 's' : ''}` : ''}`}
        actions={
          <>
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
            <button onClick={() => fetchStats(true)} disabled={refreshing} aria-label="Refresh" title="Refresh" className="btn-secondary btn-icon">
              <RefreshIco s={15} spinning={refreshing} />
            </button>
          </>
        }
      />

      {/* ── The chase ─────────────────────────────────────────── */}
      <section className="panel overflow-hidden" aria-label="Team call chase">
        <div className="grid grid-cols-2 lg:grid-cols-5 divide-line-2 lg:divide-x [&>*]:border-line-2 [&>*:nth-child(-n+4)]:border-b lg:[&>*]:border-b-0">
          {loadingStats ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-4"><div className="skeleton h-3.5 w-20" /><div className="skeleton h-7 w-24 mt-2.5" /><div className="skeleton h-3 w-28 mt-2" /></div>
          )) : (
            <>
              <Score label={isToday ? 'Calls today' : 'Calls'} value={fmtNum(done)}
                unit={teamTarget ? `/ ${fmtNum(teamTarget)}` : null}
                sub={teamTarget ? `${Math.round((done / teamTarget) * 100)}% of target${vsYest != null ? ` · ${vsYest >= 0 ? '+' : '−'}${Math.abs(vsYest)}% vs yesterday` : ''}` : 'No daily targets set'}
                tone={teamTarget && done >= teamTarget ? 'met' : null} />
              <Score label="Still needed" value={teamTarget ? fmtNum(need) : '—'}
                sub={!teamTarget ? 'Set targets in Daily targets' : need === 0 ? 'Target reached' : isToday && clock.state === 'live' ? `${fmtNum(Math.max(0, expectedNow - done))} behind pace now` : 'to reach target'}
                tone={teamTarget && need === 0 ? 'met' : null} />
              <Score label="Required rate" value={requiredRate != null ? fmtNum(requiredRate) : '—'} unit={requiredRate != null ? '/hr' : null}
                sub={clock.state === 'live' ? `${clock.hoursLeft.toFixed(1)} h left in shift` : clock.state === 'before' ? 'Shift not started' : isToday ? 'Shift over' : 'Today only'} />
              <Score label="Current rate" value={currentRate != null ? fmtNum(currentRate) : '—'} unit={currentRate != null ? '/hr' : null}
                sub={rateTone === 'behind' ? `${fmtNum(requiredRate - currentRate)}/hr short of required` : rateTone === 'met' ? 'On pace for target' : isToday ? 'Avg since shift start' : 'Today only'}
                tone={rateTone} />
              <Score className="col-span-2 lg:col-span-1" label="Connected" value={done ? `${Math.round(((selected?.connectedCalls || 0) / done) * 100)}%` : '—'}
                sub={`${fmtNum(selected?.connectedCalls || 0)} connected · ${fmtDur(selected?.callDurationSec)} talk`} />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 border-t border-line-2">
          {/* Worm */}
          <div className="xl:col-span-2 p-5 pb-3 xl:border-r border-line-2">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 mb-3">
              <div>
                <h2 className="panel-title">{isToday ? 'Today’s chase' : 'Cumulative calls by hour'}</h2>
                <p className="panel-sub">{isToday ? 'Calls so far against the target line, by IST hour' : `Summed across ${inline(rangeLabel)} against the target line`}</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-3">
                {teamTarget > 0 && (
                  <div className="seg" role="group" aria-label="Chart scale">
                    <button aria-pressed={!fitCalls} onClick={() => setFitCalls(false)}>Target scale</button>
                    <button aria-pressed={fitCalls} onClick={() => setFitCalls(true)}>Fit calls</button>
                  </div>
                )}
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-[var(--blue)]" />Actual</span>
                <span className="flex items-center gap-1.5"><span className="w-3 border-t border-dashed border-ink-4" />Target</span>
              </div>
            </div>
            <div className="h-[248px] -ml-2">
              {loadingStats ? <div className="skeleton h-full ml-2" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={worm} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="wormFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.14} />
                        <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#F1F0F5" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={14} tick={{ fontSize: 11.5 }} dy={4} />
                    <YAxis axisLine={false} tickLine={false} width={44} allowDecimals={false} allowDataOverflow domain={fitCalls ? [0, (max) => Math.max(10, Math.ceil(Math.max(...worm.map((w) => w.actual || 0)) * 1.15))] : [0, 'auto']} tickFormatter={(v) => fmtNum(v)} tick={{ fontSize: 11.5 }} />
                    <Tooltip content={<ChartTip />} cursor={{ stroke: '#D5D2DE', strokeDasharray: '3 3' }} />
                    {isToday && clock.state === 'live' && (
                      <ReferenceLine x={hourLabel(istNow().h)} stroke="#A19DB2" strokeDasharray="2 3"
                        label={{ value: 'Now', position: 'insideTopRight', fill: '#6B6880', fontSize: 11 }} />
                    )}
                    {teamTarget > 0 && (
                      <Line dataKey="target" name="Target" stroke="#A19DB2" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                    )}
                    <Area dataKey="actual" name="Actual" stroke="#7C3AED" strokeWidth={2} fill="url(#wormFill)" dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: '#7C3AED' }} connectNulls={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
            {emptyToday && (
              <div className="flex flex-wrap items-center justify-between gap-2 mt-2 px-3 py-2.5 rounded-lg bg-gray-50 text-[13px]">
                <span className="text-ink-2">No calls have synced today yet.{lastActiveDay && stats?.latestActivityDate ? ` Last activity was on ${stats.latestActivityDate}.` : ''}</span>
                {lastActiveDay && (
                  <button onClick={() => setDateRange({ range: 'custom', startDate: lastActiveDay, endDate: lastActiveDay })} className="btn-secondary btn-sm">
                    View {stats.latestActivityDate}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Behind the rate */}
          <div className="p-5 border-t xl:border-t-0 border-line-2 flex flex-col min-h-[240px]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="panel-title">Behind the rate</h2>
                <p className="panel-sub">{isToday ? 'Agents short of where they should be by now' : 'Agents short of their target'}</p>
              </div>
              {behind.length > 0 && <span className="badge bg-[var(--behind-50)] text-behind tabular-nums">{fmtNum(behind.length)}</span>}
            </div>
            {loadingStats ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-9" />)}</div>
            ) : behind.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                <p className="text-sm font-medium text-ink">{teamTarget ? (clock.state === 'before' ? 'Shift hasn’t started' : 'Everyone is on pace') : 'No targets to chase'}</p>
                <p className="text-[13px] text-ink-3 mt-1">{teamTarget ? 'Agents who fall behind their target pace show up here.' : 'Give agents a daily call target to track pace.'}</p>
                {!teamTarget && <Link href="/calls/targets" className="btn-secondary btn-sm mt-3">Set daily targets</Link>}
              </div>
            ) : (
              <>
                <ul className="-mx-2 flex-1">
                  {behind.slice(0, 6).map((a) => (
                    <li key={a.id}>
                      <Link href={`/employees/${a.id}`} className="flex items-center gap-3 px-2 h-11 rounded-lg hover:bg-gray-50 transition-colors duration-150">
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-medium text-ink truncate">{a.name}</span>
                          <span className="block text-xs text-ink-3 tabular-nums">{a.done === 0 ? 'No calls yet' : `${fmtNum(a.done)} of ${fmtNum(a.target)}`}</span>
                        </span>
                        <span className="text-[13px] font-semibold text-behind tabular-nums">{fmtNum(a.gap)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between pt-3 mt-auto text-xs text-ink-3">
                  <span>{notStarted > 0 ? `${fmtNum(notStarted)} not started` : `${fmtNum(behind.length)} behind`}</span>
                  <a href="#agents" className="font-medium text-[var(--blue)] hover:underline">All agents</a>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Agent chase table ─────────────────────────────────── */}
      <section id="agents" className="panel scroll-mt-20" aria-label="Agents">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Agents</h2>
            <p className="panel-sub">{fmtNum(agents.length)} active · {isToday ? 'pace is measured against the shift clock' : 'measured against target × days in range'}</p>
          </div>
          <Link href="/calls/targets" className="btn-ghost btn-sm">Manage targets</Link>
        </div>
        <div className="p-4 pt-3">
          <DataTable
            columns={agentColumns}
            rows={[...agents].sort((a, b) => (b.tone === 'behind') - (a.tone === 'behind') || (a.tone === 'behind' ? a.gap - b.gap : b.done - a.done))}
            loading={loadingStats || employees.length === 0 && !stats}
            pageSize={10}
            getRowId={(r) => r.id}
            emptyTitle="No active agents"
            emptyHint="Agents appear here once they are added and active."
          />
        </div>
      </section>

      {/* ── Mix + live feed ───────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="panel" aria-label="Call mix">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Call mix</h2>
              <p className="panel-sub">{rangeLabel} · {fmtNum(mixTotal)} calls</p>
            </div>
          </div>
          <div className="p-5">
            <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100" role="img" aria-label="Call type split">
              {mixTotal > 0 && mix.map((m) => m.value > 0 && (
                <span key={m.key} title={`${m.label} ${m.value}`} style={{ width: `${(m.value / mixTotal) * 100}%`, background: m.color }} className="h-full transition-[width] duration-500 ease-out first:rounded-l-full last:rounded-r-full" />
              ))}
            </div>
            <ul className="mt-4 -mx-2">
              {mix.map((m) => (
                <li key={m.key}>
                  <Link href={`/reports/calllogs?${new URLSearchParams({ fromDate, toDate, callType: m.key })}`}
                    className="flex items-center gap-3 h-10 px-2 rounded-lg hover:bg-gray-50 transition-colors duration-150">
                    <span className="w-2 h-2 rounded-sm" style={{ background: m.color }} />
                    <span className="flex-1 text-[13px] text-ink-2">{m.label}</span>
                    <span className="text-[13px] font-medium text-ink tabular-nums">{fmtNum(m.value)}</span>
                    <span className="w-10 text-right text-xs text-ink-3 tabular-nums">{mixTotal ? `${Math.round((m.value / mixTotal) * 100)}%` : '—'}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-line-2">
              <div><dt className="text-xs text-ink-3">Unique clients</dt><dd className="text-[15px] font-semibold text-ink tabular-nums mt-0.5">{fmtNum(selected?.uniqueClients || 0)}</dd></div>
              <div><dt className="text-xs text-ink-3">Avg call</dt><dd className="text-[15px] font-semibold text-ink tabular-nums mt-0.5">{fmtDur(selected?.avgDuration)}</dd></div>
              <div><dt className="text-xs text-ink-3">Never attended</dt><dd className="text-[15px] font-semibold text-ink tabular-nums mt-0.5">{fmtNum(selected?.neverAttended || 0)}</dd></div>
            </dl>
          </div>
        </section>

        <section className="panel xl:col-span-2 flex flex-col" aria-label="Live call feed">
          <div className="panel-head">
            <div>
              <h2 className="panel-title flex items-center gap-2">Latest calls {process.env.NEXT_PUBLIC_PUSHER_KEY && <span className="live-dot" title="Streaming" />}</h2>
              <p className="panel-sub">Newest synced calls across your agents</p>
            </div>
            <Link href="/calls/live" className="btn-ghost btn-sm">Live monitor</Link>
          </div>
          {liveFeed.length === 0 ? (
            <EmptyState title="No calls synced yet" hint="Calls appear here as agents' phones sync them." />
          ) : (
            <div className="overflow-auto max-h-[392px]">
              <table className="data-table">
                <thead className="sticky top-0 z-10">
                  <tr><th>Time</th><th>Agent</th><th className="hidden sm:table-cell">Contact</th><th>Type</th><th className="text-right hidden md:table-cell">Duration</th><th className="w-px" /></tr>
                </thead>
                <tbody>
                  {liveFeed.slice(0, 20).map((log, i) => {
                    const id = log._id || `${log.contactNumber}-${log.timestamp}`;
                    return (
                      <tr key={`${id}-${i}`} className={`group/feed ${freshIds.has(id) ? 'ct-flash' : ''}`}>
                        <td className="tabular-nums text-ink-3 whitespace-nowrap">{fmtTime(log.timestamp)}</td>
                        <td className="font-medium text-ink"><Truncate text={log.employeeName} max={20} /></td>
                        <td className="hidden sm:table-cell">
                          <span className="tabular-nums text-ink">{log.contactNumber}</span>
                          {log.contactName && log.contactName !== 'Unknown' && <span className="block text-xs text-ink-3"><Truncate text={log.contactName} max={22} /></span>}
                        </td>
                        <td><CallBadge type={log.callType} /></td>
                        <td className="text-right tabular-nums hidden md:table-cell">{log.duration ? `${Math.floor(log.duration / 60)}:${String(log.duration % 60).padStart(2, '0')}` : <span className="text-ink-4">—</span>}</td>
                        <td className="text-right">
                          {!log.leadId && (
                            <button onClick={() => setLeadModal(log)}
                              className="btn-ghost btn-sm opacity-100 lg:opacity-0 lg:group-hover/feed:opacity-100 focus:opacity-100 transition-opacity duration-150 whitespace-nowrap">
                              Create lead
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* ── Lead pipeline ─────────────────────────────────────── */}
      <section className="panel" aria-label="Lead pipeline">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Lead pipeline</h2>
            <p className="panel-sub">{fmtNum(totalLeads)} leads {dateRange.range === 'all' ? 'in total' : `created ${inline(rangeLabel)}`} · by status</p>
          </div>
          <Link href={`/reports/lead?fromDate=${fromDate}&toDate=${toDate}`} className="btn-ghost btn-sm">Leads report</Link>
        </div>
        {totalLeads === 0 && Object.keys(leadStats).length > 0 ? (
          <EmptyState title={`No leads created ${inline(rangeLabel)}`} hint="Pick a wider date range to see how leads are moving."
            action={<button onClick={() => setDateRange({ range: 'all', startDate: null, endDate: null })} className="btn-secondary btn-sm">Show all time</button>} />
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 px-5 py-3">
            {STATUSES.map((key) => {
              const count = leadStats[key];
              const st = statusStyle(key);
              return (
                <li key={key}>
                  <Link href={`/reports/lead?status=${key}&fromDate=${fromDate}&toDate=${toDate}`}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_64px] items-center gap-4 h-10 -mx-2 px-2 rounded-lg hover:bg-gray-50 transition-colors duration-150">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                      <span className="text-[13px] text-ink-2 truncate">{STATUS_LABELS[key]}</span>
                    </span>
                    <span className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <span className="block h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: count ? `${Math.max(2, (count / maxLead) * 100)}%` : 0, background: st.hex }} />
                    </span>
                    <span className="text-right text-[13px] font-medium text-ink tabular-nums">{count === undefined ? <span className="skeleton inline-block h-3 w-8" /> : fmtNum(count)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AnimatePresence>
        {leadModal && (
          <CreateLeadModal call={leadModal} employees={employees} onClose={(created) => {
            if (created) setLiveFeed((f) => f.map((l) => (l === leadModal ? { ...l, leadId: true } : l)));
            setLeadModal(null);
          }} />
        )}
      </AnimatePresence>
    </div>
  );
}
