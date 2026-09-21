'use client';
import { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, LabelList,
} from 'recharts';
import api from '../../../../lib/api';
import { triggerServerExport } from '../../../../lib/downloads';
import Pagination from '../../../../components/Pagination';
import {
  DataTable, StatCard, ChartTip, EmptyState, InsightCard, Field, Skeleton, TLFilter, Truncate,
  PhoneIco, UsersIco, CheckIco, GaugeIco, TrophyIco, ClockIco, DownloadIco,
  GridIco, BarChartTabIco, CalendarTabIco, ClockTabIco, NoEntryIco, ClipboardIco,
} from '../../../../components/report-shared';
import { Phone, CheckCircle, PhoneOff, TrendingUp, Search, ArrowRight, Users } from 'lucide-react';

const TABS = [
  { key: 'summary',  label: 'Summary',           icon: <GridIco /> },
  { key: 'analysis', label: 'Analysis',          icon: <BarChartTabIco /> },
  { key: 'dayWise',  label: 'Day-wise Analysis', icon: <CalendarTabIco /> },
  { key: 'hourly',   label: 'Hourly Analysis',   icon: <ClockTabIco /> },
  { key: 'target',   label: 'Target Achievement',icon: <GaugeIco /> },
  { key: 'attention',label: 'Needs Attention',   icon: <NoEntryIco /> },
  { key: 'directory',label: 'Directory',         icon: <ClipboardIco /> },
];

function AchievementBar({ pct }) {
  if (pct == null) return <span className="text-xs text-gray-400">No target set</span>;
  const color = pct >= 100 ? '#16A34A' : pct >= 50 ? '#D97706' : '#DC2626';
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-20 h-1.5 rounded-full overflow-hidden bg-gray-200">
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold tabular-nums w-10 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

function StatusPill({ active }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${active ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-red-500'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

/* Inline-editable Daily Target cell, backed by PATCH /api/employees/:id/target */
function TargetCell({ employeeId, initial, onSaved }) {
  const [value, setValue] = useState(initial ?? 0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    setEditing(false);
    const num = Number(value);
    if (Number.isNaN(num) || num < 0 || num === initial) { setValue(initial ?? 0); return; }
    setSaving(true);
    try {
      await api.patch(`/api/employees/${employeeId}/target`, { dailyTarget: num });
      toast.success('Target updated');
      onSaved?.(num);
    } catch {
      toast.error('Failed to update target');
      setValue(initial ?? 0);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <input
        autoFocus type="number" min={0} value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className="w-20 text-xs border border-blue-300 rounded-md px-2 py-1 outline-none text-right"
      />
    );
  }
  return (
    <button onClick={() => setEditing(true)} disabled={saving}
      className="text-xs font-semibold text-gray-700 hover:text-blue-600 hover:underline disabled:opacity-50">
      {saving ? '…' : value || 0}
    </button>
  );
}

/* Active/Inactive toggle, backed by PATCH /api/employees/:id/status */
function StatusToggle({ employeeId, active, onSaved }) {
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      await api.patch(`/api/employees/${employeeId}/status`, { isActive: !active });
      toast.success(!active ? 'Marked active' : 'Marked inactive');
      onSaved?.(!active);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setBusy(false);
    }
  };
  return (
    <button onClick={toggle} disabled={busy} className="disabled:opacity-50">
      <StatusPill active={active} />
    </button>
  );
}

// Tooltip for Calls Agent Report Bar Chart
function AgentBarTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  return (
    <div className="bg-gray-900 text-white rounded-xl px-4 py-3 text-xs shadow-2xl border border-gray-700">
      <p className="font-bold text-sm text-white mb-1">{data.employeeName}</p>
      {data.tlName && <p className="text-gray-400 text-[11px] mb-2">TL: {data.tlName}</p>}
      <div className="space-y-1">
        <p className="flex items-center justify-between gap-4">
          <span className="text-gray-400">Total Calls:</span>
          <span className="font-bold tabular-nums text-white">{data.totalCalls}</span>
        </p>
        <p className="flex items-center justify-between gap-4">
          <span className="text-emerald-400">Connected:</span>
          <span className="font-bold tabular-nums text-emerald-400">{data.connectedCalls}</span>
        </p>
        <p className="flex items-center justify-between gap-4">
          <span className="text-rose-400">Not Connected:</span>
          <span className="font-bold tabular-nums text-rose-400">{data.notConnectedCalls}</span>
        </p>
        <p className="flex items-center justify-between gap-4 pt-1 border-t border-gray-700">
          <span className="text-blue-400">Connect Rate:</span>
          <span className="font-bold tabular-nums text-blue-400">{data.connectRate}%</span>
        </p>
      </div>
    </div>
  );
}

