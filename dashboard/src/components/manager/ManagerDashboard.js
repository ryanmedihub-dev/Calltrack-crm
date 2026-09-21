'use client';
import { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList
} from 'recharts';
import api from '../../lib/api';
import Pagination from '../Pagination';
import DateRangeFilter, { formatRangeLabel, rangeToDates } from '../DateRangeFilter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserCheck, Phone, CheckCircle, PhoneOff, TrendingUp,
  Target, Calendar, Search, Filter, AlertTriangle, ArrowRight, Clock
} from 'lucide-react';

// ── Icons matching Admin Panel ──────────────────────────────────────────────────
function Ico({ size = 18, children, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      {children}
    </svg>
  );
}

const PhoneIco    = () => <Ico><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></Ico>;
const CheckIco    = () => <Ico><polyline points="20 6 9 17 4 12" /></Ico>;
const PhoneOffIco = () => <Ico><line x1="1" y1="1" x2="23" y2="23" /><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88" /></Ico>;
const TrendRateIco= () => <Ico><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></Ico>;
const InIco       = () => <Ico><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></Ico>;
const OutIco      = () => <Ico><polyline points="1 6 10.5 15.5 15.5 10.5 23 18" /><polyline points="7 6 1 6 1 12" /></Ico>;
const UsersIco    = () => <Ico><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Ico>;
const LeadIco     = () => <Ico size={16}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></Ico>;
const ChevronIco  = () => <Ico size={13}><polyline points="9 18 15 12 9 6" /></Ico>;
const RefreshIco  = () => <Ico size={14}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></Ico>;
const TrendUpIco  = () => <Ico size={12}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></Ico>;
const TrendDnIco  = () => <Ico size={12}><polyline points="1 6 10.5 15.5 15.5 10.5 23 18" /><polyline points="7 18 1 18 1 12" /></Ico>;

// ── Lead Status Config (identical to Admin) ───────────────────────────────────
const LEAD_STATUSES = [
  { key: 'new', label: 'New', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { key: 'contacted', label: 'Contacted', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { key: 'interested', label: 'Interested', color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4' },
  { key: 'converted', label: 'Converted', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { key: 'lost', label: 'Lost', color: '#DC2626', bg: '#FFF1F2', border: '#FECACA' },
];

function trend(cur, prev) {
  if (!prev || prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function utcHourLabel(utcHour, tz = 'Asia/Kolkata') {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), parseInt(utcHour), 0, 0));
  const h = parseInt(d.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false })) % 24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}${ampm}`;
}

// ── Admin-Style KPI Card ───────────────────────────────────────────────────────
const KpiCard = ({ label, value, Icon, grad, href, delta, idx, sub }) => {
  const card = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05, duration: 0.35 }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      className="group bg-white rounded-2xl p-5 border border-gray-100 hover:border-blue-200 hover:shadow-xl transition-all duration-300 cursor-pointer h-full flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-500/10"
            style={{ background: grad }}
          >
            <Icon />
          </div>
          {href && (
            <motion.span
              className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
              <ChevronIco />
            </motion.span>
          )}
        </div>
        <p className="text-2xl font-bold text-gray-900 tracking-tight tabular-nums">
          {value ?? '—'}
        </p>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">
          {label}
        </p>
      </div>
      <div>
        {sub && (
          <p className="text-[11px] text-gray-400 mt-1 font-medium truncate">{sub}</p>
        )}
        {delta !== null && delta !== undefined && (
          <div className="flex items-center gap-1 mt-2 text-xs font-semibold">
            <span className={`flex items-center gap-0.5 ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {delta >= 0 ? <TrendUpIco /> : <TrendDnIco />}
              {Math.abs(delta)}% vs yesterday
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
};

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white rounded-xl px-3.5 py-2.5 text-xs shadow-2xl">
      <p className="text-gray-400">{utcHourLabel(label)}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-bold mt-0.5">{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

