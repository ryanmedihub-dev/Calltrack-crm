'use client';
import { useEffect, useState } from 'react';
import Pusher from 'pusher-js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../../../../lib/api';
import { SkeletonKpi } from '../../../../components/Skeleton';

function Svg({ children, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const PhoneIco = () => <Svg><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></Svg>;
const UsersIco = () => <Svg><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Svg>;
const ClockIco = () => <Svg><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Svg>;
const AlertIco = () => <Svg><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></Svg>;

const TYPE_COLOR = { incoming: '#10B981', outgoing: '#F59E0B', missed: '#EF4444', rejected: '#8B5CF6' };
const TYPE_BG    = { incoming: '#ECFDF5', outgoing: '#FFFBEB', missed: '#FEF2F2', rejected: '#F5F3FF' };

function Badge({ type }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={{ color: TYPE_COLOR[type] || '#475569', background: TYPE_BG[type] || '#F1F5F9' }}>
      {type}
    </span>
  );
}

function KpiCard({ label, value, sub, Icon, color = '#1A6BFF', bg = '#EFF6FF' }) {
  return (
    <div className="bg-white border border-border rounded-2xl p-5 shadow-card hover:shadow-card-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bg, color }}>
          <Icon />
        </div>
        <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse mt-1 flex-shrink-0" />
      </div>
      <p className="text-2xl font-bold text-textPrimary leading-none">{value ?? '—'}</p>
      <p className="text-xs text-textMuted font-medium uppercase tracking-wide mt-1">{label}</p>
      {sub && <p className="text-xs text-textSecondary mt-0.5">{sub}</p>}
    </div>
  );
}

function formatDur(sec) {
  if (!sec) return '0s';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function LiveMonitorPage() {
  const [stats,     setStats]     = useState(null);
  const [liveFeed,  setLiveFeed]  = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const fetchStats = async () => {
    try {
      const res = await api.get('/api/calls/stats');
      setStats(res.data.data);
    } catch {}
  };

  useEffect(() => {
    (async () => {
      await Promise.all([
        fetchStats(),
        api.get('/api/calls/realtime').then(r => setLiveFeed((r.data.data || []).slice(0, 30))).catch(() => {}),
        api.get('/api/employees').then(r => setEmployees(r.data.data || [])).catch(() => {}),
      ]);
      setLoading(false);
    })();

    const interval = setInterval(fetchStats, 30000);
    if (!process.env.NEXT_PUBLIC_PUSHER_KEY) return () => clearInterval(interval);

    const pusher  = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2',
    });
    const channel = pusher.subscribe('managers');
    channel.bind('new_call_log', data => {
      setLiveFeed(prev => [data, ...prev].slice(0, 30));
      fetchStats();
    });
    return () => {
      clearInterval(interval);
      channel.unbind_all();
      pusher.unsubscribe('managers');
      pusher.disconnect();
    };
  }, []);

  const today  = stats?.today;
  const avgDur = today?.totalCalls ? Math.round((today.totalDuration || 0) / today.totalCalls) : 0;

  const hourlyMap = {};
  (today?.callsPerHour || []).forEach(({ _id, count }) => { hourlyMap[_id] = count; });
  const hourlyData = Array.from({ length: 24 }, (_, h) => ({
    h: `${h.toString().padStart(2, '0')}:00`,
    calls: hourlyMap[h] || 0,
  }));

  const empLastCall = {};
  liveFeed.forEach(c => {
    if (!empLastCall[c.employeeId]) empLastCall[c.employeeId] = c;
  });

  const compRows = [
    { label: 'Total Calls',     today: today?.totalCalls,    week: stats?.thisWeek?.totalCalls,    month: stats?.thisMonth?.totalCalls    },
    { label: 'Incoming',        today: today?.incoming,      week: stats?.thisWeek?.incoming,      month: stats?.thisMonth?.incoming      },
    { label: 'Outgoing',        today: today?.outgoing,      week: stats?.thisWeek?.outgoing,      month: stats?.thisMonth?.outgoing      },
    { label: 'Missed',          today: today?.missed,        week: stats?.thisWeek?.missed,        month: stats?.thisMonth?.missed        },
    { label: 'Unique Contacts', today: today?.uniqueClients, week: stats?.thisWeek?.uniqueClients, month: stats?.thisMonth?.uniqueClients },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-textPrimary">Live Monitor</h2>
          <p className="text-textMuted text-sm mt-0.5">Real-time call activity</p>
        </div>
        <SkeletonKpi count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-textPrimary flex items-center gap-2.5">
          Live Monitor
          <span className="flex items-center gap-1.5 text-xs bg-green-50 text-green-600 border border-green-200 px-2.5 py-1 rounded-full font-medium">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Live
          </span>
        </h2>
        <p className="text-textMuted text-sm mt-0.5">Real-time call activity · auto-refreshes every 30s</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Calls Today"    value={today?.totalCalls}         Icon={PhoneIco} color="#1A6BFF" bg="#EFF6FF" />
        <KpiCard label="Active Agents"  value={employees.length}           Icon={UsersIco} color="#10B981" bg="#ECFDF5" />
        <KpiCard label="Avg Duration"   value={formatDur(avgDur)}          Icon={ClockIco} color="#F59E0B" bg="#FFFBEB" sub="per call" />
        <KpiCard label="Not Picked Up"  value={today?.notPickedByClient}   Icon={AlertIco} color="#EF4444" bg="#FEF2F2" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Live Feed */}
        <div className="xl:col-span-2 bg-white border border-border rounded-2xl shadow-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h3 className="font-bold text-textPrimary">Live Call Feed</h3>
              <p className="text-xs text-textMuted mt-0.5">{liveFeed.length} recent events</p>
            </div>
          </div>
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {liveFeed.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-textMuted text-sm">No calls yet today</div>
            ) : liveFeed.map((call, i) => (
              <div key={call._id || i} className="flex items-center gap-3 px-5 py-3 hover:bg-bg transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 select-none">
                  {(call.employeeName || 'U').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-textPrimary truncate">{call.contactName || call.contactNumber}</span>
                    <Badge type={call.callType} />
                  </div>
                  <p className="text-xs text-textMuted mt-0.5">{call.employeeName} · {formatDur(call.duration)}</p>
                </div>
                <p className="text-xs text-textMuted flex-shrink-0">{timeAgo(call.timestamp)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Team Status */}
        <div className="bg-white border border-border rounded-2xl shadow-card">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-bold text-textPrimary">Team Status</h3>
            <p className="text-xs text-textMuted mt-0.5">{employees.length} agents</p>
          </div>
          <div className="divide-y divide-border">
            {employees.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-textMuted text-sm">No agents</div>
            ) : employees.map(emp => {
              const last   = empLastCall[emp._id?.toString()];
              const active = last && (Date.now() - new Date(last.timestamp)) < 60 * 60 * 1000;
              return (
                <div key={emp._id} className="flex items-center gap-3 px-5 py-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold select-none">
                      {emp.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${active ? 'bg-green-400' : 'bg-gray-300'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-textPrimary truncate">{emp.name}</p>
                    <p className="text-xs text-textMuted">{last ? timeAgo(last.timestamp) : 'No calls today'}</p>
                  </div>
                  {active && <span className="text-[10px] text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">Active</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hourly Chart */}
      <div className="bg-white border border-border rounded-2xl shadow-card p-5">
        <h3 className="font-bold text-textPrimary mb-4">Calls by Hour (Today)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={hourlyData} barSize={8}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="h" tick={{ fontSize: 10, fill: '#94A3B8' }} interval={3} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} cursor={{ fill: '#F1F5F9' }} />
            <Bar dataKey="calls" fill="#1A6BFF" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Period Comparison */}
      <div className="bg-white border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-bold text-textPrimary">Period Comparison</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg">
                <th className="text-left px-5 py-3 text-xs font-semibold text-textMuted uppercase tracking-wide">Metric</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-primary uppercase tracking-wide">Today</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-textMuted uppercase tracking-wide">This Week</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-textMuted uppercase tracking-wide">This Month</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {compRows.map(row => (
                <tr key={row.label} className="hover:bg-bg transition-colors">
                  <td className="px-5 py-3 font-medium text-textPrimary">{row.label}</td>
                  <td className="px-5 py-3 text-right font-bold text-primary">{row.today ?? '—'}</td>
                  <td className="px-5 py-3 text-right text-textSecondary">{row.week ?? '—'}</td>
                  <td className="px-5 py-3 text-right text-textSecondary">{row.month ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