function EmployeeReportsPageContent() {
  const searchParams = useSearchParams();
  const isCallsView = searchParams.get('view') === 'calls';

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [chartMode, setChartMode] = useState('composed');
  const [chartMetric, setChartMetric] = useState('total'); // 'total' | 'connected' for calls bar chart
  const [callsTablePage, setCallsTablePage] = useState(1);
  const [callsTableSearch, setCallsTableSearch] = useState('');
  const [employees, setEmployees] = useState([]);
  const [report, setReport] = useState(null);
  const [rowOverrides, setRowOverrides] = useState({});

  const [filters, setFilters] = useState({ fromDate: '', toDate: '', employee: '', status: '', tl: '' });

  const buildParams = useCallback(() => ({
    ...(filters.fromDate && { startDate: filters.fromDate }),
    ...(filters.toDate && { endDate: filters.toDate }),
    ...(filters.employee && { employeeId: filters.employee }),
    ...(filters.status && { status: filters.status }),
    ...(filters.tl && { tlName: filters.tl }),
  }), [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tabToFetch = isCallsView ? 'summary' : activeTab;
      const res = await api.get('/api/reports/employees-periodic', { params: { ...buildParams(), tab: tabToFetch, limit: 500 } });
      setReport(res.data?.data || null);
      setRowOverrides({});
    } catch {
      setReport(null);
      toast.error('Failed to load report');
    }
    setLoading(false);
  }, [buildParams, activeTab, isCallsView]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/api/employees').then((r) => setEmployees(r.data.data || [])).catch(() => {}); }, []);

  const exportCSV = () => triggerServerExport({
    endpoint: '/api/reports/employees/export',
    params: buildParams(),
    filename: `employees-${filters.fromDate || 'all'}_${filters.toDate || 'today'}.csv`,
  });

  const applyOverride = (id, patch) => setRowOverrides((o) => ({ ...o, [id]: { ...o[id], ...patch } }));

  const performanceRows = useMemo(() => {
    return (report?.employeePerformance || []).map((r) => {
      const merged = { ...r, ...rowOverrides[r.employeeId] };
      const tot = merged.totalCalls || 0;
      const conn = merged.connectedCalls || 0;
      const notConn = Math.max(0, tot - conn);
      const rate = tot ? Math.round((conn / tot) * 100) : 0;
      return {
        ...merged,
        notConnectedCalls: notConn,
        connectRate: rate
      };
    });
  }, [report, rowOverrides]);

  const directoryRows = (report?.employees || []).map((r) => ({ ...r, ...rowOverrides[r.employeeId] }));
  const targetRows = (report?.records || []);
  const attentionRows = (report?.records || []);
  const hourlyRows = (report?.hourly || []).map((h) => ({ ...h, id: h.hour }));
  const dayWiseRows = (report?.daywise || []).map((d) => ({ ...d, id: d.date }));
  const hourlyChartData = (report?.hourly || []).map((h) => ({ hour: h.label, calls: h.calls, leads: h.leads }));

  const employeeName = employees.find((e) => e._id === filters.employee)?.name;

  // ── CALLS-SPECIFIC AGENT PERFORMANCE VIEW ─────────────────────────────────
  if (isCallsView) {
    const totalTeamCalls = performanceRows.reduce((s, r) => s + (r.totalCalls || 0), 0);
    const totalTeamConnected = performanceRows.reduce((s, r) => s + (r.connectedCalls || 0), 0);
    const totalTeamNotConnected = Math.max(0, totalTeamCalls - totalTeamConnected);
    const teamConnectRate = totalTeamCalls ? Math.round((totalTeamConnected / totalTeamCalls) * 100) : 0;

    // Filter agents for table & bar chart
    const filteredAgents = performanceRows.filter((r) => {
      if (!callsTableSearch.trim()) return true;
      const q = callsTableSearch.toLowerCase();
      const matchName = (r.employeeName || '').toLowerCase().includes(q);
      const matchTL = (r.tlName || '').toLowerCase().includes(q);
      return matchName || matchTL;
    });

    const sortedForChart = [...filteredAgents].sort((a, b) => {
      return chartMetric === 'total'
        ? (b.totalCalls || 0) - (a.totalCalls || 0)
        : (b.connectedCalls || 0) - (a.connectedCalls || 0);
    }).slice(0, 30); // Top 30 agents for clean bar comparison

    const PAGE_SIZE = 10;
    const totalPages = Math.max(1, Math.ceil(filteredAgents.length / PAGE_SIZE));
    const currentPage = Math.min(callsTablePage, totalPages);
    const paginatedAgents = filteredAgents.slice(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE
    );

    return (
      <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div>
            <p className="text-xs text-gray-400 flex items-center gap-1.5 font-medium">
              Calls <span className="text-gray-300">/</span> <span className="text-gray-600">Agents Report</span>
            </p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">Agent Performance Report</h1>
            <p className="text-xs text-gray-500 mt-0.5">Comparative agent metrics across total calls, connected calls, and connection rates</p>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors text-sm font-medium shadow-sm self-start sm:self-auto"
          >
            <DownloadIco /> Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <Field label="From Date">
              <input type="date" className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} />
            </Field>
            <Field label="To Date">
              <input type="date" className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} />
            </Field>
            <Field label="Team Leader">
              <TLFilter value={filters.tl} onChange={(v) => setFilters({ ...filters, tl: v })} className="w-full text-xs rounded-xl" />
            </Field>
            <Field label="Status">
              <select className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 bg-white"
                value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="">All statuses</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </Field>
            <button onClick={load} className="flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold h-[38px] transition-colors shadow-sm">
              Apply Filter
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white mb-3" style={{ background: 'linear-gradient(135deg,#6366F1,#818CF8)' }}>
              <Users size={16} />
            </div>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">{performanceRows.length}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-1">Total Agents</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white mb-3" style={{ background: 'linear-gradient(135deg,#2563EB,#3B82F6)' }}>
              <Phone size={16} />
            </div>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">{totalTeamCalls}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-1">Total Calls</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white mb-3" style={{ background: 'linear-gradient(135deg,#0D9488,#14B8A6)' }}>
              <CheckCircle size={16} />
            </div>
            <p className="text-2xl font-bold text-emerald-600 tabular-nums">{totalTeamConnected}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-1">Connected Calls</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white mb-3" style={{ background: 'linear-gradient(135deg,#DC2626,#EF4444)' }}>
              <PhoneOff size={16} />
            </div>
            <p className="text-2xl font-bold text-rose-600 tabular-nums">{totalTeamNotConnected}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-1">Not Connected</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm col-span-2 sm:col-span-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white mb-3" style={{ background: 'linear-gradient(135deg,#16A34A,#22C55E)' }}>
              <TrendingUp size={16} />
            </div>
            <p className="text-2xl font-bold text-blue-600 tabular-nums">{teamConnectRate}%</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-1">Connect Rate</p>
          </div>
        </div>

        {/* ── COMPARATIVE BAR GRAPH SECTION ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="font-bold text-base text-gray-900">Agent Performance Comparison</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Hover over any bar to view full breakdown: Total, Connected, Not Connected, and Rate
              </p>
            </div>
            {/* Toggle metric */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl self-start sm:self-auto">
              <button
                onClick={() => setChartMetric('total')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  chartMetric === 'total' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Total Calls
              </button>
              <button
                onClick={() => setChartMetric('connected')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  chartMetric === 'connected' ? 'bg-white text-emerald-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Connected Calls
              </button>
            </div>
          </div>

          {loading ? (
            <Skeleton className="h-72 w-full rounded-xl" />
          ) : sortedForChart.length === 0 ? (
            <div className="py-14 text-center text-gray-400 text-sm">
              No agent performance data available for this range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: Math.max(600, sortedForChart.length * 36) }}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={sortedForChart} margin={{ top: 20, right: 10, left: -10, bottom: 40 }}>
                    <defs>
                      <linearGradient id="agentBarTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.4} />
                      </linearGradient>
                      <linearGradient id="agentBarConn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0D9488" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#14B8A6" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis
                      dataKey="employeeName"
                      tick={{ fill: '#64748B', fontSize: 10 }}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={50}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#94A3B8', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                      allowDecimals={false}
                    />
                    <Tooltip content={<AgentBarTip />} cursor={{ fill: 'rgba(37,99,235,0.05)', radius: 6 }} />
                    <Bar
                      dataKey={chartMetric === 'total' ? 'totalCalls' : 'connectedCalls'}
                      name={chartMetric === 'total' ? 'Total Calls' : 'Connected Calls'}
                      fill={chartMetric === 'total' ? 'url(#agentBarTotal)' : 'url(#agentBarConn)'}
                      radius={[6, 6, 0, 0]}
                    >
                      <LabelList
                        dataKey={chartMetric === 'total' ? 'totalCalls' : 'connectedCalls'}
                        position="top"
                        style={{ fontSize: 9, fill: '#64748B', fontWeight: 600 }}
                        formatter={(v) => (v > 0 ? v : '')}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* ── PAGINATED AGENTS TABLE ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <div>
              <h3 className="font-bold text-sm text-gray-900">Agent Performance Table</h3>
              <p className="text-xs text-gray-400 mt-0.5">Paginated roster with complete metrics ({filteredAgents.length} total agents)</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search agent or TL..."
                value={callsTableSearch}
                onChange={(e) => { setCallsTableSearch(e.target.value); setCallsTablePage(1); }}
                className="w-full pl-9 pr-7 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-800 placeholder-gray-400 transition-colors"
              />
              {callsTableSearch && (
                <button
                  onClick={() => { setCallsTableSearch(''); setCallsTablePage(1); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-100">
                  {['Agent', 'Team Leader', 'Calls', 'Connected', 'Not Connected', 'Connect Rate', 'Target Achievement', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="px-5 py-3"><div className="h-6 bg-gray-100 rounded animate-pulse" /></td>
                    </tr>
                  ))
                ) : paginatedAgents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400">
                      No agents match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedAgents.map((r) => (
                    <tr key={r.employeeId} className="hover:bg-blue-50/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" style={{ background: '#64748B' }}>
                            {(r.employeeName || '?')[0].toUpperCase()}
                          </div>
                          <span className="font-semibold text-gray-900 text-xs">{r.employeeName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-600 font-medium">{r.tlName || '—'}</td>
                      <td className="px-5 py-3.5 tabular-nums font-bold text-gray-900 text-xs">{r.totalCalls}</td>
                      <td className="px-5 py-3.5 tabular-nums font-semibold text-emerald-600 text-xs">{r.connectedCalls}</td>
                      <td className="px-5 py-3.5 tabular-nums text-gray-500 text-xs">{r.notConnectedCalls}</td>
                      <td className="px-5 py-3.5">
                        <span className="tabular-nums text-xs font-semibold" style={{ color: r.connectRate >= 50 ? '#16A34A' : r.connectRate > 0 ? '#D97706' : '#94A3B8' }}>
                          {r.connectRate}%
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <AchievementBar pct={r.targetAchievement} />
                      </td>
                      <td className="px-5 py-3.5"><StatusPill active={r.isActive} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {filteredAgents.length > PAGE_SIZE && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-3 border-t border-gray-100 gap-3 bg-white">
              <p className="text-xs text-gray-500 font-medium">
                Showing <span className="font-semibold text-gray-700">{(currentPage - 1) * PAGE_SIZE + 1}</span>–
                <span className="font-semibold text-gray-700">{Math.min(currentPage * PAGE_SIZE, filteredAgents.length)}</span> of{' '}
                <span className="font-semibold text-gray-700">{filteredAgents.length}</span> agents
              </p>
              <Pagination page={currentPage} pages={totalPages} onPage={setCallsTablePage} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── DEFAULT / LEGACY TABS FOR EMPLOYEES & REPORTS PAGES ────────────────────
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            Reports <span className="text-gray-300">/</span> <span className="text-gray-500">Employee Reports</span>
          </p>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">{report?.dateLabel || 'Employee Reports'}</h1>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-2 px-3.5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium shadow-sm">
          <DownloadIco /> Export
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <Field label="From Date">
            <input type="date" className="form-input" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} />
          </Field>
          <Field label="To Date">
            <input type="date" className="form-input" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} />
          </Field>
          <Field label="Employee">
            <select className="form-input" value={filters.employee} onChange={(e) => setFilters({ ...filters, employee: e.target.value })}>
              <option value="">All employees</option>
              {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className="form-input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </Field>
          <Field label="Team Lead">
            <TLFilter value={filters.tl} onChange={(v) => setFilters({ ...filters, tl: v })} className="w-full" />
          </Field>
          <button onClick={load} className="btn-primary justify-center h-[38px]">Apply</button>
        </div>
        {(filters.employee || filters.status || filters.tl) && (
          <p className="text-xs text-gray-400 mt-3">
            Filtering by {filters.employee ? employeeName : 'all employees'}{filters.status ? `, ${filters.status}` : ''}{filters.tl ? `, TL: ${filters.tl}` : ''}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-nav">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`tab-item${activeTab === t.key ? ' active' : ''}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Summary ── */}
      {activeTab === 'summary' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard loading={loading} label="Total Employees" value={(report?.kpis?.totalEmployees ?? 0).toLocaleString()} color="#2563EB" icon={<UsersIco />} />
            <StatCard loading={loading} label="Active Employees" value={(report?.kpis?.activeEmployees ?? 0).toLocaleString()} color="#16A34A" icon={<CheckIco />} />
            <StatCard loading={loading} label="Total Calls" value={(report?.kpis?.totalCalls ?? 0).toLocaleString()} color="#D97706" icon={<PhoneIco />} />
            <StatCard loading={loading} label="Leads Assigned" value={(report?.kpis?.totalLeadsAssigned ?? 0).toLocaleString()} color="#7C3AED" icon={<UsersIco />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-1">Workforce Status</h3>
              <p className="text-xs text-gray-400 mb-3">Active vs inactive</p>
              {loading ? <Skeleton className="h-44 w-full" /> : !report?.statusPie?.length ? <EmptyState title="No employees" hint="" /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={report.statusPie} cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={3} dataKey="value">
                      {report.statusPie.map((d, i) => <Cell key={i} fill={d.color} stroke="#fff" strokeWidth={2} />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="flex justify-center gap-4 mt-2 flex-wrap">
                {(report?.statusPie || []).map((d, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="w-2 h-2 rounded-full" style={{ background: d.color }} /> {d.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-1">Employee Performance</h3>
              <p className="text-xs text-gray-400 mb-3">Calls, leads and target achievement for the selected period</p>
              <DataTable
                loading={loading}
                pageSize={10}
                emptyTitle="No employees found"
                columns={[
                  {
                    key: 'employeeName', label: 'Employee',
                    render: (r) => (
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{r.employeeName}</p>
                        <StatusPill active={r.isActive} />
                      </div>
                    ),
                  },
                  { key: 'totalCalls', label: 'Calls', align: 'right', searchable: false },
                  { key: 'connectedCalls', label: 'Connected', align: 'right', searchable: false, render: (r) => <span className="text-emerald-600 font-semibold">{r.connectedCalls}</span> },
                  { key: 'leadsAssigned', label: 'Leads', align: 'right', searchable: false },
                  { key: 'leadsConverted', label: 'Converted', align: 'right', searchable: false, render: (r) => <span className="text-emerald-600 font-semibold">{r.leadsConverted}</span> },
                  { key: 'conversionRate', label: 'Conv. Rate', align: 'right', searchable: false, render: (r) => `${r.conversionRate}%` },
                  { key: 'targetAchievement', label: 'Target', align: 'right', sortable: false, searchable: false, render: (r) => <AchievementBar pct={r.targetAchievement} /> },
                ]}
                rows={performanceRows}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Analysis ── */}
      {activeTab === 'analysis' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Calls vs. Leads — Hourly</h3>
                <p className="text-xs text-gray-400">Org-wide activity across all employees</p>
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {['composed', 'bar'].map((m) => (
                  <button key={m} onClick={() => setChartMode(m)}
                    className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${chartMode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {loading ? <Skeleton className="h-72 w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={hourlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fill: '#94A3B8', fontSize: 10 }} tickLine={false} axisLine={false} interval={1} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="calls" name="Calls" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={18} />
                  {chartMode === 'composed' && <Line type="monotone" dataKey="leads" name="Leads Created" stroke="#7C3AED" strokeWidth={2} dot={{ r: 3, fill: '#7C3AED' }} />}
                  {chartMode === 'bar' && <Bar dataKey="leads" name="Leads Created" fill="#7C3AED" radius={[4, 4, 0, 0]} barSize={18} />}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InsightCard icon={<TrophyIco />} title="Top Performers" rows={[
              { label: 'Top Dialer', value: report?.topDialer?.employeeName || '—', sub: report?.topDialer ? `${report.topDialer.count} calls` : '' },
              { label: 'Top Converter', value: report?.topConverter?.employeeName || '—', sub: report?.topConverter ? `${report.topConverter.count} leads converted` : '' },
            ]} />
            <InsightCard icon={<GaugeIco />} title="Target Achievement" rows={[
              { label: 'Best Achiever', value: report?.bestTarget?.employeeName || '—', sub: report?.bestTarget ? `${report.bestTarget.pct}% of target` : 'No targets set' },
              { label: 'Needs Coaching', value: report?.needsAttention?.employeeName || '—', sub: report?.needsAttention ? `${report.needsAttention.pct}% of target` : '' },
            ]} />
            <InsightCard icon={<ClockIco />} title="Averages" rows={[
              { label: 'Avg Calls / Employee', value: report?.avgCallsPerEmployee ?? 0 },
              { label: 'Avg Leads / Employee', value: report?.avgLeadsPerEmployee ?? 0 },
              { label: 'Business Days', value: report?.dayCount ?? 0 },
            ]} />
          </div>
        </div>
      )}

      {/* ── Day-wise ── */}
      {activeTab === 'dayWise' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Daily Activity</h3>
          <p className="text-xs text-gray-400 mb-4">Calls and leads created per day, across all employees</p>
          <DataTable
            loading={loading}
            searchable={false}
            pageSize={15}
            columns={[
              { key: 'label', label: 'Day' },
              { key: 'calls', label: 'Calls', align: 'right' },
              { key: 'leadsCreated', label: 'Leads Created', align: 'right' },
              { key: 'leadsConverted', label: 'Converted', align: 'right', render: (r) => <span className="text-emerald-600 font-semibold">{r.leadsConverted}</span> },
            ]}
            rows={dayWiseRows}
          />
          {!loading && dayWiseRows.length > 0 && (
            <div className="mt-6">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[...dayWiseRows].reverse().map((r) => ({ day: r.label.split(',')[0], calls: r.calls, leads: r.leadsCreated }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#94A3B8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="calls" name="Calls" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="leads" name="Leads Created" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Hourly ── */}
      {activeTab === 'hourly' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Hourly Time Slots</h3>
          <p className="text-xs text-gray-400 mb-4">Share of combined activity (calls + leads) by hour, IST</p>
          <DataTable
            loading={loading}
            searchable={false}
            pageSize={24}
            columns={[
              { key: 'label', label: 'Time Slot' },
              { key: 'calls', label: 'Calls', align: 'right' },
              { key: 'leads', label: 'Leads', align: 'right' },
              {
                key: 'pct', label: '% of Total', align: 'right', sortable: false,
                render: (r) => (
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(r.pct, 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-10 text-right">{r.pct}%</span>
                  </div>
                ),
              },
            ]}
            rows={hourlyRows}
          />
        </div>
      )}

      {/* ── Target Achievement ── */}
      {activeTab === 'target' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Target Achievement</h3>
          <p className="text-xs text-gray-400 mb-4">Employees with a daily call target set, weakest first</p>
          <DataTable
            loading={loading}
            emptyTitle="No targets configured"
            emptyHint="Set a daily target for an employee from the Directory tab."
            columns={[
              { key: 'employeeName', label: 'Employee' },
              { key: 'dailyTarget', label: 'Daily Target', align: 'right', searchable: false },
              { key: 'totalCalls', label: 'Calls Made', align: 'right', searchable: false },
              { key: 'targetTotal', label: 'Period Target', align: 'right', searchable: false },
              { key: 'targetAchievement', label: 'Achievement', align: 'right', sortable: false, searchable: false, render: (r) => <AchievementBar pct={r.targetAchievement} /> },
            ]}
            rows={targetRows}
          />
        </div>
      )}

      {/* ── Needs Attention ── */}
      {activeTab === 'attention' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Needs Attention</h3>
          <p className="text-xs text-gray-400 mb-4">Inactive accounts, employees below 50% of target, or no activity this period</p>
          <DataTable
            loading={loading}
            emptyTitle="Nobody needs attention"
            columns={[
              { key: 'employeeName', label: 'Employee' },
              {
                key: 'reason', label: 'Reason', sortable: false,
                render: (r) => (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium text-red-600 bg-red-50">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {r.reason}
                  </span>
                ),
              },
              { key: 'totalCalls', label: 'Calls', align: 'right', searchable: false },
              { key: 'targetAchievement', label: 'Target', align: 'right', sortable: false, searchable: false, render: (r) => <AchievementBar pct={r.targetAchievement} /> },
            ]}
            rows={attentionRows}
          />
        </div>
      )}

      {/* ── Directory ── */}
      {activeTab === 'directory' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Employee Directory</h3>
          <p className="text-xs text-gray-400 mb-4">Full roster — click a status pill or target value to edit it directly</p>
          <DataTable
            loading={loading}
            pageSize={25}
            showRowNumber
            columns={[
              {
                key: 'employeeName', label: 'Employee',
                render: (r) => (
                  <div>
                    <p className="font-semibold text-sm text-gray-900"><Truncate text={r.employeeName} /></p>
                    <p className="text-xs text-gray-400 truncate">{r.email}</p>
                  </div>
                ),
              },
              { key: 'employeeCode', label: 'Employee ID', render: (r) => r.employeeCode || <span className="text-gray-300">—</span> },
              { key: 'tlName', label: 'Team Lead', render: (r) => r.tlName ? <Truncate text={r.tlName} max={14} /> : <span className="text-gray-300">—</span> },
              { key: 'phone', label: 'Phone', searchable: false },
              {
                key: 'isActive', label: 'Status', sortable: false, searchable: false,
                render: (r) => <StatusToggle employeeId={r.employeeId} active={r.isActive} onSaved={(v) => applyOverride(r.employeeId, { isActive: v })} />,
              },
              {
                key: 'dailyTarget', label: 'Daily Target', align: 'right', sortable: false, searchable: false,
                render: (r) => <TargetCell employeeId={r.employeeId} initial={r.dailyTarget} onSaved={(v) => applyOverride(r.employeeId, { dailyTarget: v })} />,
              },
              { key: 'targetAchievement', label: 'Achievement', align: 'right', sortable: false, searchable: false, render: (r) => <AchievementBar pct={r.targetAchievement} /> },
              { key: 'totalCalls', label: 'Calls (period)', align: 'right', searchable: false },
              { key: 'totalTalktime', label: 'Total Talktime', align: 'right', searchable: false, render: (r) => r.totalTalktime || '0s' },
              { key: 'leadsAssigned', label: 'Leads (period)', align: 'right', searchable: false },
              { key: 'conversionRate', label: 'Conv. Rate', align: 'right', searchable: false, render: (r) => `${r.conversionRate ?? 0}%` },
            ]}
            rows={directoryRows}
          />
        </div>
      )}
    </div>
  );
}

export default function EmployeeReportsPage() {
  return (
    <Suspense fallback={null}>
      <EmployeeReportsPageContent />
    </Suspense>
  );
}