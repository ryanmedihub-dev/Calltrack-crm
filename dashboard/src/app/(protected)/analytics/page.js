'use client';
import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell, Legend, LabelList,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ComposedChart, Line,
} from 'recharts';
import api from '../../../lib/api';
import { utcHourToISTLabel } from '../../../lib/timezone';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Icons ───────────────────────────────────────── */
const Ico = ({ size = 16, children, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

const TrendUpIco = ({ size = 12 }) => (
  <Ico size={size}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </Ico>
);
const TrendDnIco = ({ size = 12 }) => (
  <Ico size={size}>
    <polyline points="1 6 10.5 15.5 15.5 10.5 23 18" />
    <polyline points="7 18 1 18 1 12" />
  </Ico>
);
const TrendFlatIco = ({ size = 12 }) => (
  <Ico size={size}>
    <line x1="5" y1="12" x2="19" y2="12" />
  </Ico>
);
const PhoneIco = ({ size = 16 }) => (
  <Ico size={size}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </Ico>
);
const CheckIco = ({ size = 16 }) => (
  <Ico size={size}>
    <polyline points="20 6 9 17 4 12" />
  </Ico>
);
const MissedIco = ({ size = 16 }) => (
  <Ico size={size}>
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
  </Ico>
);
const ClockIco = ({ size = 16 }) => (
  <Ico size={size}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Ico>
);
const UsersIco = ({ size = 16 }) => (
  <Ico size={size}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Ico>
);
const PeakIco = ({ size = 16 }) => (
  <Ico size={size}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </Ico>
);
const AwardIco = ({ size = 16 }) => (
  <Ico size={size}>
    <circle cx="12" cy="8" r="6" />
    <polyline points="8.5 14.5 10.5 17.5 15 13" />
    <path d="M12 2v4" />
    <path d="M12 14v4" />
  </Ico>
);
const BarChartIco = ({ size = 16 }) => (
  <Ico size={size}>
    <rect x="3" y="10" width="4" height="11" rx="1" />
    <rect x="10" y="6" width="4" height="15" rx="1" />
    <rect x="17" y="3" width="4" height="18" rx="1" />
  </Ico>
);

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl px-4 py-3 text-xs shadow-2xl border border-gray-700"
      style={{ background: 'rgba(15, 23, 42, 0.95)', color: '#fff', backdropFilter: 'blur(10px)' }}
    >
      <p className="mb-1.5 font-medium" style={{ color: '#94A3B8' }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mt-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color || p.fill || '#2563EB' }} />
          <span className="font-bold">
            {p.name}: <span style={{ color: '#fff' }}>{p.value}</span>
          </span>
        </div>
      ))}
    </motion.div>
  );
};

const AVATAR_COLORS = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#0D9488', '#7C3AED', '#0891B2', '#BE185D'];

function pct(num, den) { return den ? Math.round((num / den) * 100) : 0; }
function delta(cur, prev) {
  if (prev === 0 || prev == null) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

/* ── Metric Card ──────────────────────────────────── */
const MetricCard = ({ label, value, sub, color, bg, icon, dval, idx, gradient }) => {
  const d = dval;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05, duration: 0.4 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative bg-white rounded-2xl p-5 border border-gray-100 hover:border-blue-200 hover:shadow-xl transition-all duration-300 overflow-hidden"
    >
      {gradient && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300"
          style={{ background: gradient }}
        />
      )}
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
            style={{ background: bg, color }}
          >
            {icon}
          </div>
          {d !== null && d !== undefined && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 + 0.2 }}
              className="flex items-center gap-0.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{
                background: d > 0 ? 'rgba(22,163,74,0.10)' : d < 0 ? 'rgba(220,38,38,0.10)' : '#F1F5F9',
                color: d > 0 ? '#16A34A' : d < 0 ? '#DC2626' : '#64748B',
              }}
            >
              {d > 0 ? <TrendUpIco /> : d < 0 ? <TrendDnIco /> : <TrendFlatIco />}
              {Math.abs(d)}%
            </motion.span>
          )}
        </div>
        <p className="text-2xl font-extrabold leading-none tabular-nums" style={{ color: '#0F172A', letterSpacing: '-0.03em' }}>
          {value ?? '—'}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-wider mt-1.5" style={{ color: '#94A3B8' }}>
          {label}
        </p>
        {sub && <p className="text-[11px] mt-0.5" style={{ color: '#94A3B8' }}>{sub}</p>}
      </div>
    </motion.div>
  );
};

