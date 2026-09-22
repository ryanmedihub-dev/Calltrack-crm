'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import api from '../../lib/api';
import StatCard from '../StatCard';
import DateRangeFilter from '../DateRangeFilter';
import { motion } from 'framer-motion';
import { Users, CheckCircle, Phone, PhoneCall, Target, Calendar } from 'lucide-react';

// ── Icons ──────────────────────────────────────────────────────────────────────
function Ico({ size = 16, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const PhoneIco   = () => <Ico><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></Ico>;
const UsersIco   = () => <Ico><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Ico>;
const LeadIco    = () => <Ico><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></Ico>;
const CalendarIco = () => <Ico><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Ico>;
const RefreshIco  = () => <Ico size={14}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></Ico>;

// ── Helpers ───────────────────────────────────────────────────────────────────
function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs"
      style={{ background: '#0F172A', color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
      <p style={{ color: '#94A3B8' }}>Hour {label}</p>
      {payload.map((p, i) => <p key={i} className="font-bold">{p.name}: {p.value}</p>)}
    </div>
  );
}

function EmptyState({ icon, title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: '#EFF6FF', color: '#2563EB' }}>
        {icon}
      </div>
      <p className="font-semibold" style={{ color: '#0F172A' }}>{title}</p>
      {sub && <p className="text-sm" style={{ color: '#94A3B8' }}>{sub}</p>}
    </div>
  );
}

