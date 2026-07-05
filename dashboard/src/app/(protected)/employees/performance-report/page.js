'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../../../lib/api';
import { StatCard, Skeleton, ChartTip, PhoneIco, CheckIco, UsersIco } from '../../../../components/report-shared';

const PERIODS = [{ key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' }];

export default function EmployeePerformanceReportPage() {
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState('');
  const [period, setPeriod] = useState('week');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingEmp, setLoadingEmp] = useState(true);

  useEffect(() => {
    api.get('/api/employees').then(r => {
      const emps = r.data?.data || [];
      setEmployees(emps);
      if (emps.length) setSelected(emps[0]._id);
    }).catch(() => {}).finally(() => setLoadingEmp(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    api.get('/api/calls/stats', { params: { employee: selected } })
      .then(r => setStats(r.data?.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [selected, period]);

  const emp = employees.find(e => e._id === selected);
  const data = period === 'today' ? stats?.today : period === 'week' ? stats?.lastWeek : stats?.lastMonth;

  const metrics = [
    { label: 'Total Calls',    val: data?.totalCalls ?? '—',     color: '#2563EB', icon: <PhoneIco s={16} /> },
    { label: 'Incoming',       val: data?.incoming ?? '—',       color: '#16A34A', icon: <PhoneIco s={16} /> },
    { label: 'Outgoing',       val: data?.outgoing ?? '—',       color: '#D97706', icon: <PhoneIco s={16} /> },
    { label: 'Missed',         val: data?.missed ?? '—',         color: '#DC2626', icon: <PhoneIco s={16} /> },
    { label: 'Connected',      val: data?.connectedCalls ?? '—', color: '#0D9488', icon: <CheckIco s={16} /> },
    { label: 'Unique Clients', val: data?.uniqueClients ?? '—',  color: '#7C3AED', icon: <UsersIco s={16} /> },
  ];

  const hourlyData = stats?.callsPerHour || [];

  const connRate = data?.totalCalls > 0 ? Math.round(((data.connectedCalls || 0) / data.totalCalls) * 100) : 0;
  const missRate = data?.totalCalls > 0 ? Math.round(((data.missed || 0) / data.totalCalls) * 100) : 0;

  return (
    <div className="min-h-screen">
      <div className="space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              Employees <span className="text-gray-300">/</span> <span className="text-gray-500">Performance Report</span>
            </p>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5">Performance Report</h1>
          </div>
          <div className="flex items-center gap-2">
            {loadingEmp ? <Skeleton className="h-9 w-44 rounded-lg" /> : (
              <select
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 bg-white outline-none focus:border-blue-400 w-48"
                value={selected} onChange={e => setSelected(e.target.value)}
              >
                {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
              </select>
            )}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${period === p.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Employee card */}
        {emp && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black shrink-0"
                style={{ background: 'linear-gradient(135deg,#2563EB,#60A5FA)' }}>
                {emp.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-bold text-base text-gray-900">{emp.name}</p>
                <p className="text-sm text-gray-500">{emp.role || 'Agent'} · {emp.phone || '—'}</p>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-20 rounded-full overflow-hidden bg-gray-100">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${connRate}%`, background: '#16A34A' }} />
                    </div>
                    <span className="text-xs font-semibold text-green-600">{connRate}% connect rate</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-16 rounded-full overflow-hidden bg-gray-100">
                      <div className="h-full rounded-full" style={{ width: `${missRate}%`, background: '#DC2626' }} />
                    </div>
                    <span className="text-xs font-semibold text-red-600">{missRate}% miss rate</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {metrics.map((m) => (
            <StatCard key={m.label} label={m.label} value={m.val} color={m.color} icon={m.icon} loading={loading} />
          ))}
        </div>

        {/* Performance indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Performance Score</h3>
            {[
              { label: 'Connection Rate', val: connRate, color: '#16A34A' },
              { label: 'Miss Rate',       val: missRate, color: '#DC2626' },
              { label: 'Outgoing Share',  val: data?.totalCalls > 0 ? Math.round(((data.outgoing || 0) / data.totalCalls) * 100) : 0, color: '#D97706' },
              { label: 'Incoming Share',  val: data?.totalCalls > 0 ? Math.round(((data.incoming || 0) / data.totalCalls) * 100) : 0, color: '#2563EB' },
            ].map(r => (
              <div key={r.label} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">{r.label}</span>
                  <span className="text-xs font-bold tabular-nums" style={{ color: r.color }}>{r.val}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-gray-100">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${r.val}%`, background: r.color }} />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Hourly Distribution</h3>
            {hourlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={hourlyData} barCategoryGap="38%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fill: '#94A3B8', fontSize: 9 }} tickFormatter={h => `${h}h`} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 9 }} axisLine={false} tickLine={false} width={20} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="count" name="Calls" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-36 text-gray-400">
                <span className="text-sm">No hourly data</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
