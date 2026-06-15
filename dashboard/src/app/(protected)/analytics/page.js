'use client';
import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Legend, LineChart, Line
} from 'recharts';
import api from '../../../lib/api';

function Svg({ children, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const TrendUpIco   = () => <Svg size={18}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></Svg>;
const ClockIco     = () => <Svg size={18}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Svg>;
const StarIco      = () => <Svg size={18}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Svg>;
const LinkIco      = () => <Svg size={18}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></Svg>;

function MetricCard({ label, value, sub, Icon, iconBg, iconColor }) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`} style={{ color: iconColor }}>
        <Icon />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-textPrimary leading-none">{value ?? '—'}</p>
        <p className="text-textMuted text-xs mt-1 font-medium uppercase tracking-wide">{label}</p>
        {sub && <p className="text-textSecondary text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [stats,     setStats]     = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/calls/stats'),
      api.get('/api/employees'),
    ])
      .then(([statsRes, empRes]) => {
        setStats(statsRes.data.data);
        setEmployees(empRes.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = stats?.today;

  /* ---- Derived metrics ---- */
  const connectionRate = today?.totalCalls
    ? Math.round((today.connectedCalls / today.totalCalls) * 100)
    : 0;

  const bestHour = stats?.callsPerHour?.length
    ? stats.callsPerHour.reduce((a, b) => (b.count > a.count ? b : a), { hour: 0, count: 0 })
    : null;

  const topPerformer = stats?.topDialers?.[0];

  /* ---- Period comparison data for grouped bar chart ---- */
  const periodData = stats
    ? [
        {
          name: 'Today',
          incoming: stats.today?.incoming  || 0,
          outgoing: stats.today?.outgoing  || 0,
          missed:   stats.today?.missed    || 0,
        },
        {
          name: 'Yesterday',
          incoming: stats.yesterday?.incoming || 0,
          outgoing: stats.yesterday?.outgoing || 0,
          missed:   stats.yesterday?.missed   || 0,
        },
        {
          name: 'Last Week',
          incoming: stats.lastWeek?.incoming || 0,
          outgoing: stats.lastWeek?.outgoing || 0,
          missed:   stats.lastWeek?.missed   || 0,
        },
      ]
    : [];

  /* ---- Employee performance data ---- */
  const employeeData = (stats?.topDialers || []).map(d => ({
    name: d.name.split(' ')[0],
    calls: d.count,
  }));

  /* ---- Calls per hour for line chart ---- */
  const hourData = (stats?.callsPerHour || []).map(h => ({
    hour: `${h.hour}:00`,
    calls: h.count,
  }));

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-8 skeleton w-48" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 skeleton rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="h-72 skeleton rounded-2xl" />
          <div className="h-72 skeleton rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-textPrimary">Analytics</h2>
          <p className="text-textMuted text-sm mt-0.5">Performance overview across all periods</p>
        </div>
        <span className="text-xs bg-bg border border-border text-textMuted px-3 py-1.5 rounded-xl font-medium">
          {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

      {/* ── Key Metrics ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Connection Rate" value={`${connectionRate}%`}
          sub="Calls answered vs total"
          Icon={LinkIco} iconBg="bg-tealLt" iconColor="#0EA5E9" />
        <MetricCard label="Working Hours" value={today?.workingHours || '—'}
          sub="Total today"
          Icon={ClockIco} iconBg="bg-purpleLt" iconColor="#8B5CF6" />
        <MetricCard label="Top Performer" value={topPerformer?.name?.split(' ')[0] || '—'}
          sub={topPerformer ? `${topPerformer.count} calls today` : 'No data'}
          Icon={StarIco} iconBg="bg-warningLt" iconColor="#F59E0B" />
        <MetricCard label="Peak Hour" value={bestHour ? `${bestHour.hour}:00` : '—'}
          sub={bestHour ? `${bestHour.count} calls` : 'No calls yet'}
          Icon={TrendUpIco} iconBg="bg-successLt" iconColor="#10B981" />
      </div>

      {/* ── Charts Row 1 ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Period comparison */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-5">
          <h3 className="text-textPrimary font-semibold text-sm mb-5">Period Comparison</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={periodData} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                cursor={{ fill: '#F8FAFC' }}
              />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, color: '#475569', paddingTop: 8 }} />
              <Bar dataKey="incoming" name="Incoming" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="outgoing" name="Outgoing" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="missed"   name="Missed"   fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Calls per hour trend */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-5">
          <h3 className="text-textPrimary font-semibold text-sm mb-5">Hourly Activity (Today)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={hourData}>
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#1A6BFF" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#1A6BFF" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                cursor={{ stroke: '#E2E8F0' }}
              />
              <Line type="monotone" dataKey="calls" stroke="#1A6BFF" strokeWidth={2.5}
                dot={{ fill: '#1A6BFF', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Charts Row 2 ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Employee performance */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-5">
          <h3 className="text-textPrimary font-semibold text-sm mb-5">Employee Performance Today</h3>
          {employeeData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-textMuted text-sm gap-2">
              <span className="text-4xl">👥</span>
              <p>No call data today</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, employeeData.length * 44)}>
              <BarChart layout="vertical" data={employeeData} barCategoryGap="35%">
                <defs>
                  <linearGradient id="empGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor="#1A6BFF" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.7}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                  cursor={{ fill: '#F8FAFC' }}
                />
                <Bar dataKey="calls" name="Calls" fill="url(#empGrad)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Call quality summary */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-5">
          <h3 className="text-textPrimary font-semibold text-sm mb-5">Call Quality — Today vs Yesterday</h3>
          <div className="space-y-4">
            {[
              {
                label: 'Connection Rate',
                today:  today?.totalCalls ? Math.round((today.connectedCalls / today.totalCalls) * 100) : 0,
                yest:   stats?.yesterday?.totalCalls
                          ? Math.round(((stats.yesterday.connectedCalls || 0) / stats.yesterday.totalCalls) * 100)
                          : 0,
                color: '#10B981',
                suffix: '%',
              },
              {
                label: 'Missed Rate',
                today:  today?.totalCalls ? Math.round((today.missed / today.totalCalls) * 100) : 0,
                yest:   stats?.yesterday?.totalCalls
                          ? Math.round(((stats.yesterday.missed || 0) / stats.yesterday.totalCalls) * 100)
                          : 0,
                color: '#EF4444',
                suffix: '%',
              },
              {
                label: 'Total Calls',
                today:  today?.totalCalls    || 0,
                yest:   stats?.yesterday?.totalCalls || 0,
                color: '#1A6BFF',
                suffix: '',
              },
              {
                label: 'Unique Clients',
                today:  today?.uniqueClients    || 0,
                yest:   stats?.yesterday?.uniqueClients || 0,
                color: '#8B5CF6',
                suffix: '',
              },
            ].map(({ label, today: t, yest: y, color, suffix }) => {
              const max = Math.max(t, y, 1);
              const delta = t - y;
              return (
                <div key={label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-textSecondary">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-textMuted">Yesterday: {y}{suffix}</span>
                      <span className={`font-bold ${delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-textMuted'}`}>
                        {delta > 0 ? `+${delta}` : delta}{suffix}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-bg rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(t / max) * 100}%`, background: color }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-textMuted">
                    <span>Today: {t}{suffix}</span>
                    <span style={{ color }}>
                      {((t / max) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Employee table ── */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-textPrimary text-sm">All Employees</h3>
          <span className="text-xs text-textMuted">{employees.length} members</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 500 }}>
            <thead>
              <tr className="bg-bg text-textMuted text-xs font-semibold uppercase tracking-wide">
                <th className="px-5 py-3 text-left">Name</th>
                <th className="px-5 py-3 text-left">Role</th>
                <th className="px-5 py-3 text-left">Calls Today</th>
                <th className="px-5 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const callCount = stats?.topDialers?.find(d => d.employeeId === emp._id)?.count ?? 0;
                return (
                  <tr key={emp._id} className="border-t border-border hover:bg-bg/60 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {emp.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-textPrimary">{emp.name}</p>
                          <p className="text-textMuted text-xs">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="capitalize text-textSecondary text-xs bg-bg border border-border px-2 py-0.5 rounded-full">{emp.role}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-textPrimary">{callCount}</span>
                        {callCount > 0 && (
                          <div className="flex-1 max-w-24 h-1.5 bg-bg rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(100, (callCount / (stats?.topDialers?.[0]?.count || 1)) * 100)}%` }} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${emp.isActive !== false ? 'bg-successLt text-success border border-green-200' : 'bg-bg text-textMuted border border-border'}`}>
                        {emp.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center">
                    <span className="text-4xl block mb-2">👥</span>
                    <span className="text-textMuted text-sm">No employees found</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
