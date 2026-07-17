'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ComposedChart,
  Area,
  LabelList,
} from 'recharts';
import api from '../../../../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import DateRangeFilter, { formatRangeLabel } from '../../../../components/DateRangeFilter';

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

const PhoneIco = () => (
  <Ico>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </Ico>
);
const IncomingIco = () => (
  <Ico>
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
    <polyline points="17 18 23 18 23 12" />
  </Ico>
);
const OutgoingIco = () => (
  <Ico>
    <polyline points="1 6 10.5 15.5 15.5 10.5 23 18" />
    <polyline points="7 6 1 6 1 12" />
  </Ico>
);
const MissedIco = () => (
  <Ico>
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
  </Ico>
);
const ConnectedIco = () => (
  <Ico>
    <polyline points="20 6 9 17 4 12" />
  </Ico>
);
const UsersIco = () => (
  <Ico>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Ico>
);
const TrendUpIco = () => (
  <Ico size={12}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </Ico>
);
const TrendDnIco = () => (
  <Ico size={12}>
    <polyline points="1 6 10.5 15.5 15.5 10.5 23 18" />
    <polyline points="7 18 1 18 1 12" />
  </Ico>
);
const GridIco = () => (
  <Ico size={18}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </Ico>
);
const ClockIco = () => (
  <Ico size={14}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Ico>
);
const TargetIco = () => (
  <Ico size={14}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </Ico>
);
const ArrowRightIco = () => (
  <Ico size={14}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
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
      <p className="mb-1.5 font-medium" style={{ color: '#94A3B8' }}>
        {label}
      </p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mt-1">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: p.color || p.fill || '#2563EB' }}
          />
          <span className="font-bold">
            {p.name}: <span style={{ color: '#fff' }}>{p.value}</span>
          </span>
        </div>
      ))}
    </motion.div>
  );
};

const PAGES = [
  {
    href: '/reports/calllogs',
    label: 'Call Logs',
    desc: 'All call records with filters',
    color: '#2563EB',
    bg: '#EFF6FF',
    icon: <PhoneIco />,
  },
  {
    href: '/calls/live',
    label: 'Live Monitor',
    desc: 'Real-time call activity',
    color: '#16A34A',
    bg: '#F0FDF4',
    icon: <ClockIco />,
  },
  {
    href: '/reports/Employess',
    label: 'Agent Reports',
    desc: 'Per-agent performance',
    color: '#D97706',
    bg: '#FFFBEB',
    icon: <UsersIco />,
  },
  {
    href: '/reports/calllogs',
    label: 'Attempt Reports',
    desc: 'Call attempt patterns',
    color: '#7C3AED',
    bg: '#F5F3FF',
    icon: <TargetIco />,
  },
  {
    href: '/calls/logs-report',
    label: 'Logs Report',
    desc: 'Detailed metrics report',
    color: '#0D9488',
    bg: '#F0FDFA',
    icon: <GridIco />,
  },
  {
    href: '/calls/targets',
    label: 'Daily Targets',
    desc: 'Team daily call targets',
    color: '#DC2626',
    bg: '#FFF1F2',
    icon: <TargetIco />,
  },
];

