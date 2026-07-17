'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Pusher from 'pusher-js';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LabelList,
} from 'recharts';
import api from '../../../lib/api';
import CallTypeBadge from '../../../components/CallTypeBadge';
import DateRangeFilter, { formatRangeLabel } from '../../../components/DateRangeFilter';
import { motion, AnimatePresence } from 'framer-motion';


function parseUTC(ts) {
  if (!ts) return new Date(NaN);
  const s = String(ts).trim();
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s)) return new Date(s);
  return new Date(s + 'Z');
}

function fmtDate(ts, tz) {
  return parseUTC(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: tz });
}

function fmtTime(ts, tz) {
  return parseUTC(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: tz });
}

function todayInTZ(tz) {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz });
}

function utcHourLabel(utcHour, tz) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), parseInt(utcHour), 0, 0));
  const h = parseInt(d.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false })) % 24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}${ampm}`;
}

/* ── Icons ───────────────────────────────────────── */
const Ico = ({ size = 18, children, className = '' }) => (
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

const PhoneIco = ({ size }) => (
  <Ico size={size}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
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
const MissedIco = () => (
  <Ico>
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
  </Ico>
);
const CheckIco = () => (
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
const RefreshIco = () => (
  <Ico size={14}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </Ico>
);
const StarIco = () => (
  <Ico size={14}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </Ico>
);
const ChevronIco = () => (
  <Ico size={13}>
    <polyline points="9 18 15 12 9 6" />
  </Ico>
);
const CloseIco = () => (
  <Ico size={15}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
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
const GlobeIco = () => (
  <Ico size={14}>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </Ico>
);
const LeadIco = () => (
  <Ico size={16}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="23" y1="11" x2="17" y2="11" />
    <line x1="20" y1="8" x2="20" y2="14" />
  </Ico>
);
const ClockIco = () => (
  <Ico size={14}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Ico>
);

function trend(cur, prev) {
  if (!prev || prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

const KPI = [
  { key: 'totalCalls', label: 'Total Calls', Icon: PhoneIco, grad: 'linear-gradient(135deg,#2563EB,#3B82F6)', href: '/reports/calllogs' },
  { key: 'incoming', label: 'Incoming', Icon: InIco, grad: 'linear-gradient(135deg,#16A34A,#22C55E)', href: '/reports/calllogs' },
  { key: 'outgoing', label: 'Outgoing', Icon: OutIco, grad: 'linear-gradient(135deg,#D97706,#F59E0B)', href: '/reports/calllogs' },
  { key: 'missed', label: 'Missed', Icon: MissedIco, grad: 'linear-gradient(135deg,#DC2626,#EF4444)', href: '/reports/calllogs' },
  { key: 'connectedCalls', label: 'Connected', Icon: CheckIco, grad: 'linear-gradient(135deg,#0D9488,#14B8A6)', href: '/reports/calllogs' },
  { key: 'uniqueClients', label: 'Unique Clients', Icon: UsersIco, grad: 'linear-gradient(135deg,#7C3AED,#8B5CF6)', href: '/reports/calllogs' },
];

const KpiCard = ({ label, value, Icon, grad, href, delta, idx }) => {
  const card = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05, duration: 0.4 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group bg-white rounded-2xl p-5 border border-gray-100 hover:border-blue-200 hover:shadow-xl transition-all duration-300 cursor-pointer"
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20"
          style={{ background: grad }}
        >
          <Icon size={18} />
        </div>
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.05 + 0.2 }}
          className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        >
          <ChevronIco />
        </motion.span>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 tracking-tight">
          {value ?? '—'}
        </p>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mt-1">
          {label}
        </p>
        {delta !== null && delta !== undefined && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: idx * 0.05 + 0.3 }}
            className="flex items-center gap-1 mt-2 text-xs font-semibold"
          >
            <span className={`flex items-center gap-1 ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {delta >= 0 ? <TrendUpIco /> : <TrendDnIco />}
              {Math.abs(delta)}% vs yesterday
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
};

