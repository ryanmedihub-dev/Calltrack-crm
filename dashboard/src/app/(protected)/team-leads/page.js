'use client';
import { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import api from '../../../lib/api';
import DateRangeFilter, { formatRangeLabel, rangeToDates } from '../../../components/DateRangeFilter';
import Pagination from '../../../components/Pagination';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserCheck, Phone, CheckCircle, PhoneOff, TrendingUp,
  Search, RefreshCw, ChevronDown, Mail, AlertTriangle, ArrowRight
} from 'lucide-react';

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function ActiveBadge({ active }) {
  return active !== false ? (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
      Active
    </span>
  ) : (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
      Inactive
    </span>
  );
}

const AGENTS_PER_PAGE = 10;

export default function TeamLeadersPage() {
  const [hierarchy,   setHierarchy]   = useState(null);
  const [callStats,   setCallStats]   = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState(null);
  const [search,      setSearch]      = useState('');
  const [expanded,    setExpanded]    = useState({});
  const [agentPages,  setAgentPages]  = useState({}); // { [tlId]: pageNumber }
  const [dateRange,   setDateRange]   = useState({ range: 'today', startDate: null, endDate: null });
  const dateRangeRef = useRef(dateRange);

  useEffect(() => {
    dateRangeRef.current = dateRange;
    // Reset all pagination to page 1 on date filter change
    setAgentPages({});
  }, [dateRange]);

  const loadData = async (spin = false) => {
    if (spin) setRefreshing(true);
    setError(null);
    try {
      const dr = dateRangeRef.current;
      const params = { range: dr.range };
      if (dr.range === 'custom') {
        params.startDate = dr.startDate;
        params.endDate   = dr.endDate;
      }

      const [hierRes, statsRes] = await Promise.all([
        hierarchy ? Promise.resolve({ data: { data: hierarchy } }) : api.get('/api/users/hierarchy'),
        api.get('/api/calls/stats', { params }),
      ]);

      if (!hierarchy) {
        setHierarchy(hierRes.data.data);
        // Expand all by default
        const node = hierRes.data.data?.managers?.[0];
        const initExp = {};
        (node?.teamLeads || []).forEach(item => {
          if (item.tl?._id) initExp[item.tl._id] = true;
        });
        setExpanded(initExp);
      }
      setCallStats(statsRes.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load team leader metrics. Please retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const toggleExpand = (tlId) => {
    setExpanded(prev => ({ ...prev, [tlId]: !prev[tlId] }));
  };

  const setPageForTL = (tlId, newPage) => {
    setAgentPages(prev => ({ ...prev, [tlId]: newPage }));
  };

  const handleSearchChange = (val) => {
    setSearch(val);
    setAgentPages({}); // Reset pagination on search
  };

  const myNode    = hierarchy?.managers?.[0];
  const teamLeads = myNode?.teamLeads || [];
  const allAgents = teamLeads.flatMap(t => t.agents || []);

  // Compute call stats map
  const selectedStats  = callStats?.selected || callStats?.today || callStats;
  const totalCalls     = selectedStats?.totalCalls ?? callStats?.totalCalls ?? 0;
  const connectedCalls = selectedStats?.connectedCalls ?? callStats?.connectedCalls ?? 0;
  const connectRate    = pct(connectedCalls, totalCalls);
  const empStatsList   = selectedStats?.employeeStats || callStats?.employeeStats || [];

  const empStatsMap = {};
  (empStatsList || []).forEach(e => {
    if (e.employeeId) empStatsMap[e.employeeId] = e;
  });

  const totalTLs     = teamLeads.length;
  const totalAgents  = allAgents.length;
  const activeAgents = allAgents.filter(a => a.isActive !== false).length;

  // Process and filter TLs
  const processedTLs = useMemo(() => {
    const q = search.toLowerCase().trim();

    return teamLeads.map(({ tl, agents }) => {
      let tlCalls = 0, tlConn = 0;

      // Enhance agents with metrics
      const enrichedAgents = (agents || []).map(agent => {
        const es      = empStatsMap[agent._id?.toString()] || {};
        const calls   = es.count || 0;
        const conn    = es.connectedCalls || 0;
        const notConn = Math.max(0, calls - conn);
        const rate    = pct(conn, calls);
        tlCalls      += calls;
        tlConn       += conn;
        return {
          ...agent,
          calls,
          connected: conn,
          notConnected: notConn,
          rate,
          target: agent.dailyTarget || 0
        };
      });

      const tlNotConn = Math.max(0, tlCalls - tlConn);
      const tlRate    = pct(tlConn, tlCalls);

      // Filter agents within this TL if search is active
      const filteredAgents = enrichedAgents.filter(a => {
        if (!q) return true;
        const matchAgent = (a.name || '').toLowerCase().includes(q) ||
                           (a.email || '').toLowerCase().includes(q) ||
                           (a.phone || '').includes(q);
        const matchTL    = (tl.name || '').toLowerCase().includes(q) ||
                           (tl.email || '').toLowerCase().includes(q);
        return matchAgent || matchTL;
      });

      return {
        tl,
        allAgents: enrichedAgents,
        filteredAgents,
        calls: tlCalls,
        connected: tlConn,
        notConnected: tlNotConn,
        connectRate: tlRate
      };
    }).filter(item => {
      if (!q) return true;
      const matchTL = (item.tl.name || '').toLowerCase().includes(q) ||
                      (item.tl.email || '').toLowerCase().includes(q);
      return matchTL || item.filteredAgents.length > 0;
    });
  }, [teamLeads, empStatsMap, search]);

  const rangeLabel = formatRangeLabel(dateRange);

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
        <div className="h-20 bg-white rounded-2xl animate-pulse border border-gray-100" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-2xl animate-pulse border border-gray-100" />
          ))}
        </div>
        <div className="h-96 bg-white rounded-2xl animate-pulse border border-gray-100" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* ── Error Banner ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-3.5 rounded-2xl flex items-center justify-between text-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => loadData(true)} className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700">
            Retry
          </button>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Team Leaders</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage and monitor your team's leadership performance · {rangeLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search Team Leader or agent…"
              className="w-full pl-9 pr-8 py-2 bg-white rounded-xl text-xs border border-gray-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-gray-800 placeholder-gray-400 transition-colors"
            />
            {search && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Date Filter */}
          <DateRangeFilter value={dateRange} onChange={setDateRange} />

          {/* Refresh */}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <motion.span
              animate={{ rotate: refreshing ? 360 : 0 }}
              transition={{ duration: 1, repeat: refreshing ? Infinity : 0 }}
            >
              <RefreshCw size={14} />
            </motion.span>
            <span className="hidden sm:inline">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>
      </motion.div>

      {/* ── KPI Summary Row (5 Admin-Style Cards) ─────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white mb-3 shadow-md shadow-blue-500/10"
            style={{ background: 'linear-gradient(135deg,#2563EB,#3B82F6)' }}>
            <Users size={18} />
          </div>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{totalTLs}</p>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-1">Team Leaders</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Assigned to your hierarchy</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white mb-3 shadow-md shadow-indigo-500/10"
            style={{ background: 'linear-gradient(135deg,#6366F1,#818CF8)' }}>
            <UserCheck size={18} />
          </div>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{totalAgents}</p>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-1">Total Agents</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Across all 9 leaders</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white mb-3 shadow-md shadow-emerald-500/10"
            style={{ background: 'linear-gradient(135deg,#16A34A,#22C55E)' }}>
            <CheckCircle size={18} />
          </div>
          <p className="text-2xl font-bold text-emerald-600 tabular-nums">{activeAgents}</p>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-1">Active Agents</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Currently active</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white mb-3 shadow-md shadow-teal-500/10"
            style={{ background: 'linear-gradient(135deg,#0D9488,#14B8A6)' }}>
            <Phone size={18} />
          </div>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{totalCalls}</p>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-1">Total Calls</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{rangeLabel}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow col-span-2 sm:col-span-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white mb-3 shadow-md shadow-amber-500/10"
            style={{ background: 'linear-gradient(135deg,#D97706,#F59E0B)' }}>
            <TrendingUp size={18} />
          </div>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{connectRate}%</p>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-1">Connect Rate</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{connectedCalls} connected</p>
        </div>
      </div>

      {/* ── Team Leaders List with Nested Agent Performance ───────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-bold text-gray-900">
            Team Leader Performance ({processedTLs.length})
          </h2>
          <span className="text-xs text-gray-400">
            Click any row to expand agent breakdown
          </span>
        </div>

        {processedTLs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <Users size={24} />
            </div>
            <p className="font-semibold text-gray-900 text-base">
              {search ? 'No matching Team Leaders or agents' : 'No Team Leaders Assigned'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {search ? 'Try clearing your search query.' : 'Contact your Administrator to assign Team Leaders to your hierarchy.'}
            </p>
          </div>
        ) : (
          processedTLs.map(({ tl, allAgents: agents, filteredAgents, calls, connected, notConnected, connectRate: cr }) => {
            const isExp = expanded[tl._id] !== false;
            const currentAgentPage = agentPages[tl._id] || 1;
            const totalAgentPages = Math.max(1, Math.ceil(filteredAgents.length / AGENTS_PER_PAGE));
            const safeAgentPage = Math.min(currentAgentPage, totalAgentPages);

            const paginatedAgents = filteredAgents.slice(
              (safeAgentPage - 1) * AGENTS_PER_PAGE,
              safeAgentPage * AGENTS_PER_PAGE
            );

            return (
              <div
                key={tl._id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-200 hover:border-gray-200"
              >
                {/* TL Card Header / Summary Row */}
                <div
                  onClick={() => toggleExpand(tl._id)}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-base font-bold flex-shrink-0 shadow-md shadow-blue-500/10"
                      style={{ background: 'linear-gradient(135deg,#2563EB,#60A5FA)' }}
                    >
                      {(tl.name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-gray-900">{tl.name}</h3>
                        <ActiveBadge active={tl.isActive} />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500">
                        {tl.email && (
                          <span className="flex items-center gap-1">
                            <Mail size={12} className="text-gray-400" /> {tl.email}
                          </span>
                        )}
                        {tl.phone && (
                          <span className="flex items-center gap-1">
                            <Phone size={12} className="text-gray-400" /> {tl.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* TL Summary Metrics */}
                  <div className="flex items-center gap-6 justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100">
                    <div className="text-center sm:text-right">
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Agents</p>
                      <p className="text-base font-bold text-gray-900 tabular-nums">{agents.length}</p>
                    </div>
                    <div className="text-center sm:text-right">
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Calls</p>
                      <p className="text-base font-bold text-gray-900 tabular-nums">{calls}</p>
                    </div>
                    <div className="text-center sm:text-right">
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Connected</p>
                      <p className="text-base font-bold text-emerald-600 tabular-nums">{connected}</p>
                    </div>
                    <div className="text-center sm:text-right hidden md:block">
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Not Conn.</p>
                      <p className="text-base font-bold text-gray-500 tabular-nums">{notConnected}</p>
                    </div>
                    <div className="text-center sm:text-right min-w-[90px]">
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Connect Rate</p>
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="text-base font-bold text-blue-600 tabular-nums">{cr}%</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-transform duration-200"
                      style={{ transform: isExp ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >
                      <ChevronDown size={18} />
                    </button>
                  </div>
                </div>

                {/* Nested Agent Performance Section (Expandable) */}
                <AnimatePresence>
                  {isExp && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-gray-100 bg-gray-50/50"
                    >
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                            Agent Performance ({filteredAgents.length} agents)
                          </p>
                          <span className="text-xs text-gray-400">
                            Showing page {safeAgentPage} of {totalAgentPages}
                          </span>
                        </div>

                        {filteredAgents.length === 0 ? (
                          <p className="text-xs text-gray-400 italic py-3 text-center">
                            No agents match your filter criteria under this Team Leader.
                          </p>
                        ) : (
                          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-gray-50/75 border-b border-gray-100">
                                    {['Agent', 'Calls', 'Connected', 'Not Connected', 'Connect Rate', 'Daily Target', 'Status'].map(h => (
                                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {paginatedAgents.map((agent) => (
                                    <tr key={agent._id} className="hover:bg-blue-50/20 transition-colors">
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-2.5">
                                          <div
                                            className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                                            style={{ background: '#64748B' }}
                                          >
                                            {(agent.name || '?')[0].toUpperCase()}
                                          </div>
                                          <div className="min-w-0">
                                            <p className="font-semibold text-gray-900 truncate max-w-[160px] text-xs">{agent.name}</p>
                                            {agent.phone && <p className="text-[10px] text-gray-400">{agent.phone}</p>}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 tabular-nums font-semibold text-gray-900 text-xs">{agent.calls}</td>
                                      <td className="px-4 py-3 tabular-nums font-semibold text-emerald-600 text-xs">{agent.connected}</td>
                                      <td className="px-4 py-3 tabular-nums text-gray-500 text-xs">{agent.notConnected}</td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                          <div className="w-12 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                            <div className="h-full rounded-full bg-blue-600" style={{ width: `${agent.rate}%` }} />
                                          </div>
                                          <span className="tabular-nums text-xs font-semibold text-blue-600">{agent.rate}%</span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        {agent.target > 0 ? (
                                          <span className="text-xs tabular-nums text-gray-700 font-medium">{agent.target}</span>
                                        ) : (
                                          <span className="text-xs text-gray-400">—</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3"><ActiveBadge active={agent.isActive} /></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Pagination footer per Team Leader */}
                            {filteredAgents.length > AGENTS_PER_PAGE && (
                              <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-2.5 border-t border-gray-100 gap-2 bg-white">
                                <p className="text-[11px] text-gray-500 font-medium">
                                  Showing <span className="font-semibold text-gray-700">{(safeAgentPage - 1) * AGENTS_PER_PAGE + 1}</span>–
                                  <span className="font-semibold text-gray-700">{Math.min(safeAgentPage * AGENTS_PER_PAGE, filteredAgents.length)}</span> of{' '}
                                  <span className="font-semibold text-gray-700">{filteredAgents.length}</span> agents
                                </p>
                                <Pagination
                                  page={safeAgentPage}
                                  pages={totalAgentPages}
                                  onPage={(p) => setPageForTL(tl._id, p)}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
