'use client';
import { useEffect, useState, useRef } from 'react';
import Pusher from 'pusher-js';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  ComposedChart,
  Line,
  Cell,
} from 'recharts';
import api from '../../../../lib/api';
import { parseUTC } from '../../../../lib/timezone';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff, Phone, TrendingUp } from 'lucide-react';

function formatDur(sec) {
  if (!sec) return '0s';
  const m = Math.floor(sec / 60),
    s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function buildISTHourlyData(callsPerHour) {
  const istMap = {};
  for (let h = 0; h < 24; h++) istMap[h] = 0;
  (callsPerHour || []).forEach(({ hour, count }) => {
    const d = new Date(Date.UTC(2024, 0, 1, hour, 30, 0));
    const istHour =
      parseInt(
        d.toLocaleString('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          hour12: false,
        })
      ) % 24;
    istMap[istHour] = (istMap[istHour] || 0) + count;
  });
  return Array.from({ length: 24 }, (_, h) => ({
    h: `${String(h).padStart(2, '0')}:00`,
    calls: istMap[h] || 0,
  }));
}

const TYPE_COLOR = {
  incoming: '#22C55E',
  outgoing: '#F59E0B',
  missed: '#EF4444',
  rejected: '#8B5CF6',
};
const TYPE_BG = {
  incoming: 'rgba(34,197,94,0.10)',
  outgoing: 'rgba(245,158,11,0.10)',
  missed: 'rgba(239,68,68,0.10)',
  rejected: 'rgba(139,92,246,0.10)',
};
const TYPE_ICON = {
  incoming: PhoneIncoming,
  outgoing: PhoneOutgoing,
  missed: PhoneMissed,
  rejected: PhoneOff,
};

function LiveCallTypeBadge({ callType }) {
  const IconComponent = TYPE_ICON[callType] || Phone;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize"
      style={{
        background: TYPE_BG[callType] || '#F1F5F9',
        color: TYPE_COLOR[callType] || '#64748B',
      }}
    >
      <IconComponent size={11} /> {callType}
    </span>
  );
}
const AVATAR_COLORS = [
  '#2563EB',
  '#16A34A',
  '#D97706',
  '#DC2626',
  '#0D9488',
  '#7C3AED',
  '#0891B2',
  '#BE185D',
];

