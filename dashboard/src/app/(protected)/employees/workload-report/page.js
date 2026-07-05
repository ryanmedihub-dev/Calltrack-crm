'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../../../../lib/api';
import { StatCard, DataTable, ChartTip, Ico } from '../../../../components/report-shared';

const ActivityIco = ({ s = 16 }) => <Ico size={s}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></Ico>;

const PERIODS = [{ key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' }];

const WORKLOAD_LEVELS = [
  { min: 0, max: 10, label: 'Low', color: '#94A3B8', bg: '#F1F5F9', border: '#CBD5E1' },
  { min: 10, max: 30, label: 'Moderate', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { min: 30, max: 60, label: 'High', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { min: 60, max: Infinity, label: 'Very High', color: '#DC2626', bg: '#FFF1F2', border: '#FECACA' },
];

function getLevel(calls) {
  return WORKLOAD_LEVELS.find(l => calls >= l.min && calls < l.max) || WORKLOAD_LEVELS[0];
}

export default function WorkloadReportPage() {
  const [period, setPeriod] = useState('week');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [empRes, statsRes] = await Promise.allSettled([
          api.get('/api/employees'),
          api.get('/api/calls/stats'),
        ]);
        const emps = empRes.status === 'fulfilled' ? empRes.value.data?.data || [] : [];
        const stats = statsRes.status === 'fulfilled' ? statsRes.value.data?.data : null;
        const periodKey = period === 'today' ? 'topDialers' : period === 'week' ? 'thisWeek' : 'thisMonth';
        const dialers = stats?.today?.topDialers || stats?.[periodKey]?.topDialers || [];
        const processed = emps.map(e => {
          const dialer = dialers.find(d => d.employeeId === e._id);
          const calls = dialer?.count || 0;
          const level = getLevel(calls);
          return { id: e._id, name: e.name, role: e.role || 'Agent', calls, level };
        }).sort((a, b) => b.calls - a.calls);
        setData(processed);
      } catch { setData([]); }
      setLoading(false);
    })();
  }, [period]);

  const maxCalls = data[0]?.calls || 1;
  const totalCalls = data.reduce((s, d) => s + d.calls, 0);

  const levelSummary = WORKLOAD_LEVELS.slice(0, -1).map(l => ({
    ...l,
    count: data.filter(d => d.calls >= l.min && d.calls < l.max).length,
  }));

  const barData = data.slice(0, 15).map(d => ({
    name: d.name.split(' ')[0],
    calls: d.calls,
    fill: d.level.color,
  }));

  return (
    <div className="min-h-screen">
      <div className="space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              Employees <span className="text-gray-300">/</span> <span className="text-gray-500">Workload Report</span>
            </p>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5">Workload Report</h1>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${period === p.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {levelSummary.map((l) => (
            <StatCard
              key={l.label}
              label={`${l.label} Workload`}
              value={l.count}
              sub={`${l.min}–${l.max === Infinity ? '∞' : l.max} calls`}
              color={l.color}
              icon={<ActivityIco s={16} />}
              loading={loading}
            />
          ))}
        </div>

        {/* Bar chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Top 15 by Call Volume</h3>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
              {totalCalls} total calls
            </span>
          </div>
          {loading ? (
            <div className="h-48 rounded-xl bg-gray-100 animate-pulse" />
          ) : barData.length === 0 ? (
            <div className="flex items-center justify-center h-36 text-gray-400">
              <span className="text-sm">No call data available</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, barData.length * 28)}>
              <BarChart data={barData} barSize={20} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} tickLine={false} axisLine={false} width={72} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="calls" name="Calls" radius={[0, 5, 5, 0]}>
                  {barData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Full table */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">All Employees Workload</h3>
          <p className="text-xs text-gray-400 mb-3">Every employee's call volume and workload level</p>
          <DataTable
            loading={loading}
            emptyTitle="No employees found"
            columns={[
              {
                key: 'name', label: 'Employee',
                render: (r) => (
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0 bg-blue-600">
                      {r.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-semibold text-xs text-gray-900">{r.name}</span>
                  </div>
                ),
              },
              { key: 'role', label: 'Role', render: (r) => <span className="capitalize text-xs text-gray-500">{r.role}</span> },
              { key: 'calls', label: 'Calls', align: 'right', searchable: false, render: (r) => <span className="font-bold text-gray-900">{r.calls}</span> },
              {
                key: 'share', label: 'Share', sortable: false, searchable: false,
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 rounded-full overflow-hidden bg-gray-100">
                      <div className="h-full rounded-full" style={{ width: `${(r.calls / maxCalls) * 100}%`, background: r.level.color }} />
                    </div>
                    <span className="text-[11px] tabular-nums text-gray-400">{totalCalls > 0 ? Math.round((r.calls / totalCalls) * 100) : 0}%</span>
                  </div>
                ),
              },
              {
                key: 'level', label: 'Level', sortable: false, searchable: false,
                render: (r) => (
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: r.level.bg, color: r.level.color, border: `1px solid ${r.level.border}` }}>
                    {r.level.label}
                  </span>
                ),
              },
            ]}
            rows={data}
          />
        </div>
      </div>
    </div>
  );
}
