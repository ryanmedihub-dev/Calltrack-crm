'use client';
import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../../lib/api';
import { triggerLocalExport } from '../../../../lib/downloads';
import { fmtDateTime } from '../../../../lib/timezone';
import {
  DataTable, StatCard, Skeleton, Field, ChartTip, CallBadge,
  DownloadIco, SearchIco, GridIco, ClipboardIco, BarChartTabIco,
  PhoneIco, CheckIco, XIco, UsersIco,
} from '../../../../components/report-shared';


const PERIODS = [{ k: 'today', l: 'Today' }, { k: 'week', l: 'This Week' }, { k: 'month', l: 'This Month' }];
const fmt = fmtDateTime;
const dur = (s) => (s ? `${Math.floor(s / 60)}m ${s % 60}s` : '—');

const TABS = [
  { key: 'summary', label: 'Summary', icon: <GridIco /> },
  { key: 'logs', label: 'Call Logs', icon: <ClipboardIco /> },
  { key: 'chart', label: 'Charts', icon: <BarChartTabIco /> },
];

export default function CallLogsReportPage() {
  const [period, setPeriod] = useState('week');
  const [stats, setStats] = useState(null);
  const [calls, setCalls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({ search: '', callType: '', employee: '' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('summary');
  const PER_PAGE = 25;

  const setF = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, callsRes] = await Promise.allSettled([
        api.get('/api/calls/stats'),
        api.get('/api/calls', { params: { page, limit: PER_PAGE, search: filters.search || undefined, callType: filters.callType || undefined, employee: filters.employee || undefined } }),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data?.data);
      if (callsRes.status === 'fulfilled') {
        setCalls(callsRes.value.data?.data?.calls || callsRes.value.data?.data || []);
        setTotal(callsRes.value.data?.data?.total || 0);
      }
    } catch {}
    setLoading(false);
  }, [period, page, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/api/employees').then((r) => setEmployees(r.data?.data || [])).catch(() => {}); }, []);

  const periodData = period === 'today' ? stats?.today : period === 'week' ? stats?.lastWeek : stats?.lastMonth;
  const totalPages = Math.ceil(total / PER_PAGE);

  const exportCSV = () => {
    const head = ['Employee', 'Contact', 'Type', 'Duration', 'Date', 'Connected'];
    const rows = calls.map((c) => [c.employeeName || '', c.contactNumber || '', c.callType || '', dur(c.duration), fmt(c.timestamp), c.isConnected || c.duration > 0 ? 'Yes' : 'No']);
    const csv = [head, ...rows].map((r) => r.join(',')).join('\n');
    triggerLocalExport({ label: 'Call Logs Report', filename: 'call-logs-report.csv', csv });
  };

  const kpis = [
    { label: 'Total Calls', val: periodData?.totalCalls, color: '#2563EB', icon: <PhoneIco s={16} /> },
    { label: 'Incoming', val: periodData?.incoming, color: '#16A34A', icon: <CheckIco s={16} /> },
    { label: 'Outgoing', val: periodData?.outgoing, color: '#D97706', icon: <PhoneIco s={16} /> },
    { label: 'Missed', val: periodData?.missed, color: '#DC2626', icon: <XIco s={16} /> },
    { label: 'Connected', val: periodData?.connectedCalls, color: '#0D9488', icon: <CheckIco s={16} /> },
    { label: 'Unique Clients', val: periodData?.uniqueClients, color: '#7C3AED', icon: <UsersIco s={16} /> },
  ];

  const summaryRows = [
    { id: 'total', metric: 'Total Calls', value: periodData?.totalCalls, color: '#2563EB' },
    { id: 'incoming', metric: 'Incoming', value: periodData?.incoming, color: '#16A34A' },
    { id: 'outgoing', metric: 'Outgoing', value: periodData?.outgoing, color: '#D97706' },
    { id: 'missed', metric: 'Missed', value: periodData?.missed, color: '#DC2626' },
    { id: 'rejected', metric: 'Rejected', value: periodData?.rejected, color: '#7C3AED' },
    { id: 'connected', metric: 'Connected', value: periodData?.connectedCalls, color: '#0D9488' },
    { id: 'unique', metric: 'Unique Clients', value: periodData?.uniqueClients, color: '#475569' },
    { id: 'workingHours', metric: 'Working Hours', value: periodData?.workingHours, color: '#475569' },
    { id: 'duration', metric: 'Total Duration', value: periodData?.callDuration, color: '#475569' },
  ];

  const clearFilters = () => { setFilters({ search: '', callType: '', employee: '' }); setPage(1); };

  return (
    <div className="min-h-screen">
      <div className="space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              Reports <span className="text-gray-300">/</span> <span className="text-gray-500">Call Logs Report</span>
            </p>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5">Call Logs Report</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {PERIODS.map((p) => (
                <button key={p.k} onClick={() => setPeriod(p.k)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${period === p.k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  {p.l}
                </button>
              ))}
            </div>
            <button onClick={exportCSV} className="flex items-center gap-2 px-3.5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium shadow-sm">
              <DownloadIco /> Export
            </button>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {kpis.map((k) => (
            <StatCard key={k.label} loading={loading} label={k.label} value={(k.val ?? 0).toLocaleString?.() ?? k.val ?? '—'} color={k.color} icon={k.icon} />
          ))}
        </div>

        {/* Tab nav */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <div className="flex gap-1 px-4 py-3">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative px-2 py-3.5 text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                  tab === t.key ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className={`flex items-center justify-center transition-transform ${tab === t.key ? 'scale-110' : ''}`}>{t.icon}</span>
                {t.label}
                {tab === t.key && <motion.span layoutId="callLogsTabUnderline" className="absolute left-3 right-3 -bottom-px h-[2.5px] bg-blue-600 rounded-full" />}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-5">

            {tab === 'chart' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-1">Calls Per Hour (Today)</h3>
                  <p className="text-xs text-gray-400 mb-3">Call volume distribution across the day</p>
                  {loading ? <Skeleton className="h-52 w-full" /> : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={stats?.callsPerHour || []} barCategoryGap="38%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                        <XAxis dataKey="hour" tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(h) => `${h}h`} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                        <Tooltip content={<ChartTip />} />
                        <Bar dataKey="count" name="Calls" fill="#2563EB" radius={[5, 5, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-1">Period Comparison</h3>
                  <p className="text-xs text-gray-400 mb-3">Total calls across recent periods</p>
                  {loading ? <Skeleton className="h-52 w-full" /> : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={[
                        { name: 'Today', calls: stats?.today?.totalCalls || 0 },
                        { name: 'Yesterday', calls: stats?.yesterday?.totalCalls || 0 },
                        { name: 'Last Week', calls: stats?.lastWeek?.totalCalls || 0 },
                      ]} barCategoryGap="40%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                        <Tooltip content={<ChartTip />} />
                        <Bar dataKey="calls" name="Calls" fill="#2563EB" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}

            {tab === 'summary' && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-1">Summary by Type</h3>
                <p className="text-xs text-gray-400 mb-3">Metrics for the selected period</p>
                <DataTable
                  loading={loading}
                  searchable={false}
                  pageSize={20}
                  columns={[
                    { key: 'metric', label: 'Metric', render: (r) => (
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: r.color }} />{r.metric}</div>
                    ) },
                    { key: 'value', label: 'Value', align: 'right', render: (r) => <span className="font-bold" style={{ color: r.color }}>{r.value ?? '—'}</span> },
                  ]}
                  rows={summaryRows}
                />
              </div>
            )}

            {tab === 'logs' && (
              <>
                {/* Filters */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Search">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><SearchIco /></span>
                        <input className="input pl-9" placeholder="Search number or name…" value={filters.search} onChange={(e) => setF('search', e.target.value)} />
                      </div>
                    </Field>
                    <Field label="Call Type">
                      <select className="input" value={filters.callType} onChange={(e) => setF('callType', e.target.value)}>
                        <option value="">All Types</option>
                        <option value="incoming">Incoming</option>
                        <option value="outgoing">Outgoing</option>
                        <option value="missed">Missed</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </Field>
                    <Field label="Employee">
                      <select className="input" value={filters.employee} onChange={(e) => setF('employee', e.target.value)}>
                        <option value="">All Employees</option>
                        {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="flex justify-end pt-3 mt-3 border-t border-gray-100">
                    <button onClick={clearFilters} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
                      Reset
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-1">Call Logs</h3>
                  <p className="text-xs text-gray-400 mb-3">Individual call records for the current filters</p>
                  <DataTable
                    loading={loading}
                    searchable={false}
                    pageSize={PER_PAGE}
                    emptyTitle="No calls found"
                    columns={[
                      { key: 'employeeName', label: 'Employee', render: (r) => (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                            {(r.employeeName || '?')[0].toUpperCase()}
                          </div>
                          <span className="text-xs font-semibold text-gray-900">{r.employeeName || '—'}</span>
                        </div>
                      ) },
                      { key: 'contactNumber', label: 'Contact', render: (r) => (
                        <div>
                          <p className="font-mono text-xs text-gray-700">{r.contactNumber || '—'}</p>
                          {r.contactName && r.contactName !== 'Unknown' && <p className="text-[11px] text-gray-400">{r.contactName}</p>}
                        </div>
                      ) },
                      { key: 'callType', label: 'Type', render: (r) => <CallBadge type={r.callType} /> },
                      { key: 'duration', label: 'Duration', align: 'right', render: (r) => dur(r.duration) },
                      { key: 'timestamp', label: 'Date & Time', render: (r) => fmt(r.timestamp) },
                    ]}
                    rows={calls}
                  />
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-3 px-1">
                      <span className="text-xs text-gray-400">Page {page} of {totalPages} · {total.toLocaleString()} records</span>
                      <div className="flex gap-1">
                        <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors">
                          Prev
                        </button>
                        <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors">
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid #E5E7EB;
          font-size: 0.8125rem;
          outline: none;
          background: white;
          transition: border-color 0.15s;
        }
        .input:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
      `}</style>
    </div>
  );
}
