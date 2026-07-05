'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, ComposedChart } from 'recharts';
import api from '../../../../lib/api';
import {
  StatCard, DataTable, ChartTip, Skeleton, Ico,
  PhoneIco, CheckIco,
} from '../../../../components/report-shared';

/* Page-specific icons — no shared equivalent */
const TrendIco = ({ s = 18 }) => <Ico size={s}><polyline points="1 6 10.5 15.5 15.5 10.5 23 18" /><polyline points="7 6 1 6 1 12" /></Ico>;
const XCircleIco = ({ s = 18 }) => <Ico size={s}><line x1="1" y1="1" x2="23" y2="23" /><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39" /></Ico>;

function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }

export default function AttemptReportsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/calls/stats')
      .then((r) => setStats(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = stats?.today;
  const yest = stats?.yesterday;
  const week = stats?.lastWeek;
  const month = stats?.thisMonth;

  const connRate = pct(today?.connectedCalls, today?.totalCalls);
  const missRate = pct(today?.missed, today?.totalCalls);
  const outConnRate = today?.outgoing ? pct(today?.connectedCalls, today?.outgoing) : 0;

  /* Hourly attempt data */
  const hourData = (stats?.callsPerHour || []).map((h) => ({
    hour: `${h.hour}:00`,
    attempts: h.count,
  }));

  /* Period trend */
  const periodTrend = [
    { period: 'Today', attempts: today?.totalCalls || 0, connected: today?.connectedCalls || 0, missed: today?.missed || 0 },
    { period: 'Yesterday', attempts: yest?.totalCalls || 0, connected: yest?.connectedCalls || 0, missed: yest?.missed || 0 },
    { period: 'Last Week', attempts: week?.totalCalls || 0, connected: week?.connectedCalls || 0, missed: week?.missed || 0 },
    { period: 'This Month', attempts: month?.totalCalls || 0, connected: month?.connectedCalls || 0, missed: month?.missed || 0 },
  ];

  /* Outcome distribution for the progress bars */
  const outcomes = today ? [
    { label: 'Connected', value: today.connectedCalls || 0, pct: pct(today.connectedCalls || 0, today.totalCalls), color: '#16A34A' },
    { label: 'Missed (no pickup)', value: today.missed || 0, pct: pct(today.missed || 0, today.totalCalls), color: '#DC2626' },
    { label: 'Rejected', value: today.rejected || 0, pct: pct(today.rejected || 0, today.totalCalls), color: '#7C3AED' },
    { label: 'Incoming only', value: today.incoming || 0, pct: pct(today.incoming || 0, today.totalCalls), color: '#2563EB' },
    { label: 'Outgoing attempts', value: today.outgoing || 0, pct: pct(today.outgoing || 0, today.totalCalls), color: '#D97706' },
  ] : [];

  const summaryRows = [
    { id: 'Today', period: 'Today', d: today },
    { id: 'Yesterday', period: 'Yesterday', d: yest },
    { id: 'Last Week', period: 'Last Week', d: week },
    { id: 'This Month', period: 'This Month', d: month },
  ];

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="space-y-5">
          <Skeleton className="h-8 w-56" />
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-56" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="space-y-5">

        {/* ── Header ── */}
        <div>
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            Reports <span className="text-gray-300">/</span> <span className="text-gray-500">Attempt Reports</span>
          </p>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">Attempt Reports</h1>
          <p className="text-xs text-gray-400 mt-0.5">Call attempt patterns, success rates &amp; outcome analysis</p>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total Attempts" value={today?.totalCalls ?? '—'} sub="Today" color="#2563EB" icon={<PhoneIco s={16} />} />
          <StatCard label="Success Rate" value={`${connRate}%`} sub={`${today?.connectedCalls || 0} connected`} color="#16A34A" icon={<CheckIco s={16} />} />
          <StatCard label="Outgoing Connect" value={`${outConnRate}%`} sub="Of outgoing calls" color="#D97706" icon={<TrendIco s={16} />} />
          <StatCard label="Missed / Rejected" value={(today?.missed || 0) + (today?.rejected || 0)} sub={`${missRate}% miss rate`} color="#DC2626" icon={<XCircleIco s={16} />} />
        </div>

        {/* ── Outcome distribution + Hourly pattern ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Outcome Distribution</h3>
            <p className="text-xs text-gray-400 mb-4">Today's call outcomes by category</p>
            <div className="space-y-4">
              {outcomes.map((o) => (
                <div key={o.label}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-gray-600">{o.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{o.value} calls</span>
                      <span className="font-bold" style={{ color: o.color }}>{o.pct}%</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-gray-100">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${o.pct}%`, background: o.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Hourly Attempt Pattern</h3>
            <p className="text-xs text-gray-400 mb-4">Call attempts by hour of day</p>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={hourData}>
                <defs>
                  <linearGradient id="attemptAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: '#94A3B8', fontSize: 9 }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="attempts" name="Attempts" stroke="#2563EB" strokeWidth={2.5}
                  fill="url(#attemptAreaGrad)" dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: '#2563EB' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Period trend comparison ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Attempt Trend Across Periods</h3>
          <p className="text-xs text-gray-400 mb-4">Total, connected &amp; missed across time ranges</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={periodTrend} barGap={4} barCategoryGap="32%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="period" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="attempts" name="Total Attempts" fill="#2563EB" radius={[4, 4, 0, 0]} opacity={0.85} />
              <Bar dataKey="connected" name="Connected" fill="#16A34A" radius={[4, 4, 0, 0]} />
              <Bar dataKey="missed" name="Missed" fill="#DC2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Summary stats table ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Attempt Summary by Period</h3>
          <p className="text-xs text-gray-400 mb-3">Side-by-side comparison of every period</p>
          <DataTable
            searchable={false}
            columns={[
              { key: 'period', label: 'Period' },
              { key: 'totalCalls', label: 'Total Attempts', align: 'right', render: (r) => <span className="font-semibold text-blue-600">{r.d?.totalCalls ?? '—'}</span> },
              { key: 'connectedCalls', label: 'Connected', align: 'right', render: (r) => <span style={{ color: '#0D9488' }}>{r.d?.connectedCalls ?? '—'}</span> },
              { key: 'connRate', label: 'Conn. Rate', align: 'right', render: (r) => <span className="font-semibold text-emerald-600">{r.d?.totalCalls ? `${pct(r.d.connectedCalls, r.d.totalCalls)}%` : '—'}</span> },
              { key: 'missed', label: 'Missed', align: 'right', render: (r) => <span className="text-red-600">{r.d?.missed ?? '—'}</span> },
              { key: 'missRate', label: 'Miss Rate', align: 'right', render: (r) => <span className="text-gray-400">{r.d?.totalCalls ? `${pct(r.d.missed, r.d.totalCalls)}%` : '—'}</span> },
              { key: 'uniqueClients', label: 'Unique Contacts', align: 'right', render: (r) => <span className="text-purple-600">{r.d?.uniqueClients ?? '—'}</span> },
            ]}
            rows={summaryRows}
          />
        </div>
      </div>
    </div>
  );
}