function SectionCard({ title, action, children }) {
  return (
    <div className="bg-white rounded-2xl border overflow-hidden"
      style={{ borderColor: '#E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid #F1F5F9' }}>
        <h3 className="font-bold text-sm" style={{ color: '#0F172A' }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// Status badge
function ActiveBadge({ active }) {
  return active !== false
    ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(22,163,74,0.08)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.22)' }}>
        Active
      </span>
    : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
        Inactive
      </span>;
}

// ── Main TL Dashboard Component ────────────────────────────────────────────────
export default function TLDashboard({ user }) {
  const [hierarchy,    setHierarchy]    = useState(null);
  const [callStats,    setCallStats]    = useState(null);
  const [leadCounts,   setLeadCounts]   = useState({ total: 0, followUp: 0 });
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [dateRange,    setDateRange]    = useState({ range: 'today', startDate: null, endDate: null });
  const dateRangeRef = useRef(dateRange);

  useEffect(() => { dateRangeRef.current = dateRange; }, [dateRange]);

  // ── Fetch hierarchy (only needed once) ───────────────────────────────────────
  useEffect(() => {
    api.get('/api/users/hierarchy')
      .then(r => setHierarchy(r.data.data))
      .catch(() => setHierarchy({ managers: [], unassignedTLs: [], unassignedAgents: [] }));
  }, []);

  // ── Fetch call stats & lead counts on date range change ──────────────────────
  const fetchData = async (spin = false) => {
    if (spin) setRefreshing(true);
    try {
      const dr = dateRangeRef.current;
      const params = { range: dr.range };
      if (dr.range === 'custom') {
        params.startDate = dr.startDate;
        params.endDate   = dr.endDate;
      }

      const [callsRes, leadsRes, followupRes] = await Promise.allSettled([
        api.get('/api/calls/stats', { params }),
        api.get('/api/leads', { params: { ...params, limit: 1 } }),
        api.get('/api/leads', { params: { ...params, status: 'follow_up', limit: 1 } }),
      ]);

      if (callsRes.status === 'fulfilled') setCallStats(callsRes.value.data?.data || null);
      const total    = leadsRes.status    === 'fulfilled' ? (leadsRes.value.data?.data?.total    ?? 0) : 0;
      const followUp = followupRes.status === 'fulfilled' ? (followupRes.value.data?.data?.total ?? 0) : 0;
      setLeadCounts({ total, followUp });
    } catch { /* handled per-request */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, [dateRange]);

  // ── Derived hierarchy data ─────────────────────────────────────────────────
  // For a TL, /api/users/hierarchy returns:
  //   data: { managers: [{ manager, teamLeads: [{ tl, agents }] }] }
  const myTLNode  = hierarchy?.managers?.[0]?.teamLeads?.[0];
  const myAgents  = myTLNode?.agents || [];

  // Build a map of employeeId → call stats from the scoped /api/calls/stats response.
  const empStatsMap = {};
  (callStats?.employeeStats || []).forEach(e => { empStatsMap[e.employeeId] = e; });

  // KPI values
  const totalEmployees   = myAgents.length;
  const activeEmployees  = myAgents.filter(a => a.isActive !== false).length;

  // The /api/calls/stats response shape nests per-period stats under .selected
  // (for the chosen range) or .today (for the today range). The root-level
  // callStats object does NOT have .totalCalls directly. Reading it from the
  // wrong level always produced 0, hiding the Period Calls KPI and the chart.
  const selectedStats  = callStats?.selected || callStats?.today || callStats;
  const totalCalls     = selectedStats?.totalCalls    ?? callStats?.totalToday ?? 0;
  const connectedCalls = selectedStats?.connectedCalls ?? 0;
  const connectRate    = pct(connectedCalls, totalCalls);
  const hourlyData     = selectedStats?.callsPerHour  || callStats?.callsPerHour || [];

  const greeting = (() => {
    const h = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }));
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();

  if (loading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="h-24 bg-white rounded-2xl animate-pulse" style={{ border: '1px solid #E2E8F0' }} />
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" style={{ border: '1px solid #E2E8F0' }} />
          ))}
        </div>
        <div className="h-64 bg-white rounded-2xl animate-pulse" style={{ border: '1px solid #E2E8F0' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-6"
        style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#0F172A' }}>
            {greeting}, {user?.name?.split(' ')[0] || 'Team Lead'}
          </h1>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
            Your team&apos;s call operations and employee performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <button onClick={() => fetchData(true)} disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: '#2563EB', color: '#fff', opacity: refreshing ? 0.7 : 1 }}>
            <motion.span animate={{ rotate: refreshing ? 360 : 0 }}
              transition={{ duration: 1, repeat: refreshing ? Infinity : 0 }}>
              <RefreshIco />
            </motion.span>
            <span className="hidden sm:inline">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>
      </motion.div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="My Employees"      value={totalEmployees}   icon={<Users size={20} />} color="blue"   sub="Assigned to you" />
        <StatCard title="Active Employees"  value={activeEmployees}  icon={<CheckCircle size={20} />} color="green"  sub={`of ${totalEmployees} total`} />
        <StatCard title="Period Calls"      value={totalCalls}       icon={<Phone size={20} />} color="teal"   sub="Selected period" />
        <StatCard title="Connected Calls"   value={connectedCalls}   icon={<PhoneCall size={20} />} color="green"  sub={`${connectRate}% connect rate`} />
        <StatCard title="Assigned Leads"    value={leadCounts.total} icon={<Target size={20} />} color="purple" sub="Your team's leads" />
        <StatCard title="Pending Follow-ups" value={leadCounts.followUp} icon={<Calendar size={20} />} color="orange" sub="Awaiting follow-up" />
      </motion.div>

      {/* ── Hourly Call Activity ──────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <SectionCard title="Hourly Call Activity"
          action={
            <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>
              Hourly call activity for the selected date range
            </span>
          }>
          {!callStats || totalCalls === 0 ? (
            <EmptyState icon={<PhoneIco />} title="No calls yet" sub="Data will appear once your team starts making calls." />
          ) : (
            <div className="px-4 pb-4 pt-2">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hourlyData} barCategoryGap="40%"
                  margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tlBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fill: '#94A3B8', fontSize: 10 }}
                    tickFormatter={h => `${h}h`} axisLine={false} tickLine={false} interval={1} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false}
                    width={28} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(37,99,235,0.05)', radius: 6 }} />
                  <Bar dataKey="count" fill="url(#tlBarGrad)" radius={[6, 6, 0, 0]} name="Calls" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </motion.div>

      {/* ── Employee Performance ─────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <SectionCard title="Employee Performance"
          action={
            <Link href="/employees/overview" className="text-sm font-semibold" style={{ color: '#2563EB' }}>
              View All Employees →
            </Link>
          }>
          {myAgents.length === 0 ? (
            <EmptyState icon={<UsersIco />}
              title="No employees assigned yet"
              sub="Employees will appear here once an Administrator assigns them to your Team Lead profile." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #F1F5F9' }}>
                    {['Employee', 'Phone / Email', 'Calls', 'Connected', 'Connect Rate', 'Target Achieved', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: '#94A3B8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {myAgents.map((agent, i) => {
                    const es     = empStatsMap[agent._id?.toString()] || {};
                    const calls  = es.count          || 0;
                    const conn   = es.connectedCalls  || 0;
                    const rate   = pct(conn, calls);
                    const target = agent.dailyTarget   || 0;
                    const achiev = target > 0 ? Math.round((calls / target) * 100) : null;
                    return (
                      <tr key={agent._id}
                        style={{ borderBottom: i < myAgents.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                        className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ background: 'linear-gradient(135deg,#2563EB,#60A5FA)' }}>
                              {(agent.name || '?')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate" style={{ color: '#0F172A' }}>{agent.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs" style={{ color: '#64748B' }}>
                          <p className="truncate">{agent.phone || '—'}</p>
                          <p className="truncate text-[11px]" style={{ color: '#94A3B8' }}>{agent.email}</p>
                        </td>
                        <td className="px-4 py-3.5 tabular-nums font-semibold" style={{ color: '#334155' }}>{calls}</td>
                        <td className="px-4 py-3.5 tabular-nums" style={{ color: '#16A34A' }}>{conn}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full" style={{ background: '#E2E8F0', maxWidth: 70 }}>
                              <div className="h-full rounded-full" style={{ width: `${rate}%`, background: rate >= 50 ? '#16A34A' : '#2563EB' }} />
                            </div>
                            <span className="tabular-nums text-xs font-semibold" style={{ color: '#2563EB' }}>{rate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {achiev !== null ? (
                            <span className="text-xs tabular-nums font-semibold px-2 py-0.5 rounded-full"
                              style={{
                                background: achiev >= 80 ? 'rgba(22,163,74,0.08)' : achiev >= 50 ? 'rgba(217,119,6,0.08)' : 'rgba(220,38,38,0.08)',
                                color: achiev >= 80 ? '#16A34A' : achiev >= 50 ? '#D97706' : '#DC2626',
                              }}>
                              {achiev}% ({calls}/{target})
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: '#94A3B8' }}>No target</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5"><ActiveBadge active={agent.isActive} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </motion.div>

      {/* ── Quick Links ───────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Call Overview',    href: '/calls/overview',         icon: <PhoneIco /> },
            { label: 'Lead Overview',    href: '/leads/overview',         icon: <LeadIco /> },
            { label: 'Pending Follow-ups', href: '/leads/follow-ups',     icon: <CalendarIco /> },
            { label: 'Leaderboard',      href: '/employees/leaderboard',   icon: <UsersIco /> },
          ].map(({ label, href, icon }) => (
            <Link key={href} href={href}
              className="bg-white flex items-center gap-3 rounded-2xl p-4 border hover:border-blue-300 transition-all group"
              style={{ borderColor: '#E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ background: '#EFF6FF', color: '#2563EB' }}>
                {icon}
              </div>
              <span className="text-sm font-semibold" style={{ color: '#0F172A' }}>{label}</span>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