function Ico({ size = 16, children, className = '' }) {
  return (
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
}

const KPI_THEMES = {
  'Calls Today': {
    topBar: 'bg-gradient-to-r from-blue-600 to-indigo-600',
    bgGrad: 'bg-gradient-to-br from-blue-50/40 via-white to-white',
    borderColor: 'border-blue-100 hover:border-blue-300',
    iconBg: 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-500/25',
    shadowHover: 'hover:shadow-blue-500/10',
    accentColor: '#2563EB',
    defaultSub: 'Total call activity',
  },
  'Connected': {
    topBar: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    bgGrad: 'bg-gradient-to-br from-emerald-50/40 via-white to-white',
    borderColor: 'border-emerald-100 hover:border-emerald-300',
    iconBg: 'bg-gradient-to-br from-emerald-600 to-teal-600 shadow-emerald-500/25',
    shadowHover: 'hover:shadow-emerald-500/10',
    accentColor: '#16A34A',
    barColor: 'bg-emerald-500',
  },
  'Incoming': {
    topBar: 'bg-gradient-to-r from-teal-500 to-cyan-600',
    bgGrad: 'bg-gradient-to-br from-teal-50/40 via-white to-white',
    borderColor: 'border-teal-100 hover:border-teal-300',
    iconBg: 'bg-gradient-to-br from-teal-600 to-cyan-600 shadow-teal-500/25',
    shadowHover: 'hover:shadow-teal-500/10',
    accentColor: '#0D9488',
    defaultSub: 'Inbound calls received',
  },
  'Outgoing': {
    topBar: 'bg-gradient-to-r from-amber-500 to-orange-500',
    bgGrad: 'bg-gradient-to-br from-amber-50/40 via-white to-white',
    borderColor: 'border-amber-100 hover:border-amber-300',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/25',
    shadowHover: 'hover:shadow-amber-500/10',
    accentColor: '#D97706',
    defaultSub: 'Outbound dialed calls',
  },
  'Missed': {
    topBar: 'bg-gradient-to-r from-rose-500 to-red-600',
    bgGrad: 'bg-gradient-to-br from-rose-50/40 via-white to-white',
    borderColor: 'border-rose-100 hover:border-rose-300',
    iconBg: 'bg-gradient-to-br from-rose-600 to-red-600 shadow-rose-500/25',
    shadowHover: 'hover:shadow-rose-500/10',
    accentColor: '#DC2626',
    barColor: 'bg-rose-500',
  },
  'Rejected': {
    topBar: 'bg-gradient-to-r from-purple-500 to-violet-600',
    bgGrad: 'bg-gradient-to-br from-purple-50/40 via-white to-white',
    borderColor: 'border-purple-100 hover:border-purple-300',
    iconBg: 'bg-gradient-to-br from-purple-600 to-violet-600 shadow-purple-500/25',
    shadowHover: 'hover:shadow-purple-500/10',
    accentColor: '#7C3AED',
    defaultSub: 'Declined or busy',
  },
  'Active Agents': {
    topBar: 'bg-gradient-to-r from-sky-500 to-blue-600',
    bgGrad: 'bg-gradient-to-br from-sky-50/40 via-white to-white',
    borderColor: 'border-sky-100 hover:border-sky-300',
    iconBg: 'bg-gradient-to-br from-sky-600 to-blue-600 shadow-sky-500/25',
    shadowHover: 'hover:shadow-sky-500/10',
    accentColor: '#0891B2',
    barColor: 'bg-sky-500',
  },
  'Avg Duration': {
    topBar: 'bg-gradient-to-r from-amber-500 to-yellow-600',
    bgGrad: 'bg-gradient-to-br from-amber-50/40 via-white to-white',
    borderColor: 'border-amber-100 hover:border-amber-300',
    iconBg: 'bg-gradient-to-br from-amber-600 to-yellow-600 shadow-amber-500/25',
    shadowHover: 'hover:shadow-amber-500/10',
    accentColor: '#D97706',
    defaultSub: 'Average call length',
  },
};

const KpiCard = ({ label, value, sub, color = '#2563EB', icon, delay = 0 }) => {
  const theme = KPI_THEMES[label] || {
    topBar: 'bg-gradient-to-r from-blue-600 to-indigo-600',
    bgGrad: 'bg-gradient-to-br from-blue-50/40 via-white to-white',
    borderColor: 'border-blue-100 hover:border-blue-300',
    iconBg: 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-500/25',
    shadowHover: 'hover:shadow-blue-500/10',
    accentColor: color,
  };

  const pctMatch = sub && typeof sub === 'string' ? sub.match(/(\d+)%/) : null;
  const pct = pctMatch ? parseInt(pctMatch[1], 10) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      whileHover={{ y: -3 }}
      className={`relative bg-white rounded-2xl p-5 border ${theme.borderColor} ${theme.bgGrad} shadow-sm hover:shadow-xl ${theme.shadowHover} transition-all duration-300 overflow-hidden flex flex-col justify-between`}
    >
      {/* Highlighting Top Accent Strip */}
      <div className={`absolute top-0 left-0 right-0 h-1.5 ${theme.topBar}`} />

      <div>
        <div className="flex items-center justify-between mb-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md ${theme.iconBg}`}
          >
            {icon}
          </div>
          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-emerald-500" />
            Live
          </span>
        </div>

        <p className="text-3xl font-extrabold text-gray-900 tracking-tight tabular-nums">
          {typeof value === 'number' ? value.toLocaleString() : (value ?? '—')}
        </p>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mt-1">
          {label}
        </p>
      </div>

      {pct !== null ? (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${theme.barColor || 'bg-blue-500'}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[11px] text-gray-400 mt-1.5">
            <span>Progress</span>
            <span className="font-semibold" style={{ color: theme.accentColor }}>{sub}</span>
          </div>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>{sub || theme.defaultSub || 'Live metric'}</span>
        </div>
      )}
    </motion.div>
  );
};

