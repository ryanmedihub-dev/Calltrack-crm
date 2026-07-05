'use client';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, ComposedChart,
} from 'recharts';
import api from '../../../../lib/api';
import { fmtDateTime, parseUTC } from '../../../../lib/timezone';
import { DataTable } from '../../../../components/report-shared';

const TYPE_META = {
  incoming: { label: 'Incoming', color: '#16A34A', bg: '#F0FDF4' },
  outgoing: { label: 'Outgoing', color: '#D97706', bg: '#FFFBEB' },
  missed: { label: 'Missed', color: '#DC2626', bg: '#FEF2F2' },
  rejected: { label: 'Rejected', color: '#7C3AED', bg: '#F5F3FF' },
};

/* ────────────────────────────────────────────────────────────
   ICONS — generic `Ico` primitive plus the small set every
   report page pulls in by name (all accept a `s` size prop).
──────────────────────────────────────────────────────────── */
const Ico = ({ size = 16, s, children, className = '', fill = 'none' }) => (
  <svg
    width={s || size}
    height={s || size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

const SearchIco = ({ s = 14 }) => (
  <Ico s={s}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </Ico>
);
const CalendarIco = ({ s = 14 }) => (
  <Ico s={s}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </Ico>
);
const ClockIco = ({ s = 14 }) => (
  <Ico s={s}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Ico>
);
const CheckIco = ({ s = 14 }) => (
  <Ico s={s}>
    <polyline points="20 6 9 17 4 12" />
  </Ico>
);
const PhoneIco = ({ s = 14 }) => (
  <Ico s={s}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  </Ico>
);
const InboxIco = ({ s = 32 }) => (
  <Ico s={s}>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </Ico>
);

/* ────────────────────────────────────────────────────────────
   SMALL PRIMITIVES
──────────────────────────────────────────────────────────── */
function CallBadge({ type }) {
  const m = TYPE_META[type] || TYPE_META.outgoing;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ color: m.color, background: m.bg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg px-3 py-2 text-xs shadow-lg border border-gray-200">
      <p className="text-gray-500 font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-semibold flex items-center gap-1.5" style={{ color: p.color || p.fill }}>
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: {p.value?.toLocaleString?.() ?? p.value}
        </p>
      ))}
    </div>
  );
}

function Skeleton({ className = '' }) {
  return <div className={`bg-gray-100 rounded animate-pulse ${className}`} />;
}

