'use client';
import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import api from '../../../../lib/api';
import {
  StatCard, DataTable, ChartTip, Skeleton, EmptyState, Ico,
  PhoneIco, UsersIco, TrophyIco,
} from '../../../../components/report-shared';

/* Page-specific icon — no shared equivalent (bullseye/target for "best conn. rate") */
const TargetIco = ({ s = 16 }) => (
  <Ico size={s}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></Ico>
);

/* ─── Helpers ─── */
const pct = (num, den) => (den ? Math.round((num / den) * 100) : 0);

const AVATAR_COLORS = [
  '#2563EB', '#16A34A', '#D97706', '#DC2626', '#0D9488',
  '#7C3AED', '#0891B2', '#BE185D', '#E11D48', '#F97316',
];

const MEDAL = ['#F59E0B', '#94A3B8', '#B45309'];
const MEDAL_BG = ['rgba(245,158,11,0.15)', 'rgba(148,163,184,0.12)', 'rgba(180,83,9,0.12)'];

/* ─── Main Component ─── */
const AgentReportsPage = () => {
  const [stats, setStats] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('calls');
  const [viewMode, setViewMode] = useState('table');

  useEffect(() => {
    Promise.all([api.get('/api/calls/stats'), api.get('/api/employees')])
      .then(([s, e]) => {
        setStats(s.data.data);
        setEmployees(e.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = stats?.today;
  const totalCalls = today?.totalCalls || 0;

  // ── Process agent data ──
  const agentData = employees.map((emp, i) => {
    const dialer = stats?.topDialers?.find((d) => d.employeeId === emp._id);
    const calls = dialer?.count || 0;
    const missed = dialer?.missed || 0;
    const conn = dialer?.connected || 0;
    return {
      id: emp._id,
      name: emp.name,
      role: emp.role,
      calls,
      missed,
      connected: conn,
      connRate: pct(conn, calls),
      missRate: pct(missed, calls),
      share: pct(calls, totalCalls),
      avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
      isActive: emp.isActive,
    };
  }).sort((a, b) => {
    if (sortBy === 'calls') return b.calls - a.calls;
    if (sortBy === 'connRate') return b.connRate - a.connRate;
    if (sortBy === 'missed') return b.missed - a.missed;
    return 0;
  });

  const topAgents = agentData.slice(0, 3);
  const barData = agentData.slice(0, 12).map((a) => ({
    name: a.name.split(' ')[0] || a.name,
    full: a.name,
    calls: a.calls,
    connRate: a.connRate,
  }));

  const pieData = agentData.slice(0, 8).map((a) => ({
    name: a.name.split(' ')[0] || a.name,
    value: a.calls,
    color: a.avatarColor,
  }));

  const topAgent = agentData[0];
  const bestConn = [...agentData].sort((a, b) => b.connRate - a.connRate)[0];

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="space-y-5">
          <Skeleton className="h-8 w-56" />
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Skeleton className="h-64 lg:col-span-2" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="space-y-5">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              Reports <span className="text-gray-300">/</span> <span className="text-gray-500">Agent Reports</span>
            </p>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5">Agent Reports</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Per-agent performance · {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {[['table', 'List'], ['grid', 'Grid']].map(([v, l]) => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {[['calls', 'Calls'], ['connRate', 'Conn. Rate'], ['missed', 'Missed']].map(([v, l]) => (
                <button key={v} onClick={() => setSortBy(v)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${sortBy === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Agents" value={employees.length} sub="In system" color="#2563EB" icon={<UsersIco s={16} />} />
          <StatCard label="Active Today" value={agentData.filter((a) => a.calls > 0).length} sub="Made ≥1 call" color="#16A34A" icon={<PhoneIco s={16} />} />
          <StatCard label="Top Dialer" value={topAgent?.calls || '—'} sub={topAgent?.name || 'No data'} color="#D97706" icon={<TrophyIco s={16} />} />
          <StatCard label="Best Conn. Rate" value={bestConn?.connRate != null ? `${bestConn.connRate}%` : '—'} sub={bestConn?.name || 'No data'} color="#7C3AED" icon={<TargetIco s={16} />} />
        </div>

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">Call Volume</h3>
              <span className="text-xs text-gray-400">Top 12 agents</span>
            </div>
            {barData.length === 0 ? (
              <EmptyState title="No call data today" hint="Calls will appear here once agents start dialing." />
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={barData} barCategoryGap="30%">
                  <defs>
                    <linearGradient id="agentBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} formatter={(v, n, p) => [v, p.payload.full]} />
                  <Bar dataKey="calls" name="Calls" fill="url(#agentBarGrad)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Call Distribution</h3>
            <p className="text-xs text-gray-400 mb-3">Top 8 agents</p>
            {pieData.every((d) => d.value === 0) ? (
              <EmptyState title="No data" hint="" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={72} paddingAngle={2} dataKey="value">
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color || '#CBD5E1'} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTip />} formatter={(v, n, p) => [v, p.payload.name]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Top 3 agents highlight ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {topAgents.map((a, i) => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold shrink-0" style={{ background: a.avatarColor }}>
                {a.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-gray-900 truncate">{a.name}</p>
                  {i < 3 && <span>{['🥇', '🥈', '🥉'][i]}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                  <span>{a.calls} calls</span>
                  <span>{a.connRate}% conn.</span>
                  <span>{a.missed} missed</span>
                </div>
              </div>
              <div className="w-16 h-1.5 rounded-full overflow-hidden bg-gray-100 shrink-0">
                <div className="h-full rounded-full" style={{ width: `${Math.min(a.share * 2, 100)}%`, background: a.avatarColor }} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Agent table / grid ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 flex items-center justify-between flex-wrap gap-2 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-bold text-gray-900">All Agents</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {agentData.length} agents · Sorted by {sortBy === 'calls' ? 'calls' : sortBy === 'connRate' ? 'connection rate' : 'missed calls'}
              </p>
            </div>
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-500">Total: {totalCalls} calls</span>
          </div>

          <div className="p-5">
            {viewMode === 'table' ? (
              <DataTable
                searchable={false}
                emptyTitle="No agent data available"
                columns={[
                  {
                    key: 'rank', label: '#', sortable: false, searchable: false,
                    render: (r) => {
                      const i = agentData.findIndex((x) => x.id === r.id);
                      return (
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold"
                          style={{ background: i < 3 ? MEDAL_BG[i] : '#F1F5F9', color: i < 3 ? MEDAL[i] : '#94A3B8' }}>
                          {i + 1}
                        </div>
                      );
                    },
                  },
                  {
                    key: 'name', label: 'Agent',
                    render: (r) => (
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: r.avatarColor }}>
                          {r.name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-900">{r.name}</p>
                          <p className="text-[10px] text-gray-400 capitalize">{r.role}</p>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'calls', label: 'Calls', align: 'right', searchable: false,
                    render: (r) => <span className="font-bold tabular-nums text-[15px]" style={{ color: r.calls > 0 ? '#2563EB' : '#CBD5E1' }}>{r.calls}</span>,
                  },
                  {
                    key: 'connected', label: 'Connected', align: 'right', searchable: false,
                    render: (r) => <span className="text-sm font-semibold" style={{ color: '#0D9488' }}>{r.connected}</span>,
                  },
                  {
                    key: 'connRate', label: 'Conn. Rate', align: 'right', searchable: false,
                    render: (r) => (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: r.connRate >= 70 ? 'rgba(22,163,74,0.1)' : r.connRate >= 40 ? 'rgba(217,119,6,0.1)' : 'rgba(220,38,38,0.1)',
                          color: r.connRate >= 70 ? '#16A34A' : r.connRate >= 40 ? '#D97706' : '#DC2626',
                        }}>
                        {r.connRate}%
                      </span>
                    ),
                  },
                  {
                    key: 'missed', label: 'Missed', align: 'right', searchable: false,
                    render: (r) => <span className="text-sm font-semibold text-red-600">{r.missed}</span>,
                  },
                  {
                    key: 'share', label: 'Share', align: 'right', searchable: false,
                    render: (r) => (
                      <div className="flex items-center justify-end gap-2">
                        <div className="flex-1 max-w-16 h-1.5 rounded-full overflow-hidden bg-gray-100">
                          <div className="h-full rounded-full bg-blue-600" style={{ width: `${r.share}%` }} />
                        </div>
                        <span className="text-[11px] text-gray-400">{r.share}%</span>
                      </div>
                    ),
                  },
                  {
                    key: 'isActive', label: 'Status', searchable: false,
                    render: (r) => (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${r.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                        {r.isActive ? '● Active' : '○ Inactive'}
                      </span>
                    ),
                  },
                ]}
                rows={agentData}
              />
            ) : (
              /* ─── GRID VIEW ─── */
              agentData.length === 0 ? <EmptyState title="No agent data available" hint="" /> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {agentData.map((a, i) => (
                    <div key={a.id} className="rounded-xl p-4 bg-gray-50 border border-gray-200 hover:shadow-sm transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: a.avatarColor }}>
                          {a.name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{a.name}</p>
                          <p className="text-[10px] text-gray-400 capitalize">{a.role}</p>
                        </div>
                        {i < 3 && <span>{['🥇', '🥈', '🥉'][i]}</span>}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg py-1.5 bg-gray-100">
                          <p className="text-xs font-bold text-blue-600">{a.calls}</p>
                          <p className="text-[8px] uppercase tracking-wider text-gray-400">Calls</p>
                        </div>
                        <div className="rounded-lg py-1.5 bg-gray-100">
                          <p className="text-xs font-bold" style={{ color: '#0D9488' }}>{a.connRate}%</p>
                          <p className="text-[8px] uppercase tracking-wider text-gray-400">Conn. Rate</p>
                        </div>
                        <div className="rounded-lg py-1.5 bg-gray-100">
                          <p className="text-xs font-bold text-red-600">{a.missed}</p>
                          <p className="text-[8px] uppercase tracking-wider text-gray-400">Missed</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">Share: {a.share}%</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${a.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                          {a.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentReportsPage;