function SectionCard({ title, action, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
        <h3 className="font-bold text-sm text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
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

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ManagerDashboard({ user }) {
  const [hierarchy,    setHierarchy]    = useState(null);
  const [callStats,    setCallStats]    = useState(null);
  const [leadStats,    setLeadStats]    = useState({});
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [refreshing,   setRefreshing]   = useState(false);
  const [dateRange,    setDateRange]    = useState({ range: 'today', startDate: null, endDate: null });
  const [agentPage,    setAgentPage]    = useState(1);
  const [agentSearch,  setAgentSearch]  = useState('');
  const [selectedTL,   setSelectedTL]   = useState('all');
  const dateRangeRef = useRef(dateRange);

  useEffect(() => {
    dateRangeRef.current = dateRange;
    setAgentPage(1);
  }, [dateRange]);

  // Fetch hierarchy once
  useEffect(() => {
    api.get('/api/users/hierarchy')
      .then(r => setHierarchy(r.data.data))
      .catch(() => setHierarchy({ managers: [], unassignedTLs: [], unassignedAgents: [] }));
  }, []);

  // Fetch call stats & lead stats on date change
  const fetchData = async (spin = false) => {
    if (spin) setRefreshing(true);
    setError(null);
    try {
      const dr = dateRangeRef.current;
      const params = { range: dr.range };
      if (dr.range === 'custom') {
        params.startDate = dr.startDate;
        params.endDate   = dr.endDate;
      }

      // Fetch calls stats and leads stats in parallel
      const [callsRes, ...leadsResults] = await Promise.all([
        api.get('/api/calls/stats', { params }),
        ...LEAD_STATUSES.map(s =>
          api.get('/api/leads', { params: { ...params, status: s.key, limit: 1 } })
            .then(r => ({ key: s.key, count: r.data.data?.total ?? 0 }))
            .catch(() => ({ key: s.key, count: 0 }))
        )
      ]);

      setCallStats(callsRes.data?.data || null);

      const map = {};
      leadsResults.forEach(r => { map[r.key] = r.count; });
      setLeadStats(map);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load manager dashboard data. Please retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, [dateRange]);

  // Derived hierarchy data
  const myNode     = hierarchy?.managers?.[0];
  const teamLeads  = myNode?.teamLeads || [];
  const allAgents  = teamLeads.flatMap(tl => tl.agents || []);

  const totalTLs      = teamLeads.length;
  const totalAgents   = allAgents.length;
  const activeAgents  = allAgents.filter(a => a.isActive !== false).length;

  // Selected date range call stats
  const selectedStats    = callStats?.selected || callStats?.today || callStats;
  const yesterdayStats   = callStats?.yesterday;
  const totalCalls       = selectedStats?.totalCalls ?? callStats?.totalCalls ?? callStats?.totalToday ?? 0;
  const connectedCalls   = selectedStats?.connectedCalls ?? callStats?.connectedCalls ?? 0;
  const notConnectedCalls= Math.max(0, totalCalls - connectedCalls);
  const connectRate      = pct(connectedCalls, totalCalls);
  const incomingCalls    = selectedStats?.incoming ?? 0;
  const outgoingCalls    = selectedStats?.outgoing ?? 0;
  const hourlyData       = selectedStats?.callsPerHour || callStats?.callsPerHour || [];
  const empStatsList     = selectedStats?.employeeStats || callStats?.employeeStats || [];

  const isTodayRange = dateRange.range === 'today';
  const rangeLabel   = formatRangeLabel(dateRange);
  const { fromDate, toDate } = rangeToDates(dateRange);

  const empStatsMap = {};
  (empStatsList || []).forEach(e => {
    if (e.employeeId) empStatsMap[e.employeeId] = e;
  });

  // Per-TL aggregated metrics
  const tlStats = useMemo(() => {
    return teamLeads.map(({ tl, agents }) => {
      let calls = 0, connected = 0;
      (agents || []).forEach(agent => {
        const es   = empStatsMap[agent._id?.toString()] || {};
        calls     += es.count          || 0;
        connected += es.connectedCalls || 0;
      });
      const notConn = Math.max(0, calls - connected);
      return {
        tl,
        agents: agents || [],
        calls,
        connected,
        notConnected: notConn,
        connectRate: pct(connected, calls)
      };
    });
  }, [teamLeads, empStatsMap]);

  // Agent rows
  const allAgentRows = useMemo(() => {
    return teamLeads.flatMap(({ tl, agents }) =>
      (agents || []).map((agent) => {
        const es     = empStatsMap[agent._id?.toString()] || {};
        const calls  = es.count          || 0;
        const conn   = es.connectedCalls || 0;
        const notConn= Math.max(0, calls - conn);
        const rate   = pct(conn, calls);
        const target = agent.dailyTarget || 0;
        return {
          agent,
          tl,
          calls,
          conn,
          notConn,
          rate,
          target
        };
      })
    );
  }, [teamLeads, empStatsMap]);

  const filteredAgentRows = useMemo(() => {
    return allAgentRows.filter(row => {
      if (selectedTL !== 'all' && row.tl._id?.toString() !== selectedTL) return false;
      if (agentSearch) {
        const q = agentSearch.toLowerCase().trim();
        const matchName  = (row.agent.name || '').toLowerCase().includes(q);
        const matchEmail = (row.agent.email || '').toLowerCase().includes(q);
        const matchTL    = (row.tl.name || '').toLowerCase().includes(q);
        return matchName || matchEmail || matchTL;
      }
      return true;
    });
  }, [allAgentRows, selectedTL, agentSearch]);

  const AGENT_PAGE_SIZE = 10;
  const totalAgentPages = Math.max(1, Math.ceil(filteredAgentRows.length / AGENT_PAGE_SIZE));
  const currentPage = Math.min(agentPage, totalAgentPages);
  const paginatedAgents = filteredAgentRows.slice(
    (currentPage - 1) * AGENT_PAGE_SIZE,
    currentPage * AGENT_PAGE_SIZE
  );

  const totalLeads = Object.values(leadStats).reduce((a, b) => a + b, 0);

  const greeting = (() => {
    const h = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }));
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  // 6 KPI cards matching Admin presentation
  const KPI_CARDS = [
    {
      key: 'totalCalls',
      label: 'Total Calls',
      value: totalCalls,
      Icon: PhoneIco,
      grad: 'linear-gradient(135deg,#2563EB,#3B82F6)',
      href: `/reports/calllogs?fromDate=${fromDate}&toDate=${toDate}`,
      delta: isTodayRange ? trend(totalCalls, yesterdayStats?.totalCalls) : null,
      sub: `${rangeLabel} activity`
    },
    {
      key: 'connectedCalls',
      label: 'Connected Calls',
      value: connectedCalls,
      Icon: CheckIco,
      grad: 'linear-gradient(135deg,#0D9488,#14B8A6)',
      href: `/reports/calllogs?fromDate=${fromDate}&toDate=${toDate}&callType=connected`,
      delta: isTodayRange ? trend(connectedCalls, yesterdayStats?.connectedCalls) : null,
      sub: `${connectRate}% connect rate`
    },
    {
      key: 'notConnected',
      label: 'Not Connected',
      value: notConnectedCalls,
      Icon: PhoneOffIco,
      grad: 'linear-gradient(135deg,#DC2626,#EF4444)',
      href: `/reports/calllogs?fromDate=${fromDate}&toDate=${toDate}&callType=missed`,
      delta: null,
      sub: 'Unanswered / missed'
    },
    {
      key: 'connectRate',
      label: 'Connect Rate',
      value: `${connectRate}%`,
      Icon: TrendRateIco,
      grad: 'linear-gradient(135deg,#16A34A,#22C55E)',
      href: null,
      delta: null,
      sub: `${connectedCalls} of ${totalCalls} calls`
    },
    {
      key: 'incoming',
      label: 'Incoming',
      value: incomingCalls,
      Icon: InIco,
      grad: 'linear-gradient(135deg,#16A34A,#22C55E)',
      href: `/reports/calllogs?fromDate=${fromDate}&toDate=${toDate}&callType=incoming`,
      delta: isTodayRange ? trend(incomingCalls, yesterdayStats?.incoming) : null,
      sub: 'Incoming calls'
    },
    {
      key: 'outgoing',
      label: 'Outgoing',
      value: outgoingCalls,
      Icon: OutIco,
      grad: 'linear-gradient(135deg,#D97706,#F59E0B)',
      href: `/reports/calllogs?fromDate=${fromDate}&toDate=${toDate}&callType=outgoing`,
      delta: isTodayRange ? trend(outgoingCalls, yesterdayStats?.outgoing) : null,
      sub: 'Outgoing calls'
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-24 bg-white rounded-2xl animate-pulse border border-gray-100" />
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-2xl animate-pulse border border-gray-100" />
          ))}
        </div>
        <div className="h-44 bg-white rounded-2xl animate-pulse border border-gray-100" />
        <div className="h-72 bg-white rounded-2xl animate-pulse border border-gray-100" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Error Banner (if any) ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-3.5 rounded-2xl flex items-center justify-between text-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => fetchData(true)} className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700">
            Retry
          </button>
        </div>
      )}

      {/* ── Header (Matching Admin Dashboard) ────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {greeting}, {user?.name?.split(' ')[0] || 'Manager'}
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
            <Clock size={14} className="text-gray-400" />
            {todayLabel} · Team performance & operations overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <motion.span
              animate={{ rotate: refreshing ? 360 : 0 }}
              transition={{ duration: 1, repeat: refreshing ? Infinity : 0 }}
            >
              <RefreshIco />
            </motion.span>
            <span className="hidden sm:inline">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>
      </motion.div>

      {/* ── KPI Grid (Total, Connected, Not Connected, Rate, In, Out) ────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {KPI_CARDS.map((cfg, i) => (
          <KpiCard
            key={cfg.key}
            idx={i}
            label={cfg.label}
            value={cfg.value}
            Icon={cfg.Icon}
            grad={cfg.grad}
            href={cfg.href}
            delta={cfg.delta}
            sub={cfg.sub}
          />
        ))}
      </div>

      {/* ── Lead Pipeline Section (Identical to Admin Dashboard) ──────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <LeadIco />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Lead Pipeline</h3>
              <p className="text-xs text-gray-500">{totalLeads} total leads in team scope</p>
            </div>
          </div>
          <Link
            href={`/reports/lead?fromDate=${fromDate}&toDate=${toDate}`}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200 inline-flex items-center gap-1"
          >
            View all <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {LEAD_STATUSES.map((s, i) => {
            const count = leadStats[s.key] ?? 0;
            const pctVal = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
            return (
              <Link href={`/reports/lead?status=${s.key}&fromDate=${fromDate}&toDate=${toDate}`} key={s.key}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 + 0.25 }}
                  whileHover={{ y: -2 }}
                  className="bg-gray-50 hover:bg-white rounded-xl p-4 border border-gray-100 hover:border-gray-200 transition-all duration-300 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: s.color }}>
                      {s.label}
                    </span>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: s.bg, color: s.color }}
                    >
                      {pctVal}%
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">
                    {leadStats[s.key] === undefined ? '—' : count}
                  </p>
                  <div className="mt-3 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pctVal}%` }}
                      transition={{ delay: i * 0.04 + 0.35, duration: 0.6 }}
                      className="h-full rounded-full"
                      style={{ background: s.color }}
                    />
                  </div>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </motion.div>

      {/* ── Hourly Call Activity ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Calls Per Hour</h3>
            <p className="text-xs text-gray-500 mt-1">{rangeLabel} activity · IST timezone</p>
          </div>
          <div className="flex items-center gap-3">
            {isTodayRange && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full border border-green-100">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-semibold text-green-600">Live</span>
              </div>
            )}
            <Link href="/calls/overview" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
              Overview →
            </Link>
          </div>
        </div>

        {totalCalls === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Phone size={20} />
            </div>
            <p className="font-semibold text-gray-900 text-sm">No calls recorded</p>
            <p className="text-xs text-gray-400 mt-0.5">Calls will appear here once your agents start making calls for {rangeLabel.toLowerCase()}.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hourlyData} barCategoryGap="40%" margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mgBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis
                dataKey="hour"
                tick={{ fill: '#94A3B8', fontSize: 10 }}
                tickFormatter={(h) => utcHourLabel(h)}
                axisLine={false}
                tickLine={false}
                interval={1}
              />
              <YAxis
                tick={{ fill: '#94A3B8', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={28}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(37,99,235,0.05)', radius: 6 }} />
              <Bar dataKey="count" fill="url(#mgBarGrad)" radius={[6, 6, 0, 0]} name="Calls">
                <LabelList
                  dataKey="count"
                  position="top"
                  style={{ fontSize: 9, fill: '#94A3B8', fontWeight: 600 }}
                  formatter={(v) => (v > 0 ? v : '')}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* ── Team Leader Performance Section ──────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <SectionCard
          title="Team Leader Performance"
          action={
            <Link href="/team-leads" className="text-sm font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
              View All Team Leaders <ArrowRight size={13} />
            </Link>
          }
        >
          {teamLeads.length === 0 ? (
            <div className="py-12 text-center">
              <Users size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-800">No Team Leaders Assigned</p>
              <p className="text-xs text-gray-400 mt-1">Contact your Administrator to assign Team Leaders to your account.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-100">
                    {['Team Leader', 'Agents', 'Calls', 'Connected', 'Not Connected', 'Connect Rate', 'Status'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tlStats.map(({ tl, agents, calls, connected, notConnected, connectRate: cr }) => (
                    <tr key={tl._id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg,#2563EB,#60A5FA)' }}
                          >
                            {(tl.name || '?')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{tl.name}</p>
                            <p className="text-xs text-gray-400 truncate">{tl.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 tabular-nums font-semibold text-gray-700">{agents.length}</td>
                      <td className="px-5 py-3.5 tabular-nums font-semibold text-gray-900">{calls}</td>
                      <td className="px-5 py-3.5 tabular-nums font-semibold text-emerald-600">{connected}</td>
                      <td className="px-5 py-3.5 tabular-nums text-gray-500">{notConnected}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-gray-100 max-w-[80px]">
                            <div className="h-full rounded-full bg-blue-600" style={{ width: `${cr}%` }} />
                          </div>
                          <span className="tabular-nums text-xs font-semibold text-blue-600">{cr}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5"><ActiveBadge active={tl.isActive} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </motion.div>

      {/* ── Agent Performance Table ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <SectionCard
          title="Agent Performance"
          action={
            <Link href="/employees/overview" className="text-sm font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
              View All <ArrowRight size={13} />
            </Link>
          }
        >
          {allAgents.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              No agents in your team yet. Agents will appear once assigned to your Team Leaders.
            </div>
          ) : (
            <div>
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search agent or Team Leader..."
                    value={agentSearch}
                    onChange={(e) => { setAgentSearch(e.target.value); setAgentPage(1); }}
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-800 placeholder-gray-400 transition-colors"
                  />
                  {agentSearch && (
                    <button
                      onClick={() => { setAgentSearch(''); setAgentPage(1); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={13} className="text-gray-400 flex-shrink-0" />
                  <select
                    value={selectedTL}
                    onChange={(e) => { setSelectedTL(e.target.value); setAgentPage(1); }}
                    className="w-full sm:w-auto text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 text-gray-700 font-medium transition-colors"
                  >
                    <option value="all">All Team Leaders ({teamLeads.length})</option>
                    {teamLeads.map(({ tl }) => (
                      <option key={tl._id} value={tl._id?.toString()}>{tl.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredAgentRows.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  No agents match your filter criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/75 border-b border-gray-100">
                        {['Agent', 'Team Leader', 'Calls', 'Connected', 'Not Connected', 'Rate', 'Daily Target', 'Status'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginatedAgents.map(({ agent, tl, calls, conn, notConn, rate, target }) => (
                        <tr key={agent._id} className="hover:bg-blue-50/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                                style={{ background: '#64748B' }}
                              >
                                {(agent.name || '?')[0].toUpperCase()}
                              </div>
                              <p className="font-medium text-gray-900 truncate max-w-[150px]">{agent.name}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 font-medium">
                            {tl.name}
                          </td>
                          <td className="px-4 py-3 tabular-nums font-semibold text-gray-900">{calls}</td>
                          <td className="px-4 py-3 tabular-nums font-semibold text-emerald-600">{conn}</td>
                          <td className="px-4 py-3 tabular-nums text-gray-500">{notConn}</td>
                          <td className="px-4 py-3">
                            <span
                              className="tabular-nums text-xs font-semibold"
                              style={{ color: rate >= 50 ? '#16A34A' : rate > 0 ? '#D97706' : '#94A3B8' }}
                            >
                              {rate}%
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {target > 0 ? (
                              <span className="text-xs tabular-nums text-gray-700 font-medium">{target}</span>
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
              )}

              {/* Pagination */}
              {filteredAgentRows.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3 border-t border-gray-100 gap-3 bg-white">
                  <p className="text-xs text-gray-500 font-medium">
                    Showing <span className="font-semibold text-gray-700">{(currentPage - 1) * AGENT_PAGE_SIZE + 1}</span>–
                    <span className="font-semibold text-gray-700">{Math.min(currentPage * AGENT_PAGE_SIZE, filteredAgentRows.length)}</span> of{' '}
                    <span className="font-semibold text-gray-700">{filteredAgentRows.length}</span> agents
                  </p>
                  <Pagination page={currentPage} pages={totalAgentPages} onPage={setAgentPage} />
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </motion.div>

      {/* ── Quick Navigation Links ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Team Leaders',  href: '/team-leads',       icon: <UsersIco /> },
          { label: 'Call Overview', href: '/calls/overview',   icon: <PhoneIco /> },
          { label: 'Live Monitor',  href: '/calls/live',       icon: <TrendingUp size={16} /> },
          { label: 'Lead Pipeline', href: '/leads/pipeline',   icon: <LeadIco /> },
        ].map(({ label, href, icon }) => (
          <Link key={href} href={href}
            className="bg-white flex items-center gap-3.5 rounded-2xl p-4 border border-gray-100 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              {icon}
            </div>
            <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
