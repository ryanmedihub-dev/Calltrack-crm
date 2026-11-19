'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../../../../lib/api';
import { StatCard, DataTable, ChartTip, Ico, UsersIco, PhoneIco, TrophyIco } from '../../../../components/report-shared';

const ChevronRightIco = ({ s = 13 }) => <Ico size={s}><polyline points="9 18 15 12 9 6" /></Ico>;

const PERIODS = [{ key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' }];
const RANK_COLORS = ['#B54708', '#A19DB2', '#B45309'];
const RANK_BG = ['rgba(181,71,8,0.12)', 'rgba(148,163,184,0.12)', 'rgba(180,83,9,0.12)'];
const GRADIENT_COLORS = ['#7C3AED', '#7C3AED', '#C4B5FD', '#EDE9FE'].reverse();

export default function PerformanceReportsPage() {
  const [period, setPeriod] = useState('week');
  const [dialers, setDialers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get('/api/calls/stats');
        const d = r.data?.data;
        const key = period === 'today' ? 'today' : period === 'week' ? 'lastWeek' : 'lastMonth';
        setDialers(d?.[key]?.topDialers || d?.today?.topDialers || []);
      } catch { setDialers([]); }
      setLoading(false);
    })();
  }, [period]);

  const maxCalls = dialers[0]?.count || 1;
  const totalCalls = dialers.reduce((s, d) => s + d.count, 0) || 1;

  const barData = dialers.slice(0, 12).map(d => ({
    name: (d.name || '').split(' ')[0],
    calls: d.count,
    id: d.employeeId,
  }));

  const tableRows = dialers.map((d, i) => ({ ...d, id: d.employeeId || i, rank: i + 1 }));

  return (
    <div className="min-h-screen">
      <div className="space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="page-title">Performance Reports</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${period === p.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <Link href="/employees/performance-report"
              className="flex items-center gap-2 px-3.5 py-2 border border-gray-200 bg-white text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
              Individual Report
            </Link>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Active Agents" value={dialers.length} color="#7C3AED" icon={<UsersIco s={16} />} loading={loading} />
          <StatCard label="Total Calls" value={dialers.reduce((s, d) => s + d.count, 0).toLocaleString()} color="#079455" icon={<PhoneIco s={16} />} loading={loading} />
          <StatCard label="Avg per Agent" value={dialers.length ? Math.round(dialers.reduce((s, d) => s + d.count, 0) / dialers.length) : 0} color="#B54708" icon={<PhoneIco s={16} />} loading={loading} />
          <StatCard label="Top Performer" value={dialers[0]?.count || 0} color="#B54708" icon={<TrophyIco s={16} />} loading={loading} />
        </div>

        {/* Top 3 podium */}
        {!loading && dialers.length >= 3 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
            <p className="text-xs font-bold text-center mb-8 text-gray-500">Top Performers</p>
            <div className="flex items-end justify-center gap-8">
              {[
                dialers[1] ? { ...dialers[1], rank: 2 } : null,
                dialers[0] ? { ...dialers[0], rank: 1 } : null,
                dialers[2] ? { ...dialers[2], rank: 3 } : null,
              ].filter(Boolean).map(d => {
                const heights = { 1: '8rem', 2: '5.5rem', 3: '4rem' };
                const grads = {
                  1: '#B54708',
                  2: '#A19DB2',
                  3: '#FB923C',
                };
                return (
                  <div key={d.employeeId} className="flex flex-col items-center gap-2">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-100 text-ink-2 text-base font-semibold"
                        >
                        {(d.name || '?').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="absolute -top-2 -right-2"><span className="inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-semibold tabular-nums bg-[var(--blue-50)] text-[var(--blue)]">{d.rank}</span></span>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold max-w-[80px] truncate text-gray-900">{d.name}</p>
                      <span className="text-xs font-bold rounded-full px-2 py-0.5"
                        style={{ background: RANK_BG[d.rank - 1], color: RANK_COLORS[d.rank - 1] }}>
                        {d.count} calls
                      </span>
                    </div>
                    <div className="w-20 rounded-t-xl opacity-20" style={{ height: heights[d.rank], background: grads[d.rank] }} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Horizontal bar chart */}
        {!loading && barData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Call Volume — Top 12</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, barData.length * 32)}>
              <BarChart data={barData} barSize={20} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#F4F3F8" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#A19DB2' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#524F63', fontWeight: 600 }} tickLine={false} axisLine={false} width={72} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="calls" name="Calls" radius={[0, 5, 5, 0]}>
                  {barData.map((_, i) => <Cell key={i} fill={GRADIENT_COLORS[Math.min(i, GRADIENT_COLORS.length - 1)]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Full rankings */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Full Rankings</h3>
          <p className="text-xs text-gray-500 mb-3">Every employee ranked by call volume this period</p>
          <DataTable
            loading={loading}
            emptyTitle="No performance data for this period"
            columns={[
              {
                key: 'rank', label: 'Rank', sortable: false, searchable: false,
                render: (r) => r.rank <= 3
                  ? <span className="inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-semibold tabular-nums bg-[var(--blue-50)] text-[var(--blue)]">{r.rank}</span>
                  : <span className="font-bold text-xs text-gray-500">#{r.rank}</span>,
              },
              {
                key: 'name', label: 'Agent',
                render: (r) => (
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 bg-blue-600">
                      {(r.name || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-semibold text-sm text-gray-900">{r.name || 'Unknown'}</span>
                  </div>
                ),
              },
              { key: 'count', label: 'Calls', align: 'right', searchable: false, render: (r) => <span className="font-bold text-blue-600">{r.count}</span> },
              {
                key: 'share', label: 'Share', sortable: false, searchable: false,
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 rounded-full overflow-hidden bg-gray-100">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${(r.count / maxCalls) * 100}%` }} />
                    </div>
                    <span className="text-xs tabular-nums text-gray-500">{Math.round((r.count / totalCalls) * 100)}%</span>
                  </div>
                ),
              },
              {
                key: 'action', label: 'Action', sortable: false, searchable: false,
                render: (r) => (
                  <Link href={`/employees/performance-report?emp=${r.employeeId}`}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                    Detail <ChevronRightIco s={11} />
                  </Link>
                ),
              },
            ]}
            rows={tableRows}
          />
        </div>
      </div>
    </div>
  );
}