export default function CallsOverviewPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ range: 'today', startDate: null, endDate: null });

  useEffect(() => {
    const params = { range: dateRange.range };
    if (dateRange.range === 'custom') {
      params.startDate = dateRange.startDate;
      params.endDate = dateRange.endDate;
    }
    setLoading(true);
    api
      .get('/api/calls/stats', { params })
      .then((r) => setStats(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateRange]);

  const isTodayRange = dateRange.range === 'today';
  const rangeLabel = formatRangeLabel(dateRange);
  const selected = stats?.selected || stats?.today;
  const today = selected;
  const yest = stats?.yesterday;
  const week = stats?.lastWeek;

  const summaryRows = [
    {
      label: 'Total Calls',
      icon: <PhoneIco />,
      today: today?.totalCalls,
      yest: yest?.totalCalls,
      week: week?.totalCalls,
      color: '#2563EB',
    },
    {
      label: 'Incoming',
      icon: <IncomingIco />,
      today: today?.incoming,
      yest: yest?.incoming,
      week: week?.incoming,
      color: '#16A34A',
    },
    {
      label: 'Outgoing',
      icon: <OutgoingIco />,
      today: today?.outgoing,
      yest: yest?.outgoing,
      week: week?.outgoing,
      color: '#D97706',
    },
    {
      label: 'Missed',
      icon: <MissedIco />,
      today: today?.missed,
      yest: yest?.missed,
      week: week?.missed,
      color: '#DC2626',
    },
    {
      label: 'Connected',
      icon: <ConnectedIco />,
      today: today?.connectedCalls,
      yest: yest?.connectedCalls,
      week: week?.connectedCalls,
      color: '#0D9488',
    },
    {
      label: 'Unique Clients',
      icon: <UsersIco />,
      today: today?.uniqueClients,
      yest: yest?.uniqueClients,
      week: week?.uniqueClients,
      color: '#7C3AED',
    },
  ];

  // Calculate trends
  const getTrend = (current, previous) => {
    if (!previous || previous === 0) return null;
    return Math.round(((current - previous) / previous) * 100);
  };

  const trends = {
    total: getTrend(today?.totalCalls, yest?.totalCalls),
    incoming: getTrend(today?.incoming, yest?.incoming),
    outgoing: getTrend(today?.outgoing, yest?.outgoing),
    connected: getTrend(today?.connectedCalls, yest?.connectedCalls),
  };

  const barData = stats
    ? [
        { name: rangeLabel, calls: today?.totalCalls || 0, fill: '#2563EB' },
        { name: 'Yesterday', calls: yest?.totalCalls || 0, fill: '#60A5FA' },
        { name: 'Last Week', calls: week?.totalCalls || 0, fill: '#93C5FD' },
      ]
    : [];

  const pieData = today
    ? [
        { name: 'Incoming', value: today.incoming || 0, color: '#22C55E' },
        { name: 'Outgoing', value: today.outgoing || 0, color: '#F59E0B' },
        { name: 'Missed', value: today.missed || 0, color: '#EF4444' },
        { name: 'Rejected', value: today.rejected || 0, color: '#8B5CF6' },
      ].filter((d) => d.value > 0)
    : [];

  // Line data for trend
  const lineData = stats
    ? [
        { period: rangeLabel, calls: today?.totalCalls || 0, connected: today?.connectedCalls || 0 },
        { period: 'Yesterday', calls: yest?.totalCalls || 0, connected: yest?.connectedCalls || 0 },
        { period: 'Last Week', calls: week?.totalCalls || 0, connected: week?.connectedCalls || 0 },
      ]
    : [];

  // Quick stats cards
  const quickStats = [
    {
      label: `${rangeLabel}'s Total`,
      value: today?.totalCalls || 0,
      change: isTodayRange ? trends.total : null,
      color: '#2563EB',
      icon: <PhoneIco />,
    },
    {
      label: 'Connection Rate',
      value: today?.totalCalls
        ? `${Math.round((today?.connectedCalls || 0) / today?.totalCalls * 100)}%`
        : '0%',
      change: isTodayRange ? trends.connected : null,
      color: '#16A34A',
      icon: <ConnectedIco />,
    },
    {
      label: 'Missed Rate',
      value: today?.totalCalls
        ? `${Math.round((today?.missed || 0) / today?.totalCalls * 100)}%`
        : '0%',
      change: null,
      color: '#DC2626',
      icon: <MissedIco />,
    },
    {
      label: 'Incoming/Outgoing',
      value: `${today?.incoming || 0}/${today?.outgoing || 0}`,
      change: null,
      color: '#D97706',
      icon: <IncomingIco />,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/80 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="skeleton h-8 w-56 rounded-xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-28 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeleton h-32 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      <div className="max-w-7xl mx-auto space-y-6 lg:space-y-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                <PhoneIco />
              </span>
              Calls Overview
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              High-level summary across all call reports
            </p>
          </div>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickStats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl p-5 border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `${stat.color}15`, color: stat.color }}
                >
                  {stat.icon}
                </div>
                {stat.change !== null && stat.change !== undefined && (
                  <span
                    className={`flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                      stat.change >= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                    }`}
                  >
                    {stat.change >= 0 ? <TrendUpIco /> : <TrendDnIco />}
                    {Math.abs(stat.change)}%
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-gray-900 tracking-tight">{stat.value}</p>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mt-1">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {PAGES.map((p, i) => (
            <motion.div
              key={p.href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 + 0.2 }}
              whileHover={{ y: -4 }}
            >
              <Link href={p.href}>
                <div className="group bg-white rounded-2xl p-4 border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-300 cursor-pointer h-full">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 duration-300"
                    style={{ background: p.bg, color: p.color }}
                  >
                    {p.icon}
                  </div>
                  <p className="font-semibold text-sm text-gray-900">{p.label}</p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">{p.desc}</p>
                  <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    Explore <ArrowRightIco />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Period Summary Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Period Summary</h3>
                <p className="text-xs text-gray-500 mt-0.5">{rangeLabel} vs Yesterday vs Last Week</p>
              </div>
              <span className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-100">
                <span className="text-xs font-semibold text-blue-600">📊 Summary</span>
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Metric
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {rangeLabel}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                      Yesterday
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Last Week
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                      Trend
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {summaryRows.map((r) => {
                    const trend = getTrend(r.today, r.yest);
                    return (
                      <motion.tr
                        key={r.label}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="hover:bg-gray-50/50 transition-colors duration-150"
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <span
                              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: `${r.color}15`, color: r.color }}
                            >
                              {r.icon}
                            </span>
                            <span className="font-medium text-sm text-gray-900">{r.label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span className="font-bold text-sm" style={{ color: r.color }}>
                            {r.today ?? '—'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right hidden sm:table-cell text-gray-600">
                          {r.yest ?? '—'}
                        </td>
                        <td className="px-6 py-3 text-right hidden md:table-cell text-gray-600">
                          {r.week ?? '—'}
                        </td>
                        <td className="px-6 py-3 text-right hidden lg:table-cell">
                          {isTodayRange && trend !== null && trend !== undefined && r.today ? (
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                                trend >= 0
                                  ? 'bg-green-50 text-green-600'
                                  : 'bg-red-50 text-red-600'
                              }`}
                            >
                              {trend >= 0 ? <TrendUpIco /> : <TrendDnIco />}
                              {Math.abs(trend)}%
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Today's Mix Pie Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300"
          >
            <div className="mb-4">
              <h3 className="text-sm font-bold text-gray-900">{rangeLabel}'s Mix</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {today?.totalCalls || 0} total calls
              </p>
            </div>
            {pieData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[220px] gap-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <PhoneIco />
                </div>
                <p className="text-sm text-gray-500">No calls yet for {rangeLabel.toLowerCase()}</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={68}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {pieData.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {pieData.map((d) => (
                    <div
                      key={d.name}
                      className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: d.color }}
                        />
                        <span className="text-gray-600">{d.name}</span>
                      </div>
                      <span className="font-bold text-gray-900">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </div>

        {/* Trend Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Call Volume Trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Call Volume Trend</h3>
                <p className="text-xs text-gray-500 mt-0.5">Comparison across periods</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full border border-green-100">
                <span className="text-xs font-semibold text-green-600">📈 Growth</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} barCategoryGap="40%">
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTip />} />
                <Bar
                  dataKey="calls"
                  name="Total Calls"
                  fill="url(#trendGrad)"
                  radius={[8, 8, 0, 0]}
                  barSize={48}
                >
                  <LabelList
                    dataKey="calls"
                    position="top"
                    style={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }}
                    formatter={(v) => v || ''}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Trend Line Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Performance Trend</h3>
                <p className="text-xs text-gray-500 mt-0.5">Calls vs Connected</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span className="text-gray-600">Total</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="text-gray-600">Connected</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={lineData}>
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fill: '#94A3B8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip content={<ChartTip />} />
                <Area
                  type="monotone"
                  dataKey="calls"
                  name="Total Calls"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fill="url(#lineGrad)"
                />
                <Line
                  type="monotone"
                  dataKey="connected"
                  name="Connected"
                  stroke="#22C55E"
                  strokeWidth={2}
                  dot={{ fill: '#22C55E', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Quick Insights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-lg font-bold">Quick Insights</h4>
              <p className="text-blue-100 text-sm mt-1">
                Key takeaways from {rangeLabel.toLowerCase()}'s call data
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5">
                <p className="text-xs text-blue-200">Connection Rate</p>
                <p className="text-lg font-bold">
                  {today?.totalCalls
                    ? `${Math.round((today?.connectedCalls || 0) / today?.totalCalls * 100)}%`
                    : '0%'}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5">
                <p className="text-xs text-blue-200">{rangeLabel}'s Progress</p>
                <p className="text-lg font-bold">
                  {today?.totalCalls || 0} calls
                </p>
              </div>
              {isTodayRange && (
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5">
                  <p className="text-xs text-blue-200">vs Yesterday</p>
                  <p className="text-lg font-bold flex items-center gap-1">
                    {trends.total !== null && trends.total !== undefined ? (
                      <>
                        {trends.total >= 0 ? '+' : ''}
                        {trends.total}%
                      </>
                    ) : (
                      '—'
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}