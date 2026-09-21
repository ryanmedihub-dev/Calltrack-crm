'use client';
import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList,
} from 'recharts';
import api from '../../../../lib/api';
import { triggerServerExport } from '../../../../lib/downloads';
import Pagination from '../../../../components/Pagination';
import {
  Field, Skeleton, TLFilter, DownloadIco,
} from '../../../../components/report-shared';
import { Phone, CheckCircle, PhoneOff, TrendingUp, Search, Users, AlertCircle } from 'lucide-react';

// ── Shared micro-components ───────────────────────────────────────────────────

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

// Rich bar-chart tooltip
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

// ── Main page content ─────────────────────────────────────────────────────────

function AgentReportContent() {
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [chartMetric, setChartMetric]       = useState('total'); // 'total' | 'connected'
  const [tableSearch, setTableSearch]       = useState('');
  const [tablePage, setTablePage]           = useState(1);
  const [report, setReport]                 = useState(null);
  const [filters, setFilters]               = useState({ fromDate: '', toDate: '', status: '', tl: '' });
  const [appliedFilters, setAppliedFilters] = useState({ fromDate: '', toDate: '', status: '', tl: '' });

  const abortControllerRef = useRef(null);

  const fetchReport = useCallback(async (activeFilters) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    const params = {
      ...(activeFilters.fromDate && { startDate: activeFilters.fromDate }),
      ...(activeFilters.toDate   && { endDate:   activeFilters.toDate   }),
      ...(activeFilters.status   && { status:    activeFilters.status   }),
      ...(activeFilters.tl       && { tlName:    activeFilters.tl       }),
      tab:   'summary',
      limit: 500,
    };

    try {
      const res = await api.get('/api/reports/employees-periodic', {
        params,
        signal: controller.signal,
      });
      setReport(res.data?.data || null);
      setError(null);
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        return; // Stale request canceled
      }
      setReport(null);
      const msg = err?.response?.data?.error || err.message || 'Failed to load agent report';
      setError(msg);
      toast.error(msg);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchReport(appliedFilters);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [appliedFilters, fetchReport]);

  const handleApplyFilters = () => {
    setTablePage(1);
    setAppliedFilters({ ...filters });
  };

  // Derive performance rows with computed fields
  const performanceRows = useMemo(() => {
    return (report?.employeePerformance || []).map((r) => {
      const tot    = r.totalCalls     || 0;
      const conn   = r.connectedCalls || 0;
      const notConn = Math.max(0, tot - conn);
      const rate    = tot ? Math.round((conn / tot) * 100) : 0;
      return { ...r, notConnectedCalls: notConn, connectRate: rate };
    });
  }, [report]);

  // Team-level KPIs
  const totalTeamCalls       = performanceRows.reduce((s, r) => s + (r.totalCalls     || 0), 0);
  const totalTeamConnected   = performanceRows.reduce((s, r) => s + (r.connectedCalls || 0), 0);
  const totalTeamNotConn     = Math.max(0, totalTeamCalls - totalTeamConnected);
  const teamConnectRate      = totalTeamCalls ? Math.round((totalTeamConnected / totalTeamCalls) * 100) : 0;

  // Search filter
  const filteredAgents = useMemo(() => performanceRows.filter((r) => {
    if (!tableSearch.trim()) return true;
    const q = tableSearch.toLowerCase();
    return (r.employeeName || '').toLowerCase().includes(q) ||
           (r.tlName       || '').toLowerCase().includes(q);
  }), [performanceRows, tableSearch]);

  // Bar chart — top 30 sorted by selected metric
  const sortedForChart = useMemo(() => [...filteredAgents]
    .sort((a, b) => chartMetric === 'total'
      ? (b.totalCalls     || 0) - (a.totalCalls     || 0)
      : (b.connectedCalls || 0) - (a.connectedCalls || 0))
    .slice(0, 30),
  [filteredAgents, chartMetric]);

  // Table pagination
  const PAGE_SIZE    = 10;
  const totalPages   = Math.max(1, Math.ceil(filteredAgents.length / PAGE_SIZE));
  const currentPage  = Math.min(tablePage, totalPages);
  const paginatedAgents = filteredAgents.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const exportCSV = () => triggerServerExport({
    endpoint: '/api/reports/employees/export',
    params: {
      ...(appliedFilters.fromDate && { startDate: appliedFilters.fromDate }),
      ...(appliedFilters.toDate   && { endDate:   appliedFilters.toDate   }),
      ...(appliedFilters.status   && { status:    appliedFilters.status   }),
      ...(appliedFilters.tl       && { tlName:    appliedFilters.tl       }),
    },
    filename: `agent-report-${appliedFilters.fromDate || 'all'}_${appliedFilters.toDate || 'today'}.csv`,
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div>
          <p className="text-xs text-gray-400 flex items-center gap-1.5 font-medium">
            Calls <span className="text-gray-300">/</span> <span className="text-gray-600">Agent Report</span>
          </p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">Agent Performance Report</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Comparative agent metrics across total calls, connected calls, and connection rates
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors text-sm font-medium shadow-sm self-start sm:self-auto"
        >
          <DownloadIco /> Export CSV
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <Field label="From Date">
            <input
              type="date"
              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
              value={filters.fromDate}
              onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
            />
          </Field>
          <Field label="To Date">
            <input
              type="date"
              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
              value={filters.toDate}
              onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
            />
          </Field>
          <Field label="Team Leader">
            <TLFilter
              value={filters.tl}
              onChange={(v) => setFilters({ ...filters, tl: v })}
              className="w-full text-xs rounded-xl"
            />
          </Field>
          <Field label="Status">
            <select
              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 bg-white"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </Field>
          <button
            onClick={handleApplyFilters}
            disabled={loading}
            className="flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold h-[38px] transition-colors shadow-sm"
          >
            {loading ? 'Loading...' : 'Apply Filter'}
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3 text-red-800">
            <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold">Failed to load agent performance report</p>
              <p className="text-[11px] text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={() => fetchReport(appliedFilters)}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold self-start sm:self-auto transition-colors shadow-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Highlighted KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Agents */}
        <div className="relative bg-white rounded-2xl p-5 border border-indigo-100 hover:border-indigo-300 bg-gradient-to-br from-indigo-50/40 via-white to-white shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 to-purple-600" />
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-500/25 bg-gradient-to-br from-indigo-600 to-purple-600">
                <Users size={18} />
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700">
                Team Roster
              </span>
            </div>
            {loading ? (
              <Skeleton className="h-9 w-20 my-0.5 rounded-lg" />
            ) : (
              <p className="text-3xl font-extrabold text-gray-900 tracking-tight tabular-nums">
                {performanceRows.length}
              </p>
            )}
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mt-1">Total Agents</p>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>Roster count</span>
            <span className="font-semibold text-indigo-600">{performanceRows.length} active</span>
          </div>
        </div>

        {/* Card 2: Total Calls */}
        <div className="relative bg-white rounded-2xl p-5 border border-blue-100 hover:border-blue-300 bg-gradient-to-br from-blue-50/40 via-white to-white shadow-sm hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600" />
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-500/25 bg-gradient-to-br from-blue-600 to-indigo-600">
                <Phone size={18} />
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700">
                Call Volume
              </span>
            </div>
            {loading ? (
              <Skeleton className="h-9 w-24 my-0.5 rounded-lg" />
            ) : (
              <p className="text-3xl font-extrabold text-gray-900 tracking-tight tabular-nums">
                {totalTeamCalls.toLocaleString()}
              </p>
            )}
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mt-1">Total Calls</p>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>Overall team activity</span>
          </div>
        </div>

        {/* Card 3: Connected Calls */}
        <div className="relative bg-white rounded-2xl p-5 border border-emerald-100 hover:border-emerald-300 bg-gradient-to-br from-emerald-50/40 via-white to-white shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-500/25 bg-gradient-to-br from-emerald-600 to-teal-600">
                <CheckCircle size={18} />
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                Connected
              </span>
            </div>
            {loading ? (
              <Skeleton className="h-9 w-24 my-0.5 rounded-lg" />
            ) : (
              <p className="text-3xl font-extrabold text-emerald-600 tracking-tight tabular-nums">
                {totalTeamConnected.toLocaleString()}
              </p>
            )}
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mt-1">Connected Calls</p>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, teamConnectRate)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-gray-400 mt-1.5">
              <span>Connect Ratio</span>
              <span className="font-semibold text-emerald-600">{teamConnectRate}%</span>
            </div>
          </div>
        </div>

        {/* Card 4: Not Connected */}
        <div className="relative bg-white rounded-2xl p-5 border border-rose-100 hover:border-rose-300 bg-gradient-to-br from-rose-50/40 via-white to-white shadow-sm hover:shadow-xl hover:shadow-rose-500/10 hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 to-red-600" />
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md shadow-rose-500/25 bg-gradient-to-br from-rose-600 to-red-600">
                <PhoneOff size={18} />
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-rose-200 bg-rose-50 text-rose-700">
                Unanswered
              </span>
            </div>
            {loading ? (
              <Skeleton className="h-9 w-24 my-0.5 rounded-lg" />
            ) : (
              <p className="text-3xl font-extrabold text-rose-600 tracking-tight tabular-nums">
                {totalTeamNotConn.toLocaleString()}
              </p>
            )}
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mt-1">Not Connected</p>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, totalTeamCalls ? Math.round((totalTeamNotConn / totalTeamCalls) * 100) : 0)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-gray-400 mt-1.5">
              <span>Drop Rate</span>
              <span className="font-semibold text-rose-600">
                {totalTeamCalls ? Math.round((totalTeamNotConn / totalTeamCalls) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Card 5: Connect Rate */}
        <div className="relative bg-white rounded-2xl p-5 border border-teal-100 hover:border-teal-300 bg-gradient-to-br from-teal-50/40 via-white to-white shadow-sm hover:shadow-xl hover:shadow-teal-500/10 hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col justify-between col-span-1 sm:col-span-2 lg:col-span-1">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-500 to-emerald-600" />
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md shadow-teal-500/25 bg-gradient-to-br from-teal-600 to-emerald-600">
                <TrendingUp size={18} />
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-teal-200 bg-teal-50 text-teal-700">
                Efficiency
              </span>
            </div>
            {loading ? (
              <Skeleton className="h-9 w-20 my-0.5 rounded-lg" />
            ) : (
              <p className="text-3xl font-extrabold text-blue-600 tracking-tight tabular-nums">
                {teamConnectRate}%
              </p>
            )}
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mt-1">Connect Rate</p>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, teamConnectRate)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-gray-400 mt-1.5">
              <span>Performance</span>
              <span className="font-semibold text-teal-600">Team avg</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bar Chart ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="font-bold text-base text-gray-900">Agent Performance Comparison</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Hover over any bar to view full breakdown: Total, Connected, Not Connected, and Rate
            </p>
          </div>
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
                    <linearGradient id="arBarTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#2563EB" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.4} />
                    </linearGradient>
                    <linearGradient id="arBarConn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#0D9488" stopOpacity={0.9} />
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
                    fill={chartMetric === 'total' ? 'url(#arBarTotal)' : 'url(#arBarConn)'}
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

      {/* ── Paginated Agents Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h3 className="font-bold text-sm text-gray-900">Agent Performance Table</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Paginated roster with complete metrics ({filteredAgents.length} total agents)
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search agent or TL..."
              value={tableSearch}
              onChange={(e) => { setTableSearch(e.target.value); setTablePage(1); }}
              className="w-full pl-9 pr-7 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-800 placeholder-gray-400 transition-colors"
            />
            {tableSearch && (
              <button
                onClick={() => { setTableSearch(''); setTablePage(1); }}
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
                {['Agent', 'Team Leader', 'Calls', 'Connected', 'Not Connected', 'Connect Rate', 'Target Achievement', 'Status'].map((h) => (
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
                    <td colSpan={8} className="px-5 py-3">
                      <div className="h-6 bg-gray-100 rounded animate-pulse" />
                    </td>
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
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                          style={{ background: '#64748B' }}>
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
                      <span
                        className="tabular-nums text-xs font-semibold"
                        style={{ color: r.connectRate >= 50 ? '#16A34A' : r.connectRate > 0 ? '#D97706' : '#94A3B8' }}
                      >
                        {r.connectRate}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <AchievementBar pct={r.targetAchievement} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill active={r.isActive} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredAgents.length > PAGE_SIZE && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-3 border-t border-gray-100 gap-3 bg-white">
            <p className="text-xs text-gray-500 font-medium">
              Showing{' '}
              <span className="font-semibold text-gray-700">{(currentPage - 1) * PAGE_SIZE + 1}</span>–
              <span className="font-semibold text-gray-700">{Math.min(currentPage * PAGE_SIZE, filteredAgents.length)}</span>
              {' '}of{' '}
              <span className="font-semibold text-gray-700">{filteredAgents.length}</span> agents
            </p>
            <Pagination page={currentPage} pages={totalPages} onPage={setTablePage} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgentReportPage() {
  return (
    <Suspense fallback={null}>
      <AgentReportContent />
    </Suspense>
  );
}
