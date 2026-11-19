'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../../../../lib/api';
import DateRangeFilter, { formatRangeLabel, rangeToDates } from '../../../../components/DateRangeFilter';
import { PageHeader, TYPE_META, fmtNum, Skeleton } from '../../../../components/report-shared';

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const trend = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);
const inline = (l) => (/^(today|yesterday|this week|all time)$/i.test(l) ? l.toLowerCase() : l);

const DESTINATIONS = [
  { href: '/calls/live', label: 'Live monitor', desc: 'Calls as they sync, agent by agent' },
  { href: '/reports/calllogs', label: 'Calls report', desc: 'Every call, filterable and exportable' },
  { href: '/calls/unsynced', label: 'Not synced', desc: 'Calls not yet linked to a lead' },
  { href: '/calls/targets', label: 'Daily targets', desc: 'Set and track each agent’s quota' },
  { href: '/reports/Employess', label: 'Employees report', desc: 'Per-agent performance over a period' },
  { href: '/calls/logs-report', label: 'Call logs', desc: 'Raw call log listing' },
];

function Score({ label, value, sub, d, goodWhenUp = true, loading }) {
  const good = d == null ? null : goodWhenUp ? d >= 0 : d <= 0;
  return (
    <div className="px-5 py-4 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="stat-label truncate">{label}</p>
        {d != null && d !== 0 && <span className={`text-xs font-medium tabular-nums ${good ? 'text-met' : 'text-behind'}`}>{d > 0 ? '+' : '−'}{Math.abs(d)}%</span>}
      </div>
      {loading ? <Skeleton className="h-7 w-16 mt-2" /> : <p className="stat-number mt-1">{value}</p>}
      {sub && <p className="text-xs text-ink-3 mt-1 truncate">{sub}</p>}
    </div>
  );
}

