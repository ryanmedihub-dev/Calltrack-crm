'use client';
import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend,
} from 'recharts';
import api from '../../../../lib/api';
import { SkeletonKpi } from '../../../../components/Skeleton';

const TABS = ['Trends', 'Comparison', 'Patterns', 'Efficiency'];

function Tab({ active, onClick, label }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${active ? 'bg-primary text-white shadow-sm' : 'text-textMuted hover:text-textSecondary'}`}>
      {label}
    </button>
  );
}

function StatCard({ label, value, sub, color = '#1A6BFF' }) {
  return (
    <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
      <p className="text-2xl font-bold leading-none" style={{ color }}>{value ?? '—'}</p>
      <p className="text-xs text-textMuted font-medium uppercase tracking-wide mt-1.5">{label}</p>
      {sub && <p className="text-xs text-textSecondary mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
      <h3 className="font-bold text-textPrimary mb-4">{title}</h3>
      {children}
    </div>
  );
}

function formatDur(sec) {
  if (!sec) return '0m';
  const m = Math.floor(sec / 60);
  return `${m}m`;
}

export default function AdvancedAnalyticsPage() {
  const [tab,     setTab]     = useState('Trends');
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/calls/stats');
        setStats(res.data.data);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const today = stats?.today;
  const week  = stats?.thisWeek;
  const month = stats?.thisMonth;

  // ── Trends: area chart of period comparisons ──
  const trendData = [
    { period: 'Today',     calls: today?.totalCalls || 0, incoming: today?.incoming || 0, outgoing: today?.outgoing || 0, missed: today?.missed || 0 },
    { period: 'This Week', calls: week?.totalCalls  || 0, incoming: week?.incoming  || 0, outgoing: week?.outgoing  || 0, missed: week?.missed  || 0 },
    { period: 'This Month',calls: month?.totalCalls || 0, incoming: month?.incoming || 0, outgoing: month?.outgoing || 0, missed: month?.missed || 0 },
  ];

  // ── Patterns: hourly distribution ──
  const hourlyMap = {};
  (today?.callsPerHour || []).forEach(({ _id, count }) => { hourlyMap[_id] = count; });
  const hourlyData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h.toString().padStart(2, '0')}h`,
    calls: hourlyMap[h] || 0,
  }));
  const peakHour = hourlyData.reduce((a, b) => b.calls > a.calls ? b : a, { calls: 0, hour: '—' });

  // ── Comparison: per-employee radar ──
  const empData = (today?.topDialers || []).slice(0, 6).map(d => ({
    name: d.name?.split(' ')[0] || 'Agent',
    calls: d.count,
  }));

  // ── Efficiency ──
  const connRate  = today?.totalCalls ? Math.round(((today.connectedCalls || 0) / today.totalCalls) * 100) : 0;
  const avgDur    = today?.totalCalls ? Math.round((today.totalDuration || 0) / today.totalCalls) : 0;
  const missRate  = today?.totalCalls ? Math.round(((today.missed || 0) / today.totalCalls) * 100) : 0;
  const outRate   = today?.totalCalls ? Math.round(((today.outgoing || 0) / today.totalCalls) * 100) : 0;

  const efficiencyData = [
    { metric: 'Connect Rate',   value: connRate, fill: '#10B981' },
    { metric: 'Outgoing Rate',  value: outRate,  fill: '#1A6BFF' },
    { metric: 'Miss Rate',      value: missRate, fill: '#EF4444' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-textPrimary">Advanced Analytics</h2>
          <p className="text-textMuted text-sm mt-0.5">Deep dives into call trends and efficiency</p>
        </div>
        <SkeletonKpi count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-textPrimary">Advanced Analytics</h2>
        <p className="text-textMuted text-sm mt-0.5">Deep dives into call trends, patterns, and efficiency metrics</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-border rounded-xl p-1 w-fit shadow-card flex-wrap">
        {TABS.map(t => <Tab key={t} label={t} active={tab === t} onClick={() => setTab(t)} />)}
      </div>

      {/* ── TRENDS ── */}
      {tab === 'Trends' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Today"      value={today?.totalCalls}  color="#1A6BFF" />
            <StatCard label="This Week"  value={week?.totalCalls}   color="#10B981" />
            <StatCard label="This Month" value={month?.totalCalls}  color="#8B5CF6" />
            <StatCard label="Unique Contacts" value={month?.uniqueClients} color="#F59E0B" sub="this month" />
          </div>

          <Section title="Call Volume by Period">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#1A6BFF" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#1A6BFF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                <Area type="monotone" dataKey="calls"    stroke="#1A6BFF" fill="url(#gradTotal)" strokeWidth={2} name="Total" />
                <Area type="monotone" dataKey="incoming" stroke="#10B981" fill="none"             strokeWidth={2} name="Incoming" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="outgoing" stroke="#F59E0B" fill="none"             strokeWidth={2} name="Outgoing" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="missed"   stroke="#EF4444" fill="none"             strokeWidth={2} name="Missed"   strokeDasharray="4 4" />
                <Legend iconType="line" iconSize={12} wrapperStyle={{ fontSize: 12 }} />
              </AreaChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Call Type Breakdown (Today vs Week vs Month)">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Type', 'Today', 'This Week', 'This Month'].map((h, i) => (
                      <th key={h} className={`py-2 text-xs font-semibold text-textMuted uppercase tracking-wide ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { label: 'Incoming', key: 'incoming', color: '#10B981' },
                    { label: 'Outgoing', key: 'outgoing', color: '#F59E0B' },
                    { label: 'Missed',   key: 'missed',   color: '#EF4444' },
                    { label: 'Rejected', key: 'rejected', color: '#8B5CF6' },
                  ].map(row => (
                    <tr key={row.key} className="hover:bg-bg transition-colors">
                      <td className="py-3 font-medium" style={{ color: row.color }}>{row.label}</td>
                      <td className="py-3 text-right font-bold text-textPrimary tabular-nums">{today?.[row.key] ?? '—'}</td>
                      <td className="py-3 text-right text-textSecondary tabular-nums">{week?.[row.key] ?? '—'}</td>
                      <td className="py-3 text-right text-textSecondary tabular-nums">{month?.[row.key] ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

      {/* ── COMPARISON ── */}
      {tab === 'Comparison' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="Top Agent Calls"  value={today?.topDialers?.[0]?.count} sub={today?.topDialers?.[0]?.name} color="#1A6BFF" />
            <StatCard label="Unique Clients"   value={today?.uniqueClients}  color="#10B981" sub="today" />
            <StatCard label="Not Picked Up"    value={today?.notPickedByClient} color="#EF4444" sub="no callback yet" />
          </div>

          {empData.length > 0 ? (
            <Section title="Agent Performance (Today — Top 6)">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={empData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} cursor={{ fill: '#F1F5F9' }} />
                  <Bar dataKey="calls" fill="#1A6BFF" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          ) : (
            <Section title="Agent Performance">
              <div className="flex items-center justify-center h-40 text-textMuted text-sm">No agent data for today</div>
            </Section>
          )}
        </div>
      )}

      {/* ── PATTERNS ── */}
      {tab === 'Patterns' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="Peak Hour"       value={peakHour.hour}      color="#1A6BFF" sub={`${peakHour.calls} calls`} />
            <StatCard label="Calls This Hour" value={hourlyMap[new Date().getHours()] || 0} color="#10B981" />
            <StatCard label="Avg per Hour"    value={today?.totalCalls ? Math.round(today.totalCalls / 24) : 0} color="#F59E0B" sub="today" />
          </div>

          <Section title="Hourly Call Distribution (Today)">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourlyData} barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={3} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} cursor={{ fill: '#F1F5F9' }} />
                <Bar dataKey="calls" radius={[3, 3, 0, 0]}
                  fill="#1A6BFF"
                  label={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Business Hours vs Off-Hours">
            {(() => {
              const business   = hourlyData.slice(9, 19).reduce((s, h) => s + h.calls, 0);
              const offHours   = hourlyData.reduce((s, h) => s + h.calls, 0) - business;
              const total      = business + offHours || 1;
              return (
                <div className="space-y-3">
                  {[
                    { label: 'Business Hours (9am–7pm)', value: business, color: '#1A6BFF' },
                    { label: 'Off-Hours',                value: offHours, color: '#94A3B8' },
                  ].map(row => (
                    <div key={row.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-textSecondary">{row.label}</span>
                        <span className="font-bold" style={{ color: row.color }}>{row.value} ({Math.round(row.value / total * 100)}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(row.value / total) * 100}%`, background: row.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Section>
        </div>
      )}

      {/* ── EFFICIENCY ── */}
      {tab === 'Efficiency' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Connect Rate"   value={`${connRate}%`}       color="#10B981" sub="calls connected" />
            <StatCard label="Avg Duration"   value={formatDur(avgDur)}    color="#1A6BFF" sub="per call today" />
            <StatCard label="Miss Rate"      value={`${missRate}%`}       color="#EF4444" sub="not answered" />
            <StatCard label="Outgoing Rate"  value={`${outRate}%`}        color="#F59E0B" sub="of total calls" />
          </div>

          <Section title="Efficiency Breakdown (Today)">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={efficiencyData} barSize={40} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="metric" tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} tickLine={false} axisLine={false} width={120} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} formatter={v => [`${v}%`]} cursor={{ fill: '#F1F5F9' }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#1A6BFF">
                  {efficiencyData.map((entry, i) => (
                    <rect key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Never Attended Clients">
            <div className="flex items-center gap-4 py-2">
              <div className="text-4xl font-black text-danger">{today?.neverAttended ?? '—'}</div>
              <div>
                <p className="text-sm font-medium text-textPrimary">Clients with missed calls but no follow-up outgoing</p>
                <p className="text-xs text-textMuted mt-0.5">These contacts need immediate outreach attention</p>
              </div>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
