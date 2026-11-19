'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../../../lib/api';
import { getAllEmployeesSafe } from '../../../../lib/employees';
import { StatCard, Skeleton, ChartTip, PhoneIco, CheckIco, UsersIco } from '../../../../components/report-shared';
import MultiSelect from '../../../../components/MultiSelect';

const PERIODS = [{ key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' }];

export default function EmployeePerformanceReportPage() {
  return (
    <Suspense fallback={null}>
      <EmployeePerformanceReportContent />
    </Suspense>
  );
}

function EmployeePerformanceReportContent() {
  const searchParams = useSearchParams();
  const empParam = searchParams.get('emp');

  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState('');
  const [period, setPeriod] = useState('week');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingEmp, setLoadingEmp] = useState(true);

  useEffect(() => {
    getAllEmployeesSafe(api).then(r => {
      const emps = Array.isArray(r) ? r : (r?.data?.data || []);
      setEmployees(emps);
      const preselect = empParam && emps.some(e => e._id === empParam) ? empParam : emps[0]?._id;
      if (preselect) setSelected(preselect);
    }).catch(() => {}).finally(() => setLoadingEmp(false));
  }, [empParam]);

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
    { label: 'Total Calls',    val: data?.totalCalls ?? '—',     color: '#7C3AED', icon: <PhoneIco s={16} /> },
    { label: 'Incoming',       val: data?.incoming ?? '—',       color: '#079455', icon: <PhoneIco s={16} /> },
    { label: 'Outgoing',       val: data?.outgoing ?? '—',       color: '#B54708', icon: <PhoneIco s={16} /> },
    { label: 'Missed',         val: data?.missed ?? '—',         color: '#D92D20', icon: <PhoneIco s={16} /> },
    { label: 'Connected',      val: data?.connectedCalls ?? '—', color: '#0E9384', icon: <CheckIco s={16} /> },
    { label: 'Unique Clients', val: data?.uniqueClients ?? '—',  color: '#524F63', icon: <UsersIco s={16} /> },
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
            <h1 className="page-title">Performance Report</h1>
          </div>
          <div className="flex items-center gap-2">
            {loadingEmp ? <Skeleton className="h-9 w-44 rounded-lg" /> : (
              <MultiSelect multiple={false} clearable={false} className="w-52" ariaLabel="Employee"
                value={selected} onChange={setSelected} options={employees.map((e) => [e._id, e.name])} />
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
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-100 text-ink-2 text-base font-semibold shrink-0"
                >
                {emp.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-bold text-base text-gray-900">{emp.name}</p>
                <p className="page-subtitle">{emp.role || 'Agent'} · {emp.phone || '—'}</p>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-20 rounded-full overflow-hidden bg-gray-100">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${connRate}%`, background: '#079455' }} />
                    </div>
                    <span className="text-xs font-semibold text-green-600">{connRate}% connect rate</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-16 rounded-full overflow-hidden bg-gray-100">
                      <div className="h-full rounded-full" style={{ width: `${missRate}%`, background: '#D92D20' }} />
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
              { label: 'Connection Rate', val: connRate, color: '#7C3AED' },
              { label: 'Miss Rate',       val: missRate, color: '#D92D20' },
              { label: 'Outgoing Share',  val: data?.totalCalls > 0 ? Math.round(((data.outgoing || 0) / data.totalCalls) * 100) : 0, color: '#7C3AED' },
              { label: 'Incoming Share',  val: data?.totalCalls > 0 ? Math.round(((data.incoming || 0) / data.totalCalls) * 100) : 0, color: '#0E9384' },
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#F4F3F8" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fill: '#A19DB2', fontSize: 9 }} tickFormatter={h => `${h % 12 || 12}${h >= 12 ? 'p' : 'a'}`} interval="preserveStartEnd" minTickGap={10} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#A19DB2', fontSize: 9 }} axisLine={false} tickLine={false} width={20} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="count" name="Calls" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-36 text-gray-500">
                <span className="text-sm">No hourly data</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
