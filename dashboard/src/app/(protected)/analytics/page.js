'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../../../lib/api';
import { getAllEmployeesSafe } from '../../../lib/employees';
import { DataTable, TLFilter, PageHeader, ChartTip, TYPE_META, fmtNum, Skeleton } from '../../../components/report-shared';
import DateRangeFilter, { formatRangeLabel } from '../../../components/DateRangeFilter';

// callsPerHour buckets are already IST hours (the API groups with timezone 'Asia/Kolkata');
// the old page ran them through a UTC→IST converter and shifted every hour by 5½.
const hourLabel = (h) => `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;
const pct = (num, den) => (den ? Math.round((num / den) * 100) : 0);
const delta = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);
const fmtDur = (s) => (!s ? '0s' : s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`);
const initials = (n) => (n || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
// `b` may hold several team leads from the multi-select ("Rahul,Priya").
const sameTL = (a, b) => String(b || '').split(',').some((t) => (a || '').trim().toLowerCase() === t.trim().toLowerCase());

function Metric({ label, value, sub, d, goodWhenUp = true, loading }) {
  const good = d == null ? null : goodWhenUp ? d >= 0 : d <= 0;
  return (
    <div className="px-5 py-4 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="stat-label truncate">{label}</p>
        {d != null && d !== 0 && (
          <span className={`text-xs font-medium tabular-nums ${good ? 'text-met' : 'text-behind'}`}>{d > 0 ? '+' : '−'}{Math.abs(d)}%</span>
        )}
      </div>
      {loading ? <Skeleton className="h-7 w-20 mt-2" /> : <p className="stat-number mt-1">{value}</p>}
      {sub && <p className="text-xs text-ink-3 mt-1 truncate">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ range: 'today', startDate: null, endDate: null });
  const [tlFilter, setTlFilter] = useState('');

  useEffect(() => {
    const params = { range: dateRange.range };
    if (dateRange.range === 'custom') { params.startDate = dateRange.startDate; params.endDate = dateRange.endDate; }
    setLoading(true);
    api.get('/api/calls/stats', { params })
      .then((s) => setStats(s.data.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [dateRange]);

  useEffect(() => { getAllEmployeesSafe(api).then(setEmployees).catch(() => { }); }, []);

  const isToday = dateRange.range === 'today';
  const d = stats?.selected || stats?.today;
  const today = stats?.today;
  const yest = stats?.yesterday;
  const week = stats?.lastWeek;
  const periodLabel = formatRangeLabel(dateRange);

  const connRate = pct(d?.connectedCalls, d?.totalCalls);
  const missRate = pct(d?.missed, d?.totalCalls);
  const peak = (d?.callsPerHour || []).reduce((a, b) => (b.count > a.count ? b : a), { hour: 0, count: 0 });

  const hours = useMemo(() => {
    const ph = d?.callsPerHour || [];
    const active = ph.filter((h) => h.count > 0).map((h) => h.hour);
    const lo = Math.min(8, ...(active.length ? active : [8]));
    const hi = Math.max(21, ...(active.length ? active : [21]));
    return ph.filter((h) => h.hour >= lo && h.hour <= hi).map((h) => ({ label: hourLabel(h.hour), calls: h.count, peak: h.count > 0 && h.hour === peak.hour }));
  }, [d, peak.hour]);

  const outcomes = d ? [
    { key: 'connected', label: 'Connected', value: d.connectedCalls || 0, color: '#079455' },
    { key: 'notPickup', label: 'Not picked up', value: d.notPickupByClient || 0, color: '#A19DB2' },
    { key: 'missed', label: 'Missed', value: d.missed || 0, color: TYPE_META.missed.color },
    { key: 'rejected', label: 'Rejected', value: d.rejected || 0, color: TYPE_META.rejected.color },
  ] : [];
  const outcomeTotal = d?.totalCalls || 0;

  const periodComp = stats ? [
    { name: 'Today', Outgoing: today?.outgoing || 0, Incoming: today?.incoming || 0, Missed: today?.missed || 0 },
    { name: 'Yesterday', Outgoing: yest?.outgoing || 0, Incoming: yest?.incoming || 0, Missed: yest?.missed || 0 },
    { name: 'Last 7 days', Outgoing: week?.outgoing || 0, Incoming: week?.incoming || 0, Missed: week?.missed || 0 },
  ] : [];

  const quality = [
    { label: 'Connection rate', t: pct(today?.connectedCalls, today?.totalCalls), y: pct(yest?.connectedCalls, yest?.totalCalls), up: true },
    { label: 'Missed rate', t: pct(today?.missed, today?.totalCalls), y: pct(yest?.missed, yest?.totalCalls), up: false },
    { label: 'Outgoing share', t: pct(today?.outgoing, today?.totalCalls), y: pct(yest?.outgoing, yest?.totalCalls), up: true },
    { label: 'Incoming share', t: pct(today?.incoming, today?.totalCalls), y: pct(yest?.incoming, yest?.totalCalls), up: null },
  ];

  // Every employee from employeeStats (not just the top-5 dialers).
  const agentRows = useMemo(() => {
    const byId = new Map((d?.employeeStats || []).map((s) => [s.employeeId, s]));
    return employees
      .filter((e) => !tlFilter || sameTL(e.tlName, tlFilter))
      .map((e) => {
        const s = byId.get(String(e._id));
        return { ...e, callCount: s?.count ?? 0, connRate: s?.count ? s.connRate : null, missedCount: s?.count ? s.missed : null, targetAchievement: s?.targetAchievement ?? null };
      })
      .sort((a, b) => b.callCount - a.callCount);
  }, [employees, d, tlFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description={`Call performance and agent trends · ${periodLabel}`}
        actions={<><TLFilter value={tlFilter} onChange={setTlFilter} /><DateRangeFilter value={dateRange} onChange={setDateRange} /></>}
      />

      <section className="panel overflow-hidden" aria-label="Key metrics">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 [&>*]:border-line-2 [&>*]:border-b xl:[&>*]:border-b-0 xl:divide-x divide-line-2">
          <Metric loading={loading} label="Calls" value={fmtNum(d?.totalCalls || 0)} sub={isToday ? 'vs yesterday' : periodLabel} d={isToday ? delta(today?.totalCalls, yest?.totalCalls) : null} />
          <Metric loading={loading} label="Connection rate" value={`${connRate}%`} sub={`${fmtNum(d?.connectedCalls || 0)} connected`} d={isToday ? delta(connRate, pct(yest?.connectedCalls, yest?.totalCalls)) : null} />
          <Metric loading={loading} label="Missed rate" value={`${missRate}%`} sub={`${fmtNum(d?.missed || 0)} missed`} d={isToday ? delta(missRate, pct(yest?.missed, yest?.totalCalls)) : null} goodWhenUp={false} />
          <Metric loading={loading} label="Avg call" value={fmtDur(d?.avgDuration)} sub={`${d?.callDuration || '0s'} talk time`} />
          <Metric loading={loading} label="Unique clients" value={fmtNum(d?.uniqueClients || 0)} sub={periodLabel} d={isToday ? delta(today?.uniqueClients, yest?.uniqueClients) : null} />
          <Metric loading={loading} label="Peak hour" value={peak.count ? hourLabel(peak.hour) : '—'} sub={peak.count ? `${fmtNum(peak.count)} calls in that hour` : 'No calls yet'} />
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="panel xl:col-span-2" aria-label="Hourly activity">
          <div className="panel-head">
            <div><h2 className="panel-title">Calls by hour</h2><p className="panel-sub">{periodLabel} · IST · busiest hour in blue</p></div>
          </div>
          <div className="p-5 pb-3 h-[280px] -ml-2">
            {loading ? <Skeleton className="h-full ml-2" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hours} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid stroke="#F1F0F5" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} tick={{ fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} width={40} allowDecimals={false} tickFormatter={fmtNum} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(124,58,237,0.05)' }} />
                  <Bar dataKey="calls" name="Calls" radius={[3, 3, 0, 0]} isAnimationActive={false}
                    shape={(p) => <rect x={p.x} y={p.y} width={p.width} height={Math.max(0, p.height)} rx={3} fill={p.payload.peak ? '#7C3AED' : '#DDD6FE'} />} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="panel" aria-label="Outcomes">
          <div className="panel-head"><div><h2 className="panel-title">Outcomes</h2><p className="panel-sub">{fmtNum(outcomeTotal)} calls · {periodLabel}</p></div></div>
          <div className="p-5">
            {loading ? <Skeleton className="h-40" /> : outcomeTotal === 0 ? (
              <div className="h-40 rounded-lg bg-gray-50 flex items-center justify-center text-[13px] text-ink-3">No calls in this period</div>
            ) : (
              <ul className="space-y-4">
                {outcomes.map((o) => (
                  <li key={o.key}>
                    <div className="flex items-baseline justify-between text-[13px] mb-1.5">
                      <span className="flex items-center gap-2 text-ink-2"><span className="w-2 h-2 rounded-sm" style={{ background: o.color }} />{o.label}</span>
                      <span className="tabular-nums"><b className="font-medium text-ink">{fmtNum(o.value)}</b><span className="text-ink-3 ml-2">{pct(o.value, outcomeTotal)}%</span></span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct(o.value, outcomeTotal)}%`, background: o.color }} /></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="panel xl:col-span-2" aria-label="Period comparison">
          <div className="panel-head">
            <div><h2 className="panel-title">Period comparison</h2><p className="panel-sub">Today, yesterday and the last 7 days by call type</p></div>
            <div className="flex items-center gap-4 text-xs text-ink-3">
              {['outgoing', 'incoming', 'missed'].map((k) => <span key={k} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: TYPE_META[k].color }} />{TYPE_META[k].label}</span>)}
            </div>
          </div>
          <div className="p-5 pb-3 h-[260px] -ml-2">
            {loading ? <Skeleton className="h-full ml-2" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodComp} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={3} barCategoryGap="30%">
                  <CartesianGrid stroke="#F1F0F5" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} width={44} allowDecimals={false} tickFormatter={fmtNum} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(26,23,38,0.03)' }} />
                  {['Outgoing', 'Incoming', 'Missed'].map((k) => (
                    <Bar key={k} dataKey={k} fill={TYPE_META[k.toLowerCase()].color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="panel" aria-label="Call quality">
          <div className="panel-head"><div><h2 className="panel-title">Call quality</h2><p className="panel-sub">Today against yesterday</p></div></div>
          <table className="data-table">
            <thead><tr><th>Metric</th><th className="!text-right">Today</th><th className="!text-right">Yesterday</th></tr></thead>
            <tbody>
              {quality.map((q) => {
                const diff = q.t - q.y;
                const tone = q.up == null || diff === 0 ? 'text-ink-3' : (q.up ? diff > 0 : diff < 0) ? 'text-met' : 'text-behind';
                return (
                  <tr key={q.label}>
                    <td className="text-ink-2">{q.label}</td>
                    <td className="text-right tabular-nums"><b className="font-medium text-ink">{q.t}%</b>{diff !== 0 && <span className={`ml-1.5 text-xs ${tone}`}>{diff > 0 ? '+' : '−'}{Math.abs(diff)}</span>}</td>
                    <td className="text-right tabular-nums text-ink-3">{q.y}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>

      <section className="panel" aria-label="Agent performance">
        <div className="panel-head">
          <div><h2 className="panel-title">Agent performance</h2><p className="panel-sub">{fmtNum(agentRows.length)} agents{tlFilter ? ` under ${tlFilter}` : ''} · {periodLabel}</p></div>
          <Link href="/employees/leaderboard" className="btn-ghost btn-sm">Leaderboard</Link>
        </div>
        <div className="p-4 pt-3">
          <DataTable
            loading={loading && !stats}
            rows={agentRows}
            getRowId={(e) => e._id}
            emptyTitle={tlFilter ? `No agents under ${tlFilter}` : 'No employees yet'}
            columns={[
              { key: '__idx', label: '#', sortable: false, searchable: false, width: 56, render: (_e, i) => <span className="text-ink-3 tabular-nums">{i + 1}</span> },
              {
                key: 'name', label: 'Agent', width: '26%',
                filterValue: (e) => `${e.name} ${e.email || ''}`,
                render: (e) => (
                  <Link href={`/employees/${e._id}`} className="flex items-center gap-3 min-w-0 group/a">
                    <span className="w-8 h-8 rounded-full bg-gray-100 text-ink-2 flex items-center justify-center text-xs font-semibold shrink-0">{initials(e.name)}</span>
                    <span className="min-w-0">
                      <span className="block font-medium text-ink truncate group-hover/a:text-[var(--blue)]">{e.name}</span>
                      <span className="block text-xs text-ink-3 truncate">{e.ryanEmployeeCode || e.email}</span>
                    </span>
                  </Link>
                ),
              },
              {
                key: 'tlName', label: 'Team lead', filterType: 'select',
                filterOptions: [...new Set(agentRows.map((e) => e.tlName).filter(Boolean))].sort(),
                render: (e) => e.tlName || <span className="text-ink-4">—</span>,
              },
              { key: 'callCount', label: 'Calls', align: 'right', searchable: false, render: (e) => <span className={e.callCount ? 'font-semibold text-ink' : 'text-ink-4'}>{fmtNum(e.callCount)}</span> },
              {
                key: 'connRate', label: 'Connected', align: 'right', searchable: false, width: 150,
                render: (e) => e.connRate == null ? <span className="text-ink-4">—</span> : (
                  <span className="inline-flex items-center gap-2 justify-end">
                    <span className="progress-bar w-14 hidden sm:block"><span className="progress-fill block" style={{ width: `${e.connRate}%` }} /></span>
                    <span className="tabular-nums w-11">{e.connRate}%</span>
                  </span>
                ),
              },
              { key: 'missedCount', label: 'Missed', align: 'right', searchable: false, render: (e) => e.missedCount ? <span className="text-behind tabular-nums">{fmtNum(e.missedCount)}</span> : <span className="text-ink-4">{e.missedCount == null ? '—' : 0}</span> },
              {
                key: 'targetAchievement', label: 'Of target', align: 'right', searchable: false,
                render: (e) => e.targetAchievement == null ? <span className="text-ink-4">—</span>
                  : <span className={`tabular-nums font-medium ${e.targetAchievement >= 100 ? 'text-met' : 'text-ink'}`}>{e.targetAchievement}%</span>,
              },
              {
                key: 'isActive', label: 'Status', searchable: false,
                render: (e) => (
                  <span className="inline-flex items-center gap-1.5 text-[13px]">
                    <span className={`w-1.5 h-1.5 rounded-full ${e.isActive !== false ? 'bg-[var(--met)]' : 'bg-gray-300'}`} />
                    <span className={e.isActive !== false ? 'text-ink-2' : 'text-ink-3'}>{e.isActive !== false ? 'Active' : 'Inactive'}</span>
                  </span>
                ),
              },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