function EmptyState({ title = 'No records found', hint = 'Try widening your date range or clearing filters.' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <InboxIco s={32} />
      <p className="mt-3 text-sm font-medium text-gray-600">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{hint}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

/* StatCard supports a `loading` prop that renders a skeleton in place of the real value,
   so pages can render a row of placeholder cards before data arrives. */
function StatCard({ label, value, sub, color = '#2563EB', icon, loading = false }) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <Skeleton className="h-6 w-16 mt-3" />
        <Skeleton className="h-3 w-20 mt-2" />
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-white rounded-xl border border-gray-200 p-4 overflow-hidden group hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div
        className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-[0.06] group-hover:opacity-[0.1] transition-opacity"
        style={{ background: color }}
      />
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}14`, color }}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-3 tabular-nums">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </motion.div>
  );
}

/* Page-specific icon — single-person avatar glyph (shared UsersIco is a two-person group icon) */
const UserIco = ({ s = 16 }) => (
  <Ico size={s}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Ico>
);

/* ─── Helpers ─── */
const fmt = fmtDateTime;
const dur = (s) => (s ? `${Math.floor(s / 60)}m ${s % 60}s` : '—');

/* ─── Main Component ─── */
const ClientReportPage = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const r = await api.get('/api/calls', {
        params: { search: query.trim(), limit: 100 },
      });
      const calls = r.data?.data?.calls || r.data?.data || [];
      if (!calls.length) {
        setResult(null);
        setLoading(false);
        return;
      }

      const totalCalls = calls.length;
      const incoming = calls.filter((c) => c.callType === 'incoming').length;
      const outgoing = calls.filter((c) => c.callType === 'outgoing').length;
      const missed = calls.filter((c) => c.callType === 'missed').length;
      const connected = calls.filter((c) => c.isConnected || c.duration > 0).length;
      const totalDuration = calls.reduce((s, c) => s + (c.duration || 0), 0);
      const avgDuration = totalCalls ? Math.round(totalDuration / totalCalls) : 0;

      const employees = [...new Set(calls.map((c) => c.employeeName).filter(Boolean))];

      const byDate = {};
      calls.forEach((c) => {
        const d = parseUTC(c.timestamp).toLocaleDateString('en-CA', {
          timeZone: 'Asia/Kolkata',
        });
        byDate[d] = (byDate[d] || 0) + 1;
      });
      const chartData = Object.entries(byDate)
        .sort(([a], [b]) => (a > b ? 1 : -1))
        .map(([date, count]) => ({
          date: new Date(date).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', timeZone: 'UTC',
          }),
          count,
        }));

      const name =
        calls.find((c) => c.contactName && c.contactName !== 'Unknown')
          ?.contactName || query;

      setResult({
        calls, totalCalls, incoming, outgoing, missed, connected,
        totalDuration, avgDuration, employees, chartData, name,
      });
    } catch {
      setError('Failed to fetch call data. Please try again.');
    }
    setLoading(false);
  }, [query]);

  const handleKey = (e) => {
    if (e.key === 'Enter') search();
  };

  return (
    <div className="min-h-screen">
      <div className="space-y-5">

        {/* ── Header ── */}
        <div>
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            Reports <span className="text-gray-300">/</span> <span className="text-gray-500">Client Report</span>
          </p>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">Client Report</h1>
          <p className="text-xs text-gray-400 mt-0.5">Track all calls for any contact by name or phone number</p>
        </div>

        {/* ── Search ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <Field label="Search Client">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><SearchIco s={15} /></span>
                <input
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-gray-200 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                  placeholder="Enter name or phone number (e.g. +91 98765 43210)…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKey}
                />
              </div>
              <button
                onClick={search}
                disabled={!query.trim() || loading}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2"><span className="animate-spin">⟳</span> Searching…</span>
                ) : 'Search'}
              </button>
            </div>
          </Field>
          {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => <StatCard key={i} loading />)}
            </div>
            <Skeleton className="h-56" />
            <Skeleton className="h-64" />
          </div>
        )}

        {/* ── No results ── */}
        {!loading && searched && !result && (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16">
            <EmptyState title="No records found" hint={`No calls found for "${query}". Try a different number or name.`} />
          </div>
        )}

        {/* ── Results ── */}
        {result && (
          <>
            {/* Client Profile Card */}
            <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-100 p-5 flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black shrink-0 shadow-sm"
                style={{ background: 'linear-gradient(135deg, #2563EB, #60A5FA)' }}>
                {result.name[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg text-gray-900">{result.name}</p>
                <p className="text-sm mt-0.5 font-mono text-gray-500">{query}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {result.employees.map((e) => (
                    <span key={e} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                      <UserIco s={10} /> {e}
                    </span>
                  ))}
                  {result.employees.length === 0 && (
                    <span className="text-xs text-gray-400">No employee assigned</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <span className="text-xs font-medium text-gray-400">Total Calls</span>
                <p className="text-3xl font-black text-blue-600">{result.totalCalls}</p>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
              <StatCard label="Total Calls" value={result.totalCalls} color="#2563EB" icon={<PhoneIco s={16} />} />
              <StatCard label="Incoming" value={result.incoming} color="#16A34A" icon={<PhoneIco s={16} />} />
              <StatCard label="Outgoing" value={result.outgoing} color="#D97706" icon={<PhoneIco s={16} />} />
              <StatCard label="Missed" value={result.missed} color="#DC2626" icon={<PhoneIco s={16} />} />
              <StatCard label="Connected" value={result.connected} color="#0D9488" icon={<CheckIco s={16} />} />
              <StatCard label="Avg Duration" value={dur(result.avgDuration)} color="#7C3AED" icon={<ClockIco s={16} />} />
            </div>

            {/* Chart */}
            {result.chartData.length > 1 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900">Call Activity Over Time</h3>
                  <span className="text-xs text-gray-400 flex items-center gap-1"><CalendarIco s={12} /> Last {result.chartData.length} days</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={result.chartData}>
                    <defs>
                      <linearGradient id="clientAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="count" name="Calls" stroke="#2563EB" strokeWidth={2.5}
                      fill="url(#clientAreaGrad)" dot={{ fill: '#2563EB', r: 4 }} activeDot={{ r: 6, fill: '#1D4ED8' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Call History Table */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <DataTable
                showRowNumber
                columns={[
                  {
                    key: 'timestamp', label: 'Date & Time', width: 180,
                    filterValue: (r) => fmt(r.timestamp),
                    render: (r) => fmt(r.timestamp),
                  },
                  {
                    key: 'employeeName', label: 'Employee', width: 180,
                    render: (r) => (
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                          style={{ background: `hsl(${r.avatarHue}, 70%, 50%)` }}>
                          {(r.employeeName || '?')[0]?.toUpperCase()}
                        </div>
                        <span className="text-xs font-medium text-gray-900">{r.employeeName || '—'}</span>
                      </div>
                    ),
                  },
                  { key: 'callType', label: 'Type', searchable: false, width: 120, render: (r) => <CallBadge type={r.callType} /> },
                  { key: 'duration', label: 'Duration', align: 'right', searchable: false, width: 100, render: (r) => dur(r.duration) },
                  { key: 'callStatus', label: 'Call Status', align: 'right', searchable: false, width: 130, render: (r) => r.callStatus || '—' },
                  { key: 'notes', label: 'Notes', searchable: false, width: 180, render: (r) => r.notes || '—' },
                  {
                    key: 'isConnected', label: 'Connected', searchable: false, width: 120,
                    render: (r) => (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${r.isConnected || r.duration > 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-50 text-gray-400 border border-gray-200'}`}>
                        {r.isConnected || r.duration > 0 ? '✓ Yes' : '✗ No'}
                      </span>
                    ),
                  },
                ]}
                rows={result.calls.map((c, i) => ({ ...c, id: c._id || i, avatarHue: (i * 137) % 360 }))}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ClientReportPage;