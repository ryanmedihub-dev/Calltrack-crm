'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Pusher from 'pusher-js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../../../../lib/api';
import { getAllEmployeesSafe } from '../../../../lib/employees';
import { parseUTC } from '../../../../lib/timezone';
import { PageHeader, CallBadge, ChartTip, EmptyState, Truncate, fmtNum, Skeleton } from '../../../../components/report-shared';

const LIVE = !!process.env.NEXT_PUBLIC_PUSHER_KEY;
const fmtDur = (s) => (!s ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);
const fmtClock = (ts) => parseUTC(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }).toUpperCase();
const hourLabel = (h) => `${h % 12 || 12}${h >= 12 ? 'p' : 'a'}`;
const empId = (c) => String(c?.employeeId?._id ?? c?.employeeId ?? '');
function ago(ts) {
  const s = Math.max(0, Math.floor((Date.now() - parseUTC(ts)) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
const FILTERS = [['all', 'All'], ['outgoing', 'Outgoing'], ['incoming', 'Incoming'], ['missed', 'Missed'], ['rejected', 'Rejected']];

export default function LiveMonitorPage() {
  const [stats, setStats] = useState(null);
  const [liveFeed, setLiveFeed] = useState([]);
  const [fresh, setFresh] = useState(() => new Set());
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [, setTick] = useState(0);

  const fetchStats = async () => {
    try { const res = await api.get('/api/calls/stats'); setStats(res.data.data); } catch {}
  };

  useEffect(() => {
    (async () => {
      await Promise.all([
        fetchStats(),
        api.get('/api/calls/realtime').then((r) => setLiveFeed((r.data.data || []).slice(0, 50))).catch(() => {}),
        getAllEmployeesSafe(api).then(setEmployees).catch(() => {}),
      ]);
      setLoading(false);
    })();
    const interval = setInterval(fetchStats, 30000);
    const clock = setInterval(() => setTick((t) => t + 1), 30000); // keeps "x min ago" honest
    if (!LIVE) return () => { clearInterval(interval); clearInterval(clock); };
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2' });
    const channel = pusher.subscribe('managers');
    channel.bind('new_call_log', (data) => {
      const id = data._id || `${data.contactNumber}-${data.timestamp}`;
      setLiveFeed((prev) => [data, ...prev].slice(0, 50));
      setFresh((s) => new Set(s).add(id));
      setTimeout(() => setFresh((s) => { const n = new Set(s); n.delete(id); return n; }), 1600);
      fetchStats();
    });
    return () => { clearInterval(interval); clearInterval(clock); channel.unbind_all(); pusher.unsubscribe('managers'); pusher.disconnect(); };
  }, []);

  const today = stats?.today;
  const lastCallBy = useMemo(() => {
    const m = new Map();
    liveFeed.forEach((c) => { const id = empId(c); if (id && !m.has(id)) m.set(id, c); });
    return m;
  }, [liveFeed]);

  // Agent status: who has called recently. Green < 15 min, amber < 1 h, grey otherwise.
  const agents = useMemo(() => employees
    .filter((e) => e.role === 'employee' && e.isActive !== false)
    .map((e) => {
      const last = lastCallBy.get(String(e._id));
      const mins = last ? (Date.now() - parseUTC(last.timestamp)) / 60000 : Infinity;
      return { id: String(e._id), name: e.name, tl: e.tlName, last, mins, state: mins < 15 ? 'live' : mins < 60 ? 'recent' : 'idle' };
    })
    .sort((a, b) => a.mins - b.mins || a.name.localeCompare(b.name)), [employees, lastCallBy]);
  const activeHour = agents.filter((a) => a.mins < 60).length;

  const hourly = (today?.callsPerHour || []).filter((h) => h.hour >= 8 && h.hour <= 21).map((h) => ({ label: hourLabel(h.hour), calls: h.count }));
  const feed = filter === 'all' ? liveFeed : liveFeed.filter((c) => c.callType === filter);

  const comp = [
    ['Total calls', 'totalCalls'], ['Outgoing', 'outgoing'], ['Incoming', 'incoming'], ['Missed', 'missed'], ['Connected', 'connectedCalls'], ['Unique clients', 'uniqueClients'],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live monitor"
        description={
          <span className="inline-flex items-center gap-2">
            {LIVE ? <><span className="live-dot" />Streaming new calls as they sync</> : 'Refreshes every 30 seconds'}
          </span>
        }
        actions={<Link href="/reports/calllogs" className="btn-secondary">Calls report</Link>}
      />

      <section className="panel overflow-hidden" aria-label="Today so far">
        <div className="grid grid-cols-2 md:grid-cols-5 [&>*]:border-line-2 [&>*]:border-b md:[&>*]:border-b-0 md:divide-x divide-line-2">
          {[
            ['Calls today', fmtNum(today?.totalCalls || 0), `${fmtNum(today?.outgoing || 0)} out · ${fmtNum(today?.incoming || 0)} in`],
            ['Connected', today?.totalCalls ? `${Math.round(((today.connectedCalls || 0) / today.totalCalls) * 100)}%` : '—', `${fmtNum(today?.connectedCalls || 0)} calls`],
            ['Missed', fmtNum(today?.missed || 0), today?.neverAttended ? `${fmtNum(today.neverAttended)} never called back` : 'None unanswered'],
            ['Agents active', `${fmtNum(activeHour)}`, `called in the last hour · of ${fmtNum(agents.length)}`],
            ['Avg call', fmtDur(today?.avgDuration), `${today?.callDuration || '0s'} talk today`],
          ].map(([label, value, sub], i) => (
            <div key={label} className="px-5 py-4 min-w-0">
              <p className="stat-label">{label}</p>
              {loading ? <Skeleton className="h-7 w-16 mt-2" /> : <p className={`stat-number mt-1 ${i === 2 && today?.missed ? 'text-behind' : ''}`}>{value}</p>}
              <p className="text-xs text-ink-3 mt-1 truncate">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="panel xl:col-span-2 flex flex-col min-h-[520px]" aria-label="Live feed">
          <div className="panel-head flex-wrap">
            <div><h2 className="panel-title">Call feed</h2><p className="panel-sub">Newest first · last {fmtNum(liveFeed.length)} calls</p></div>
            <div className="seg" role="group" aria-label="Filter by call type">
              {FILTERS.map(([k, l]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
            </div>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-9" />)}</div>
          ) : feed.length === 0 ? (
            <EmptyState title={filter === 'all' ? 'No calls yet' : `No ${filter} calls in the feed`} hint={filter === 'all' ? 'Calls appear here the moment agents’ phones sync them.' : 'Switch the filter to see every call.'} />
          ) : (
            <div className="overflow-auto max-h-[560px]">
              <table className="data-table">
                <thead className="sticky top-0 z-10">
                  <tr><th className="w-[120px]">Time</th><th>Agent</th><th className="hidden md:table-cell">Contact</th><th>Type</th><th className="!text-right">Duration</th></tr>
                </thead>
                <tbody>
                  {feed.map((c, i) => {
                    const id = c._id || `${c.contactNumber}-${c.timestamp}`;
                    return (
                      <tr key={`${id}-${i}`} className={fresh.has(id) ? 'ct-flash' : ''}>
                        <td className="whitespace-nowrap">
                          <span className="block tabular-nums text-ink">{fmtClock(c.timestamp)}</span>
                          <span className="block text-xs text-ink-3">{ago(c.timestamp)}</span>
                        </td>
                        <td className="font-medium text-ink"><Truncate text={c.employeeName} max={22} /></td>
                        <td className="hidden md:table-cell">
                          <span className="tabular-nums text-ink">{c.contactNumber}</span>
                          {c.contactName && c.contactName !== 'Unknown' && <span className="block text-xs text-ink-3"><Truncate text={c.contactName} max={24} /></span>}
                        </td>
                        <td><CallBadge type={c.callType} /></td>
                        <td className="text-right tabular-nums">{fmtDur(c.duration)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel flex flex-col max-h-[640px]" aria-label="Agent status">
          <div className="panel-head">
            <div><h2 className="panel-title">Agents</h2><p className="panel-sub">By most recent call</p></div>
            <span className="flex items-center gap-3 text-xs text-ink-3">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[var(--met)]" />15m</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#F79009]" />1h</span>
            </span>
          </div>
          <ul className="overflow-y-auto px-3 py-2 flex-1">
            {loading ? Array.from({ length: 8 }).map((_, i) => <li key={i} className="skeleton h-11 my-1" />) : agents.length === 0 ? (
              <li className="text-center text-[13px] text-ink-3 py-10">No active agents</li>
            ) : agents.map((a) => (
              <li key={a.id}>
                <Link href={`/employees/${a.id}`} className="flex items-center gap-3 h-12 px-2 rounded-lg hover:bg-gray-50 transition-colors duration-150">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${a.state === 'live' ? 'bg-[var(--met)]' : a.state === 'recent' ? 'bg-[#F79009]' : 'bg-gray-300'}`} aria-label={a.state} />
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[13px] truncate ${a.state === 'idle' ? 'text-ink-2' : 'font-medium text-ink'}`}>{a.name}</span>
                    <span className="block text-xs text-ink-3 truncate">{a.last ? `${a.last.callType} · ${ago(a.last.timestamp)}` : 'No recent calls'}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="panel xl:col-span-2" aria-label="Hourly">
          <div className="panel-head"><div><h2 className="panel-title">Today by hour</h2><p className="panel-sub">IST · 8 AM to 9 PM</p></div></div>
          <div className="p-5 pb-3 h-[240px] -ml-2">
            {loading ? <Skeleton className="h-full ml-2" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid stroke="#F1F0F5" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} tick={{ fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} width={32} allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(124,58,237,0.05)' }} />
                  <Bar dataKey="calls" name="Calls" fill="#7C3AED" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="panel" aria-label="Period comparison">
          <div className="panel-head"><div><h2 className="panel-title">Compared</h2><p className="panel-sub">Today, last 7 and last 30 days</p></div></div>
          <table className="data-table">
            <thead><tr><th>Metric</th><th className="!text-right">Today</th><th className="!text-right">7 days</th><th className="!text-right">30 days</th></tr></thead>
            <tbody>
              {comp.map(([label, k]) => (
                <tr key={k}>
                  <td className="text-ink-2">{label}</td>
                  <td className="text-right tabular-nums font-medium text-ink">{fmtNum(today?.[k] || 0)}</td>
                  <td className="text-right tabular-nums">{fmtNum(stats?.lastWeek?.[k] || 0)}</td>
                  <td className="text-right tabular-nums">{fmtNum(stats?.lastMonth?.[k] || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