/* ── Main Component ───────────────────────────────── */
export default function AnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    Promise.all([api.get('/api/calls/stats'), api.get('/api/employees')])
      .then(([s, e]) => {
        setStats(s.data.data);
        setEmployees(e.data.data);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const d = period === 'today' ? stats?.today : period === 'yesterday' ? stats?.yesterday : stats?.lastWeek;
  const today = stats?.today;
  const yest = stats?.yesterday;
  const week = stats?.lastWeek;

  const connRate = pct(d?.connectedCalls, d?.totalCalls);
  const missRate = pct(d?.missed, d?.totalCalls);
  const outRate = pct(d?.outgoing, d?.totalCalls);
  const _bestHourRaw = (stats?.callsPerHour || []).reduce((a, b) => b.count > a.count ? b : a, { hour: 0, count: 0 });
  const bestHour = { ..._bestHourRaw, istLabel: _bestHourRaw.count ? utcHourToISTLabel(_bestHourRaw.hour) : null };
  const topPerf = stats?.topDialers?.[0];
  const avgDur = d?.totalCalls ? Math.round((d?.totalDuration || 0) / d?.totalCalls) : 0;
  const avgDurFmt = avgDur >= 60 ? `${Math.floor(avgDur / 60)}m ${avgDur % 60}s` : `${avgDur}s`;

  const periodLabel = { today: 'Today', yesterday: 'Yesterday', lastWeek: 'Last Week' }[period];

  const metricCards = [
    {
      label: 'Total Calls',
      value: d?.totalCalls ?? '—',
      color: '#2563EB',
      bg: '#EFF6FF',
      gradient: 'linear-gradient(135deg, #2563EB, #3B82F6)',
      sub: `${periodLabel}`,
      dval: period === 'today' ? delta(today?.totalCalls, yest?.totalCalls) : null,
      icon: <PhoneIco size={18} />,
    },
    {
      label: 'Connection Rate',
      value: `${connRate}%`,
      color: '#16A34A',
      bg: '#F0FDF4',
      gradient: 'linear-gradient(135deg, #16A34A, #22C55E)',
      sub: `${d?.connectedCalls ?? 0} connected`,
      dval: period === 'today' ? delta(connRate, pct(yest?.connectedCalls, yest?.totalCalls)) : null,
      icon: <CheckIco size={18} />,
    },
    {
      label: 'Missed Rate',
      value: `${missRate}%`,
      color: '#DC2626',
      bg: '#FFF1F2',
      gradient: 'linear-gradient(135deg, #DC2626, #EF4444)',
      sub: `${d?.missed ?? 0} missed calls`,
      dval: period === 'today' ? delta(missRate, pct(yest?.missed, yest?.totalCalls)) : null,
      icon: <MissedIco size={18} />,
    },
    {
      label: 'Avg Duration',
      value: avgDurFmt,
      color: '#D97706',
      bg: '#FFFBEB',
      gradient: 'linear-gradient(135deg, #D97706, #F59E0B)',
      sub: 'Per connected call',
      dval: null,
      icon: <ClockIco size={18} />,
    },
    {
      label: 'Unique Clients',
      value: d?.uniqueClients ?? '—',
      color: '#7C3AED',
      bg: '#F5F3FF',
      gradient: 'linear-gradient(135deg, #7C3AED, #8B5CF6)',
      sub: `${periodLabel}`,
      dval: period === 'today' ? delta(today?.uniqueClients, yest?.uniqueClients) : null,
      icon: <UsersIco size={18} />,
    },
    {
      label: 'Peak Hour',
      value: bestHour?.istLabel ?? '—',
      color: '#0D9488',
      bg: '#F0FDFA',
      gradient: 'linear-gradient(135deg, #0D9488, #14B8A6)',
      sub: bestHour?.count ? `${bestHour.count} calls` : 'No calls yet',
      dval: null,
      icon: <PeakIco size={18} />,
    },
  ];

  const todayDate = new Date();
  const yestDate = new Date(todayDate);
  yestDate.setDate(yestDate.getDate() - 1);
  const todayLabel2 = todayDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const yestLabel2 = yestDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  const periodCompData = stats ? [
    { name: `Today (${todayLabel2})`, incoming: today?.incoming || 0, outgoing: today?.outgoing || 0, missed: today?.missed || 0, connected: today?.connectedCalls || 0 },
    { name: `Yesterday (${yestLabel2})`, incoming: yest?.incoming || 0, outgoing: yest?.outgoing || 0, missed: yest?.missed || 0, connected: yest?.connectedCalls || 0 },
    { name: 'Last 7 Days', incoming: week?.incoming || 0, outgoing: week?.outgoing || 0, missed: week?.missed || 0, connected: week?.connectedCalls || 0 },
  ] : [];

  const hourData = (stats?.callsPerHour || []).map(h => ({
    hour: utcHourToISTLabel(h.hour),
    rawHour: parseInt(h.hour),
    calls: h.count,
  }));

  const empData = (stats?.topDialers || []).slice(0, 8).map((d, i) => ({
    name: d.name.length > 10 ? d.name.split(' ')[0] : d.name,
    fullName: d.name,
    calls: d.count,
    fill: AVATAR_COLORS[i % AVATAR_COLORS.length],
  }));

  const outcomePie = today ? [
    { name: 'Connected', value: today.connectedCalls || 0, color: '#22C55E' },
    { name: 'Missed', value: today.missed || 0, color: '#EF4444' },
    { name: 'Rejected', value: today.rejected || 0, color: '#8B5CF6' },
  ].filter(x => x.value > 0) : [];

  const qualityData = [
    { name: 'Connection', today: pct(today?.connectedCalls, today?.totalCalls), yest: pct(yest?.connectedCalls, yest?.totalCalls), color: '#22C55E', suffix: '%' },
    { name: 'Missed', today: pct(today?.missed, today?.totalCalls), yest: pct(yest?.missed, yest?.totalCalls), color: '#EF4444', suffix: '%' },
    { name: 'Outgoing', today: pct(today?.outgoing, today?.totalCalls), yest: pct(yest?.outgoing, yest?.totalCalls), color: '#F59E0B', suffix: '%' },
    { name: 'Incoming', today: pct(today?.incoming, today?.totalCalls), yest: pct(yest?.incoming, yest?.totalCalls), color: '#2563EB', suffix: '%' },
  ];

  // Radar data for quality metrics
  const radarData = qualityData.map(q => ({
    subject: q.name,
    Today: q.today,
    Yesterday: q.yest,
    fullMark: 100,
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/80 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="skeleton h-8 w-48 rounded-lg" />
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="skeleton h-32 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton h-72 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6 lg:space-y-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <BarChartIco />
              Analytics Dashboard
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Deep-dive into call performance and agent metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {[
                ['today', 'Today'],
                ['yesterday', 'Yesterday'],
                ['lastWeek', 'Last 7 Days'],
              ].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setPeriod(v)}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                  style={
                    period === v
                      ? { background: '#fff', color: '#0F172A', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }
                      : { color: '#64748B' }
                  }
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {metricCards.map((m, i) => (
            <MetricCard key={m.label} idx={i} {...m} />
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Period Comparison */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="xl:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Period Comparison</h3>
                <p className="text-xs text-gray-500 mt-0.5">Today vs Yesterday vs Last Week</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-100">
                <span className="text-xs font-semibold text-blue-600">📊 Bar</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={periodCompData} barGap={3} barCategoryGap="28%">
                <defs>
                  <linearGradient id="incomingGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#22C55E" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="outgoingGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="missedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="connectedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip content={<ChartTip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, color: '#475569', paddingTop: 12 }}
                />
                <Bar dataKey="incoming" name="Incoming" fill="url(#incomingGrad)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="outgoing" name="Outgoing" fill="url(#outgoingGrad)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="missed" name="Missed" fill="url(#missedGrad)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="connected" name="Connected" fill="url(#connectedGrad)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Call Outcomes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300"
          >
            <div className="mb-4">
              <h3 className="text-sm font-bold text-gray-900">Call Outcomes</h3>
              <p className="text-xs text-gray-500 mt-0.5">Today's distribution</p>
            </div>
            {outcomePie.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[220px] gap-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <PhoneIco size={24} />
                </div>
                <p className="text-sm text-gray-500">No calls yet today</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={outcomePie}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {outcomePie.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-3">
                  {outcomePie.map((o) => (
                    <div key={o.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: o.color }} />
                        <span style={{ color: '#64748B' }}>{o.name}</span>
                      </div>
                      <span className="font-bold text-gray-900">
                        {o.value}{' '}
                        <span className="font-normal text-gray-400">
                          ({pct(o.value, today?.totalCalls)}%)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Hourly Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300"
          >
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Hourly Activity</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Calls dialled per hour — today</p>
                </div>
                <span className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full border border-green-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-semibold text-green-600">Live</span>
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={hourData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: '#94A3B8', fontSize: 9.5 }}
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
                <Tooltip content={<ChartTip />} />
                <Area
                  type="monotone"
                  dataKey="calls"
                  name="Calls"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fill="url(#areaGrad)"
                  fillOpacity={1}
                />
                <Bar dataKey="calls" name="Calls" fill="url(#areaGrad)" radius={[6, 6, 0, 0]} barSize={20}>
                  <LabelList
                    dataKey="calls"
                    position="top"
                    style={{ fontSize: 9, fill: '#94A3B8', fontWeight: 600 }}
                    formatter={(v) => v > 0 ? v : ''}
                  />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Top Performers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300"
          >
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Top Performers</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Calls made today by agent</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-100">
                  <AwardIco size={12} />
                  <span className="text-xs font-semibold text-blue-600">Leaderboard</span>
                </div>
              </div>
            </div>
            {empData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[220px] gap-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UsersIco size={24} />
                </div>
                <p className="text-sm text-gray-500">No call data today</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, empData.length * 38)}>
                <BarChart layout="vertical" data={empData} barCategoryGap="30%">
                  <defs>
                    <linearGradient id="empGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    width={72}
                  />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="calls" name="Calls" fill="url(#empGrad)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </div>

        {/* Quality & Radar Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Call Quality */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="xl:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Call Quality Metrics</h3>
                <p className="text-xs text-gray-500 mt-0.5">Today vs Yesterday performance comparison</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {qualityData.map(({ name, today: t, yest: y, color, suffix }) => {
                const diff = t - y;
                return (
                  <motion.div
                    key={name}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gray-50 rounded-xl p-4 hover:bg-white hover:shadow-lg transition-all duration-300"
                  >
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-semibold text-gray-600">{name} Rate</span>
                      <span className="font-bold text-lg" style={{ color, letterSpacing: '-0.03em' }}>
                        {t}
                        {suffix}
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden mb-2 bg-gray-200">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${t}%` }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="h-full rounded-full"
                        style={{ background: color }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-400">Yesterday: {y}
                        {suffix}</span>
                      <span
                        className="font-semibold flex items-center gap-0.5"
                        style={{
                          color: diff > 0 ? '#16A34A' : diff < 0 ? '#DC2626' : '#94A3B8',
                        }}
                      >
                        {diff > 0 ? <TrendUpIco /> : diff < 0 ? <TrendDnIco /> : null}
                        {diff > 0 ? '+' : ''}{diff}
                        {suffix}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Radar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300"
          >
            <div className="mb-4">
              <h3 className="text-sm font-bold text-gray-900">Performance Radar</h3>
              <p className="text-xs text-gray-500 mt-0.5">Today vs Yesterday</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748B', fontSize: 10, fontWeight: 500 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 9 }} />
                <Radar
                  name="Today"
                  dataKey="Today"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fill="#2563EB"
                  fillOpacity={0.25}
                />
                <Radar
                  name="Yesterday"
                  dataKey="Yesterday"
                  stroke="#94A3B8"
                  strokeWidth={2}
                  fill="#94A3B8"
                  fillOpacity={0.15}
                />
                <Legend
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ fontSize: 11, color: '#475569', paddingTop: 8 }}
                />
                <Tooltip content={<ChartTip />} />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Agent Performance Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Agent Performance</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {employees.length} agents · Today's metrics
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-green-50 text-green-600 rounded-full border border-green-100">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Role</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Calls</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Conn. Rate</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Missed</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {employees.map((emp, i) => {
                  const dialerData = stats?.topDialers?.find((d) => d.employeeId === emp._id);
                  const callCount = dialerData?.count ?? 0;
                  const connR = callCount > 0 ? `${Math.round((dialerData?.connected || 0) / callCount * 100)}%` : '—';
                  return (
                    <motion.tr
                      key={emp._id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-gray-50/50 transition-colors duration-150"
                    >
                      <td className="px-6 py-3 text-sm font-medium text-gray-400">{i + 1}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-md"
                            style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                          >
                            {emp.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{emp.name}</p>
                            <p className="text-xs text-gray-400 hidden sm:block">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 hidden md:table-cell">
                        <span
                          className="text-xs font-medium px-2.5 py-1 rounded-full capitalize"
                          style={{ background: '#EFF6FF', color: '#2563EB' }}
                        >
                          {emp.role}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span
                          className="font-bold tabular-nums text-base"
                          style={{ color: callCount > 0 ? '#2563EB' : '#CBD5E1' }}
                        >
                          {callCount}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right hidden sm:table-cell">
                        <span className="text-sm font-semibold text-green-600">{connR}</span>
                      </td>
                      <td className="px-6 py-3 text-right hidden lg:table-cell">
                        <span className="text-sm font-semibold text-red-500">{dialerData?.missed ?? '—'}</span>
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-full ${emp.isActive
                              ? 'bg-green-50 text-green-600 border border-green-100'
                              : 'bg-gray-100 text-gray-500 border border-gray-200'
                            }`}
                        >
                          {emp.isActive ? '🟢 Active' : '⚪ Inactive'}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                      No employees yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}