export default function CallsOverviewPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ range: 'today', startDate: null, endDate: null });

  useEffect(() => {
    const params = { range: dateRange.range };
    if (dateRange.range === 'custom') { params.startDate = dateRange.startDate; params.endDate = dateRange.endDate; }
    setLoading(true);
    api.get('/api/calls/stats', { params })
      .then((r) => setStats(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateRange]);

  const isToday = dateRange.range === 'today';
  const rangeLabel = formatRangeLabel(dateRange);
  const { fromDate, toDate } = rangeToDates(dateRange);
  const cur = stats?.selected || stats?.today;
  const yest = stats?.yesterday;
  const week = stats?.lastWeek;

  const rows = [
    { label: 'Total calls', k: 'totalCalls' },
    { label: 'Outgoing', k: 'outgoing', type: 'outgoing' },
    { label: 'Incoming', k: 'incoming', type: 'incoming' },
    { label: 'Missed', k: 'missed', type: 'missed', badWhenUp: true },
    { label: 'Connected', k: 'connectedCalls' },
    { label: 'Unique clients', k: 'uniqueClients' },
  ];

  const mix = ['outgoing', 'incoming', 'missed', 'rejected'].map((k) => ({ key: k, ...TYPE_META[k], value: cur?.[k] || 0 }));
  const mixTotal = mix.reduce((a, m) => a + m.value, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Calls overview" description={`How the floor is calling · ${rangeLabel}`}
        actions={<DateRangeFilter value={dateRange} onChange={setDateRange} />} />

      <section className="panel overflow-hidden" aria-label="Summary">
        <div className="grid grid-cols-2 md:grid-cols-5 [&>*]:border-line-2 [&>*]:border-b md:[&>*]:border-b-0 md:divide-x divide-line-2">
          <Score loading={loading} label="Calls" value={fmtNum(cur?.totalCalls || 0)} sub={isToday ? 'vs yesterday' : rangeLabel} d={isToday ? trend(cur?.totalCalls, yest?.totalCalls) : null} />
          <Score loading={loading} label="Connection rate" value={`${pct(cur?.connectedCalls, cur?.totalCalls)}%`} sub={`${fmtNum(cur?.connectedCalls || 0)} connected`} d={isToday ? trend(cur?.connectedCalls, yest?.connectedCalls) : null} />
          <Score loading={loading} label="Missed rate" value={`${pct(cur?.missed, cur?.totalCalls)}%`} sub={`${fmtNum(cur?.missed || 0)} missed`} />
          <Score loading={loading} label="Outgoing" value={fmtNum(cur?.outgoing || 0)} sub={cur?.outgoingDuration ? `${cur.outgoingDuration} talk` : null} d={isToday ? trend(cur?.outgoing, yest?.outgoing) : null} />
          <Score loading={loading} label="Incoming" value={fmtNum(cur?.incoming || 0)} sub={cur?.incomingDuration ? `${cur.incomingDuration} talk` : null} d={isToday ? trend(cur?.incoming, yest?.incoming) : null} />
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="panel xl:col-span-2" aria-label="Period comparison">
          <div className="panel-head">
            <div><h2 className="panel-title">Period comparison</h2><p className="panel-sub">{rangeLabel} against yesterday and the last 7 days</p></div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th className="!text-right">{rangeLabel}</th>
                <th className="!text-right">Yesterday</th>
                <th className="!text-right">Last 7 days</th>
                <th className="!text-right">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const t = cur?.[r.k] || 0, y = yest?.[r.k] || 0, w = week?.[r.k] || 0;
                const ch = isToday ? trend(t, y) : null;
                const good = ch == null ? null : r.badWhenUp ? ch <= 0 : ch >= 0;
                return (
                  <tr key={r.k}>
                    <td>
                      <span className="flex items-center gap-2 text-ink-2">
                        {r.type ? <span className="w-2 h-2 rounded-sm" style={{ background: TYPE_META[r.type].color }} /> : <span className="w-2" />}
                        {r.label}
                      </span>
                    </td>
                    <td className="text-right tabular-nums font-medium text-ink">{loading ? <Skeleton className="h-3.5 w-10 ml-auto" /> : fmtNum(t)}</td>
                    <td className="text-right tabular-nums">{fmtNum(y)}</td>
                    <td className="text-right tabular-nums">{fmtNum(w)}</td>
                    <td className={`text-right tabular-nums ${ch == null || ch === 0 ? 'text-ink-4' : good ? 'text-met' : 'text-behind'}`}>
                      {ch == null ? '—' : `${ch > 0 ? '+' : ch < 0 ? '−' : ''}${Math.abs(ch)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="panel" aria-label="Call mix">
          <div className="panel-head"><div><h2 className="panel-title">Call mix</h2><p className="panel-sub">{fmtNum(mixTotal)} calls {inline(rangeLabel)}</p></div></div>
          <div className="p-5">
            <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100">
              {mixTotal > 0 && mix.map((m) => m.value > 0 && <span key={m.key} style={{ width: `${(m.value / mixTotal) * 100}%`, background: m.color }} className="h-full transition-[width] duration-500 ease-out" />)}
            </div>
            <ul className="mt-4 -mx-2">
              {mix.map((m) => (
                <li key={m.key}>
                  <Link href={`/reports/calllogs?${new URLSearchParams({ fromDate, toDate, callType: m.key })}`}
                    className="flex items-center gap-3 h-10 px-2 rounded-lg hover:bg-gray-50 transition-colors duration-150">
                    <span className="w-2 h-2 rounded-sm" style={{ background: m.color }} />
                    <span className="flex-1 text-[13px] text-ink-2">{m.label}</span>
                    <span className="text-[13px] font-medium text-ink tabular-nums">{fmtNum(m.value)}</span>
                    <span className="w-10 text-right text-xs text-ink-3 tabular-nums">{mixTotal ? `${pct(m.value, mixTotal)}%` : '—'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <section className="panel" aria-label="Call pages">
        <div className="panel-head"><h2 className="panel-title">Go to</h2></div>
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 px-3 py-2">
          {DESTINATIONS.map((p) => (
            <li key={p.href + p.label}>
              <Link href={p.href} className="group/go flex items-center gap-3 px-2 h-14 rounded-lg hover:bg-gray-50 transition-colors duration-150">
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium text-ink group-hover/go:text-[var(--blue)] transition-colors">{p.label}</span>
                  <span className="block text-xs text-ink-3 truncate">{p.desc}</span>
                </span>
                <svg className="text-ink-4 transition-transform duration-150 group-hover/go:translate-x-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