const PhoneIco = () => (
  <Ico>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </Ico>
);
const CheckIco = () => (
  <Ico>
    <polyline points="20 6 9 17 4 12" />
  </Ico>
);
const MissedIco = () => (
  <Ico>
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
  </Ico>
);
const RejectIco = () => (
  <Ico>
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </Ico>
);
const UsersIco = () => (
  <Ico>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Ico>
);
const InIco = () => (
  <Ico>
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
    <polyline points="17 18 23 18 23 12" />
  </Ico>
);
const OutIco = () => (
  <Ico>
    <polyline points="1 6 10.5 15.5 15.5 10.5 23 18" />
    <polyline points="7 6 1 6 1 12" />
  </Ico>
);
const ClockIco = () => (
  <Ico>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Ico>
);
const ActivityIco = () => (
  <Ico>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </Ico>
);
const ZapIco = () => (
  <Ico size={14}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
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
      <p className="mb-1.5 font-medium text-gray-400">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mt-1">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: p.color || p.fill || '#2563EB' }}
          />
          <span className="font-bold">
            {p.name}: <span className="text-white">{p.value}</span>
          </span>
        </div>
      ))}
    </motion.div>
  );
};

export default function LiveMonitorPage() {
  const [stats, setStats] = useState(null);
  const [liveFeed, setLiveFeed] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [autoScroll, setAutoScroll] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await api.get('/api/calls/stats');
      setStats(res.data.data);
    } catch {}
  };

  const employeesRef = useRef(employees);
  useEffect(() => {
    employeesRef.current = employees;
  }, [employees]);

  useEffect(() => {
    (async () => {
      await Promise.all([
        fetchStats(),
        api
          .get('/api/calls/realtime')
          .then((r) => setLiveFeed((r.data.data || []).slice(0, 30)))
          .catch(() => {}),
        api
          .get('/api/employees')
          .then((r) => setEmployees(r.data.data || []))
          .catch(() => {}),
      ]);
      setLoading(false);
    })();

    const interval = setInterval(fetchStats, 30000);
    if (!process.env.NEXT_PUBLIC_PUSHER_KEY) return () => clearInterval(interval);

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2',
    });
    const channel = pusher.subscribe('managers');
    channel.bind('new_call_log', (data) => {
      // Additional safeguard: verify call belongs to scoped employees if list is loaded
      const scopedList = employeesRef.current;
      if (scopedList.length > 0 && data?.employeeId) {
        const inScope = scopedList.some((e) => e._id?.toString() === data.employeeId?.toString());
        if (!inScope) return;
      }
      setLiveFeed((prev) => [data, ...prev].slice(0, 30));
      fetchStats();
    });
    return () => {
      clearInterval(interval);
      channel.unbind_all();
      pusher.unsubscribe('managers');
      pusher.disconnect();
    };
  }, []);

  const today = stats?.today;
  const avgDur = today?.totalCalls
    ? Math.round((today.totalDuration || 0) / today.totalCalls)
    : 0;
  const activeAgents = employees.filter((emp) => {
    const last = liveFeed.find((c) => c.employeeId === emp._id?.toString());
    return last && Date.now() - new Date(last.timestamp) < 60 * 60 * 1000;
  }).length;

  const empLastCall = {};
  liveFeed.forEach((c) => {
    if (!empLastCall[c.employeeId]) empLastCall[c.employeeId] = c;
  });

  const hourlyData = buildISTHourlyData(stats?.callsPerHour);

  const compRows = [
    {
      label: 'Total Calls',
      today: today?.totalCalls,
      week: stats?.thisWeek?.totalCalls,
      month: stats?.thisMonth?.totalCalls,
    },
    {
      label: 'Incoming',
      today: today?.incoming,
      week: stats?.thisWeek?.incoming,
      month: stats?.thisMonth?.incoming,
    },
    {
      label: 'Outgoing',
      today: today?.outgoing,
      week: stats?.thisWeek?.outgoing,
      month: stats?.thisMonth?.outgoing,
    },
    {
      label: 'Missed',
      today: today?.missed,
      week: stats?.thisWeek?.missed,
      month: stats?.thisMonth?.missed,
    },
    {
      label: 'Connected',
      today: today?.connectedCalls,
      week: stats?.thisWeek?.connectedCalls,
      month: stats?.thisMonth?.connectedCalls,
    },
    {
      label: 'Unique Contacts',
      today: today?.uniqueClients,
      week: stats?.thisWeek?.uniqueClients,
      month: stats?.thisMonth?.uniqueClients,
    },
  ];

  // Filtered feed
  const filteredFeed =
    activeFilter === 'all'
      ? liveFeed
      : liveFeed.filter((call) => call.callType === activeFilter);

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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-28 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white flex items-center justify-center">
                  <ZapIco />
                </span>
                Live Monitor
                <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-green-50 text-green-600 border border-green-100">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-green-500" />
                  LIVE
                </span>
              </h2>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                <ActivityIco />
                Real-time call activity · Auto-refreshes every 30s · IST timezone
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    autoScroll
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Auto-scroll
                </button>
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    activeFilter === 'all'
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  All
                </button>
                {Object.keys(TYPE_COLOR).map((type) => (
                  <button
                    key={type}
                    onClick={() => setActiveFilter(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      activeFilter === type
                        ? 'bg-white shadow-sm text-gray-900'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={{
                      color: activeFilter === type ? TYPE_COLOR[type] : undefined,
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* KPI Row 1 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Calls Today"
            value={today?.totalCalls}
            color="#2563EB"
            bg="#EFF6FF"
            icon={<PhoneIco />}
            delay={0.05}
          />
          <KpiCard
            label="Connected"
            value={today?.connectedCalls}
            color="#16A34A"
            bg="#F0FDF4"
            sub={
              today?.totalCalls
                ? `${Math.round((today.connectedCalls || 0) / today.totalCalls * 100)}% rate`
                : undefined
            }
            icon={<CheckIco />}
            delay={0.1}
          />
          <KpiCard
            label="Incoming"
            value={today?.incoming}
            color="#0D9488"
            bg="#F0FDFA"
            icon={<InIco />}
            delay={0.15}
          />
          <KpiCard
            label="Outgoing"
            value={today?.outgoing}
            color="#D97706"
            bg="#FFFBEB"
            icon={<OutIco />}
            delay={0.2}
          />
        </div>

        {/* KPI Row 2 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Missed"
            value={today?.missed}
            color="#DC2626"
            bg="#FFF1F2"
            sub={
              today?.totalCalls
                ? `${Math.round((today.missed || 0) / today.totalCalls * 100)}% of calls`
                : undefined
            }
            icon={<MissedIco />}
            delay={0.25}
          />
          <KpiCard
            label="Rejected"
            value={today?.rejected || today?.notPickedByClient}
            color="#7C3AED"
            bg="#F5F3FF"
            icon={<RejectIco />}
            delay={0.3}
          />
          <KpiCard
            label="Active Agents"
            value={activeAgents}
            color="#0891B2"
            bg="#EFF6FF"
            sub={`of ${employees.length} total`}
            icon={<UsersIco />}
            delay={0.35}
          />
          <KpiCard
            label="Avg Duration"
            value={formatDur(avgDur)}
            color="#D97706"
            bg="#FFFBEB"
            sub="per call today"
            icon={<ClockIco />}
            delay={0.4}
          />
        </div>

        {/* Live Feed + Team Status */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Live Feed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Live Call Feed</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {filteredFeed.length} recent events
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-600 border border-green-100">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-green-500" />
                  Streaming
                </span>
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              <AnimatePresence>
                {filteredFeed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <PhoneIco />
                    </div>
                    <p className="text-sm text-gray-500">Waiting for live calls…</p>
                  </div>
                ) : (
                  filteredFeed.map((call, i) => (
                    <motion.div
                      key={call._id || i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: i * 0.02 }}
                      className="flex items-center gap-4 px-6 py-3 border-b border-gray-50 hover:bg-gray-50/50 transition-colors duration-150"
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-md"
                        style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                      >
                        {(call.employeeName || 'U').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {call.contactName || call.contactNumber}
                          </span>
                          <LiveCallTypeBadge callType={call.callType} />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {call.employeeName} · {formatDur(call.duration)}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs font-medium text-gray-600">{timeAgo(call.timestamp)}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {parseUTC(call.timestamp).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Asia/Kolkata',
                          })}
                        </p>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Team Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Team Status</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {employees.length} agents · {activeAgents} active
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-semibold text-green-600">Live</span>
                </div>
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {employees.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-sm text-gray-500">
                  No agents available
                </div>
              ) : (
                employees.map((emp, i) => {
                  const last = empLastCall[emp._id?.toString()];
                  const active = last && Date.now() - new Date(last.timestamp) < 60 * 60 * 1000;
                  const lastType = last?.callType;
                  return (
                    <motion.div
                      key={emp._id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="flex items-center gap-3 px-6 py-3 border-b border-gray-50 hover:bg-gray-50/50 transition-colors duration-150"
                    >
                      <div className="relative flex-shrink-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-md"
                          style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                        >
                          {emp.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                          style={{ background: active ? '#22C55E' : '#CBD5E1' }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
                        <p className="text-xs text-gray-400">
                          {last ? timeAgo(last.timestamp) : 'No calls today'}
                        </p>
                      </div>
                      {active && lastType && (
                        <span
                          className="text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize"
                          style={{
                            background: TYPE_BG[lastType] || '#F1F5F9',
                            color: TYPE_COLOR[lastType] || '#64748B',
                          }}
                        >
                          {lastType}
                        </span>
                      )}
                      {!active && last && (
                        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                          Idle
                        </span>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>

        {/* Hourly Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Calls by Hour (IST)</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Hourly distribution in Indian Standard Time
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-green-50 text-green-600 border border-green-100">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-green-500" />
                Today
              </span>
              <span className="text-xs text-gray-400">
                Peak: {Math.max(...hourlyData.map((d) => d.calls))} calls
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={hourlyData}>
              <defs>
                <linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis
                dataKey="h"
                tick={{ fontSize: 9, fill: '#94A3B8' }}
                interval={2}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={28}
              />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(37,99,235,0.05)' }} />
              <Area
                type="monotone"
                dataKey="calls"
                name="Calls"
                stroke="#2563EB"
                strokeWidth={2}
                fill="url(#hourGrad)"
                fillOpacity={1}
              />
              <Bar
                dataKey="calls"
                name="Calls"
                fill="url(#hourGrad)"
                radius={[6, 6, 0, 0]}
                barSize={14}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Period Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Period Comparison</h3>
                <p className="text-xs text-gray-500 mt-0.5">Today · This Week · This Month</p>
              </div>
              <span className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-100">
                <span className="text-xs font-semibold text-blue-600 inline-flex items-center gap-1"><TrendingUp size={13} /> Trends</span>
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Metric
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Today
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    This Week
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    This Month
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Progress
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {compRows.map((row) => {
                  const progress =
                    row.today && row.week
                      ? Math.round((row.today / row.week) * 100)
                      : null;
                  return (
                    <motion.tr
                      key={row.label}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                      className="hover:bg-gray-50/50 transition-colors duration-150"
                    >
                      <td className="px-6 py-3 font-medium text-gray-900">{row.label}</td>
                      <td className="px-6 py-3 text-right font-bold text-blue-600">
                        {row.today ?? '—'}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-600 hidden sm:table-cell">
                        {row.week ?? '—'}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-600 hidden md:table-cell">
                        {row.month ?? '—'}
                      </td>
                      <td className="px-6 py-3 text-right hidden lg:table-cell">
                        {progress !== null && progress > 0 ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs font-semibold text-gray-600">
                              {progress}%
                            </span>
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(progress, 100)}%` }}
                                transition={{ duration: 0.8 }}
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
                              />
                            </div>
                          </div>
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

        {/* Quick Stats Footer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-lg font-bold">Live Dashboard Insights</h4>
              <p className="text-blue-100 text-sm mt-1">
                Real-time monitoring and team performance
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5">
                <p className="text-xs text-blue-200">Call Volume</p>
                <p className="text-lg font-bold">{today?.totalCalls || 0}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5">
                <p className="text-xs text-blue-200">Active Agents</p>
                <p className="text-lg font-bold">{activeAgents}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5">
                <p className="text-xs text-blue-200">Connection Rate</p>
                <p className="text-lg font-bold">
                  {today?.totalCalls
                    ? `${Math.round((today.connectedCalls || 0) / today.totalCalls * 100)}%`
                    : '0%'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}