const PeriodPanel = ({ title, data }) => {
  const rows = [
    { label: 'Total Calls', val: data?.totalCalls, color: '#2563EB' },
    { label: 'Incoming', val: data?.incoming, color: '#16A34A' },
    { label: 'Outgoing', val: data?.outgoing, color: '#D97706' },
    { label: 'Missed', val: data?.missed, color: '#DC2626' },
    { label: 'Connected', val: data?.connectedCalls, color: '#0D9488' },
    { label: 'Working Hours', val: data?.workingHours, color: '#475569' },
  ];

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-lg transition-all duration-300"
    >
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
        {title}
      </p>
      {!data ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-0">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0"
            >
              <span className="text-xs text-gray-500">{r.label}</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: r.color }}>
                {r.val ?? '—'}
              </span>
            </div>
          ))}
          {data?.callDuration && (
            <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
              <span className="text-xs text-gray-500">Total Duration</span>
              <span className="text-sm font-semibold tabular-nums text-gray-700">
                {data.callDuration}
              </span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

const CreateLeadModal = ({ call, employees, onClose }) => {
  const [form, setForm] = useState({
    name: call?.contactName && call.contactName !== 'Unknown' ? call.contactName : '',
    phone: call?.contactNumber || '',
    email: '',
    assignedTo: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/api/leads/from-call', { ...form, callId: call?._id, source: 'Call' });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">Create Lead from Call</h3>
            <p className="text-xs text-gray-400 mt-0.5">{call?.contactNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors duration-200"
          >
            <CloseIco />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <div className="text-sm bg-red-50 text-red-600 rounded-xl px-4 py-3 border border-red-100">
              {error}
            </div>
          )}
          {[
            { k: 'name', l: 'Full Name', ro: false },
            { k: 'phone', l: 'Phone', ro: true },
            { k: 'email', l: 'Email', ro: false },
          ].map(({ k, l, ro }) => (
            <div key={k}>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">{l}</label>
              <input
                type={k === 'email' ? 'email' : 'text'}
                value={form[k]}
                readOnly={ro}
                onChange={(e) => !ro && setForm({ ...form, [k]: e.target.value })}
                className={`w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 outline-none ${ro ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'text-gray-900'
                  }`}
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Assign To</label>
            <select
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 outline-none text-gray-900"
            >
              <option value="">Unassigned</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors duration-200 font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating…' : 'Create Lead'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white rounded-xl px-4 py-3 text-xs shadow-2xl">
      <p className="text-gray-400">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-bold mt-1">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const LEAD_STATUSES = [
  { key: 'new', label: 'New', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { key: 'contacted', label: 'Contacted', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { key: 'interested', label: 'Interested', color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4' },
  { key: 'converted', label: 'Converted', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { key: 'lost', label: 'Lost', color: '#DC2626', bg: '#FFF1F2', border: '#FECACA' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [liveFeed, setLiveFeed] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leadModal, setLeadModal] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [tzOpen, setTzOpen] = useState(false);
  const [leadStats, setLeadStats] = useState({});
  const [dateRange, setDateRange] = useState({ range: 'today', startDate: null, endDate: null });
  const channelRef = useRef(null);
  const dateRangeRef = useRef(dateRange);

  useEffect(() => {
    dateRangeRef.current = dateRange;
  }, [dateRange]);

  const fetchStats = async (spin = false) => {
    if (spin) setRefreshing(true);
    try {
      const dr = dateRangeRef.current;
      const params = { range: dr.range };
      if (dr.range === 'custom') {
        params.startDate = dr.startDate;
        params.endDate = dr.endDate;
      }
      const r = await api.get('/api/calls/stats', { params });
      setStats(r.data.data);
    } catch { } finally {
      setRefreshing(false);
    }
  };

  const fetchLeadStats = async () => {
    try {
      const results = await Promise.all(
        LEAD_STATUSES.map((s) =>
          api
            .get('/api/leads', { params: { status: s.key, limit: 1 } })
            .then((r) => ({ key: s.key, count: r.data.data?.total ?? 0 }))
            .catch(() => ({ key: s.key, count: 0 }))
        )
      );
      const map = {};
      results.forEach((r) => {
        map[r.key] = r.count;
      });
      setLeadStats(map);
    } catch { }
  };

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  useEffect(() => {
    fetchLeadStats();
    api.get('/api/employees').then((r) => setEmployees(r.data.data)).catch(() => { });
    api
      .get('/api/calls/realtime')
      .then((r) => setLiveFeed((r.data.data || []).slice(0, 30)))
      .catch(() => { });
    const interval = setInterval(fetchStats, 30000);
    if (!process.env.NEXT_PUBLIC_PUSHER_KEY) return () => clearInterval(interval);
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2',
    });
    const channel = pusher.subscribe('managers');
    channelRef.current = channel;
    channel.bind('new_call_log', (data) => {
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
  const yest = stats?.yesterday;
  const selected = stats?.selected || today;
  const isTodayRange = dateRange.range === 'today';
  const rangeLabel = formatRangeLabel(dateRange);

  const pieData = selected
    ? [
      { name: 'Incoming', value: selected.incoming || 0, color: '#22C55E' },
      { name: 'Outgoing', value: selected.outgoing || 0, color: '#F59E0B' },
      { name: 'Connected', value: selected.connectedCalls || 0, color: '#14B8A6' },
      { name: 'Missed', value: selected.missed || 0, color: '#EF4444' },
      { name: 'Rejected', value: selected.rejected || 0, color: '#8B5CF6' },
    ].filter((d) => d.value > 0)
    : [];

  const greeting = (() => {
    const h = new Date().toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false });
    const hr = parseInt(h);
    return hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  })();

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone,
  });

  const totalLeads = Object.values(leadStats).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6 lg:space-y-7">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              {greeting} 👋
            </h1>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
              <ClockIco />
              {todayLabel}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Date range filter */}
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
          
            <button
              onClick={() => fetchStats(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {KPI.map((cfg, i) => (
            <KpiCard
              key={cfg.key}
              idx={i}
              label={cfg.label}
              value={selected?.[cfg.key]}
              Icon={cfg.Icon}
              grad={cfg.grad}
              href={cfg.href}
              delta={isTodayRange && cfg.key !== 'uniqueClients' ? trend(selected?.[cfg.key], yest?.[cfg.key]) : null}
            />
          ))}
        </div>

        {/* Lead Pipeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <LeadIco />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Lead Pipeline</h3>
                <p className="text-xs text-gray-500">{totalLeads} total leads</p>
              </div>
            </div>
            <Link
              href="/reports/lead"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {LEAD_STATUSES.map((s, i) => {
              const count = leadStats[s.key] ?? 0;
              const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
              return (
                <Link href="/reports/lead" key={s.key}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 + 0.35 }}
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
                        {pct}%
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">
                      {leadStats[s.key] === undefined ? '—' : count}
                    </p>
                    <div className="mt-3 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: i * 0.04 + 0.45, duration: 0.8 }}
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

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="xl:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Calls Per Hour</h3>
                <p className="text-xs text-gray-500 mt-1">{rangeLabel} activity ·</p>
              </div>
              {isTodayRange && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full border border-green-100">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-semibold text-green-600">Live</span>
                </div>
              )}
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={selected?.callsPerHour || []} barCategoryGap="40%" margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  tickFormatter={(h) => utcHourLabel(h, timezone)}
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
                <Bar dataKey="count" fill="url(#barGrad)" radius={[6, 6, 0, 0]} name="Calls">
                  <LabelList
                    dataKey="count"
                    position="top"
                    style={{ fontSize: 9, fill: '#94A3B8', fontWeight: 600 }}
                    formatter={(v) => v > 0 ? v : ''}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Pie Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <div className="mb-4">
              <h3 className="text-sm font-bold text-gray-900">{rangeLabel} Breakdown</h3>
              <p className="text-xs text-gray-500 mt-1">{selected?.totalCalls || 0} total calls</p>
            </div>
            {pieData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[220px] gap-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <PhoneIco size={24} />
                </div>
                <p className="text-sm text-gray-500">No calls yet for {rangeLabel.toLowerCase()}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, color: '#475569', paddingTop: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Top Dialers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Top Dialers</h3>
                <p className="text-xs text-gray-500 mt-1">{rangeLabel}'s leaders</p>
              </div>
              <Link
                href="/employees/leaderboard"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200"
              >
                View all
              </Link>
            </div>
            {(selected?.topDialers?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center h-[260px] gap-3">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <StarIco />
                </div>
                <p className="text-sm text-gray-500">No data yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(selected.topDialers || []).slice(0, 7).map((d, i) => {
                  const pct = Math.min(100, (d.count / (selected.topDialers[0]?.count || 1)) * 100);
                  const MEDAL = ['#F59E0B', '#94A3B8', '#B45309'];
                  const MEDAL_BG = ['rgba(245,158,11,0.12)', 'rgba(148,163,184,0.12)', 'rgba(180,83,9,0.12)'];
                  return (
                    <div key={d.employeeId} className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{
                          background: i < 3 ? MEDAL_BG[i] : '#F1F5F9',
                          color: i < 3 ? MEDAL[i] : '#94A3B8',
                        }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{d.name}</p>
                          <span className="text-sm font-bold text-blue-600 ml-2 flex-shrink-0">{d.count}</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ delay: i * 0.05 + 0.6, duration: 0.8 }}
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Live Feed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="xl:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Live Call Feed</h3>
                <p className="text-xs text-gray-500 mt-1">Streaming in real time ·</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full border border-green-100">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-semibold text-green-600">Real-time</span>
                </div>
                <Link
                  href="/calls/live"
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200"
                >
                  Monitor →
                </Link>
              </div>
            </div>
            {liveFeed.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] gap-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <PhoneIco size={24} />
                </div>
                <p className="text-sm text-gray-500">Waiting for live calls…</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <div className="max-h-[300px] overflow-y-auto px-2">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 rounded-xl">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Employee
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                          Contact
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                          Duration
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Time
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {liveFeed.map((log, i) => (
                        <motion.tr
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className="hover:bg-gray-50/50 transition-colors duration-150"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {(log.employeeName || '?')[0].toUpperCase()}
                              </div>
                              <span className="font-medium text-gray-900 truncate max-w-[80px]">
                                {log.employeeName}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <p className="text-gray-900">{log.contactNumber}</p>
                            {log.contactName && log.contactName !== 'Unknown' && (
                              <p className="text-xs text-gray-500">{log.contactName}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <CallTypeBadge type={log.callType} />
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-gray-700">
                            {log.duration ? `${Math.floor(log.duration / 60)}m ${log.duration % 60}s` : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                            {fmtTime(log.timestamp, timezone)}
                          </td>
                          <td className="px-4 py-3">
                            {!log.hasLead && (
                              <button
                                onClick={() => setLeadModal(log)}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors duration-200 border border-blue-100 hover:border-blue-600 whitespace-nowrap"
                              >
                                + Lead
                              </button>
                            )}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Period Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
        >
          <h3 className="text-sm font-bold text-gray-900 mb-4">Period Comparison</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PeriodPanel title={rangeLabel} data={selected} />
            <PeriodPanel title="Yesterday" data={stats?.yesterday} />
            <PeriodPanel title="Last Week" data={stats?.lastWeek} />
          </div>
        </motion.div>

        {/* Modal */}
        <AnimatePresence>
          {leadModal && (
            <CreateLeadModal
              call={leadModal}
              employees={employees}
              onClose={() => setLeadModal(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}