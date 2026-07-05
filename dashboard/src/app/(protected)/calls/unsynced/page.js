'use client';
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../../../lib/api';
import { triggerLocalExport } from '../../../../lib/downloads';
import { fmtDateTime } from '../../../../lib/timezone';
import { motion, AnimatePresence } from 'framer-motion';

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

const AlertIco = ({ s = 16 }) => (
  <Ico size={s}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </Ico>
);
const PhoneIco = ({ s = 16 }) => (
  <Ico size={s}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </Ico>
);
const RefreshIco = ({ s = 14 }) => (
  <Ico size={s}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </Ico>
);
const SearchIco = ({ s = 14 }) => (
  <Ico size={s}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </Ico>
);
const LeadPlusIco = ({ s = 13 }) => (
  <Ico size={s}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
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
const ClockIco = () => (
  <Ico>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Ico>
);
const FilterIco = () => (
  <Ico>
    <polygon points="22 3 2 3 10 13 10 21 14 18 14 13 22 3" />
  </Ico>
);
const CloseIco = () => (
  <Ico size={16}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Ico>
);
const ArrowLeftIco = () => (
  <Ico size={14}>
    <polyline points="15 18 9 12 15 6" />
  </Ico>
);
const ArrowRightIco = () => (
  <Ico size={14}>
    <polyline points="9 6 15 12 9 18" />
  </Ico>
);

const CALL_TYPE_STYLES = {
  incoming: { bg: 'rgba(34,197,94,0.10)', color: '#16A34A', border: '#BBF7D0', label: 'Incoming', icon: '📥' },
  outgoing: { bg: 'rgba(245,158,11,0.10)', color: '#D97706', border: '#FDE68A', label: 'Outgoing', icon: '📤' },
  missed: { bg: 'rgba(239,68,68,0.10)', color: '#DC2626', border: '#FECACA', label: 'Missed', icon: '❌' },
  rejected: { bg: 'rgba(139,92,246,0.10)', color: '#7C3AED', border: '#DDD6FE', label: 'Rejected', icon: '🚫' },
};

const CALL_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'incoming', label: 'Incoming' },
  { value: 'outgoing', label: 'Outgoing' },
  { value: 'missed', label: 'Missed' },
  { value: 'rejected', label: 'Rejected' },
];

function TypeBadge({ type }) {
  const s =
    CALL_TYPE_STYLES[type?.toLowerCase()] || {
      bg: '#F1F5F9',
      color: '#64748B',
      border: '#CBD5E1',
      label: type || '—',
      icon: '📞',
    };
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {s.icon} {s.label}
    </span>
  );
}

const fmt = fmtDateTime;

function dur(s) {
  if (!s) return '—';
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

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

export default function UnsyncedCallsPage() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [callType, setCallType] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [creating, setCreating] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', assignedTo: '' });
  const [formErr, setFormErr] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [bulkCreating, setBulkCreating] = useState(false);

  const PER_PAGE = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/calls', {
        params: {
          unsynced: true,
          callType: callType || undefined,
          search: search || undefined,
          page,
          limit: PER_PAGE,
        },
      });
      setCalls(r.data.data?.calls || r.data.data || []);
      setTotal(r.data.data?.total || 0);
    } catch {
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, [search, callType, page]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    api
      .get('/api/employees')
      .then((r) => setEmployees(r.data.data || []))
      .catch(() => {});
  }, []);

  const createLead = async () => {
    if (!creating) return;
    setFormErr('');
    try {
      await api.post('/api/leads/from-call', {
        ...form,
        callId: creating._id,
        phone: creating.contactNumber,
        source: 'Call',
      });
      setCreating(null);
      load();
    } catch (e) {
      setFormErr(e.response?.data?.error || 'Failed to create lead');
    }
  };

  const createAllLeads = async () => {
    if (bulkCreating || calls.length === 0) return;
    setBulkCreating(true);
    let created = 0, failed = 0;
    for (const call of calls) {
      if (!call.contactNumber) { failed++; continue; }
      try {
        await api.post('/api/leads/from-call', {
          callId: call._id,
          phone: call.contactNumber,
          name: call.contactName && call.contactName !== 'Unknown' ? call.contactName : undefined,
          source: 'Call',
        });
        created++;
      } catch {
        failed++;
      }
    }
    setBulkCreating(false);
    toast.success(`${created} lead${created === 1 ? '' : 's'} created${failed ? `, ${failed} failed` : ''}`);
    load();
  };

  const exportList = () => {
    const rows = [
      ['Employee', 'Contact', 'Type', 'Duration', 'Date'],
      ...calls.map((c) => [c.employeeName || '', c.contactNumber || '', c.callType || '', dur(c.duration), fmtDateTime(c.timestamp)]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    triggerLocalExport({ label: 'Unsynced Calls', filename: 'unsynced-calls.csv', csv });
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  // Calculate stats
  const typeCounts = calls.reduce((acc, call) => {
    const type = call.callType?.toLowerCase() || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen ">
      <div className="max-w-7xl mx-auto space-y-6 lg:space-y-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white flex items-center justify-center">
                  <AlertIco s={16} />
                </span>
                Unsynced Calls
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Calls with no matching lead record in the database
              </p>
            </div>
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors duration-200"
            >
              <RefreshIco s={13} />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* Stats Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl p-6 border border-red-100"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center">
                <PhoneIco s={24} />
              </div>
              <div>
                <p className="text-3xl font-extrabold text-red-600 tabular-nums tracking-tight">
                  {total}
                </p>
                <p className="text-xs font-medium text-gray-500 mt-0.5">Total unsynced calls</p>
              </div>
            </div>
            <div className="flex-1">
              <div className="text-sm bg-white/60 backdrop-blur-sm rounded-xl px-4 py-3 text-gray-700 border border-red-100">
                <span className="font-semibold text-red-600">⚠️ Action Required:</span>{' '}
                These calls were made/received but the contact number doesn't match any lead in the system.
                <span className="block text-xs text-gray-500 mt-1">
                  💡 Create leads from these calls to sync them with your database.
                </span>
              </div>
            </div>
            {Object.keys(typeCounts).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(typeCounts).map(([type, count]) => {
                  const style = CALL_TYPE_STYLES[type];
                  if (!style) return null;
                  return (
                    <span
                      key={type}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: style.bg, color: style.color }}
                    >
                      {style.icon} {style.label}: {count}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <SearchIco s={14} />
              </span>
              <input
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 outline-none text-sm"
                placeholder="Search by contact number or employee name…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex gap-3">
              <div className="relative">
                <select
                  className="appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 outline-none text-sm bg-white min-w-[140px]"
                  value={callType}
                  onChange={(e) => {
                    setCallType(e.target.value);
                    setPage(1);
                  }}
                >
                  {CALL_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <FilterIco />
                </span>
              </div>
              <button
                onClick={() => {
                  setSearch('');
                  setCallType('');
                  setPage(1);
                }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors duration-200 text-sm font-medium"
              >
                Clear
              </button>
            </div>
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Unsynced Call Records</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {total} records found
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-red-500" />
                {loading ? 'Loading…' : 'Ready'}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="skeleton w-8 h-8 rounded-xl" />
                          <div className="skeleton h-4 w-20 rounded" />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="skeleton h-4 w-32 rounded" />
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="skeleton h-6 w-20 rounded-full" />
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        <div className="skeleton h-4 w-16 rounded" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="skeleton h-4 w-24 rounded" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="skeleton h-8 w-24 rounded-lg" />
                      </td>
                    </tr>
                  ))
                ) : calls.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="flex flex-col items-center py-16 gap-4">
                        <div className="w-20 h-20 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
                          <CheckIco />
                        </div>
                        <p className="font-bold text-lg text-gray-900">All calls are synced! 🎉</p>
                        <p className="text-sm text-gray-500 max-w-sm text-center">
                          No unsynced calls found. All call records have matching leads in the database.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence>
                    {calls.map((c, i) => (
                      <motion.tr
                        key={c._id || i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="hover:bg-gray-50/50 transition-colors duration-150"
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm"
                              style={{ background: '#2563EB' }}
                            >
                              {(c.employeeName || '?')[0].toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                              {c.employeeName || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div>
                            <span className="font-mono text-sm font-semibold text-gray-900">
                              {c.contactNumber || '—'}
                            </span>
                            {c.contactName && c.contactName !== 'Unknown' && (
                              <p className="text-xs text-gray-500 mt-0.5">{c.contactName}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 hidden md:table-cell">
                          <TypeBadge type={c.callType} />
                        </td>
                        <td className="px-6 py-3 hidden lg:table-cell">
                          <span className="text-sm text-gray-700 tabular-nums">
                            {dur(c.duration)}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <span className="text-sm text-gray-600 whitespace-nowrap">
                            {fmt(c.timestamp)}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <button
                            onClick={() => {
                              setCreating(c);
                              setForm({
                                name: c.contactName !== 'Unknown' ? c.contactName || '' : '',
                                email: '',
                                assignedTo: '',
                              });
                              setFormErr('');
                            }}
                            className="group flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white hover:border-blue-600"
                          >
                            <LeadPlusIco s={12} />
                            Create Lead
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span className="text-sm text-gray-500">
                Showing {((page - 1) * PER_PAGE) + 1} to {Math.min(page * PER_PAGE, total)} of {total} records
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  <ArrowLeftIco />
                  Previous
                </button>
                <span className="text-sm font-medium text-gray-700 px-3 py-1.5">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Next
                  <ArrowRightIco />
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        {calls.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <h4 className="text-sm font-bold text-gray-900 mb-3">Quick Actions</h4>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={createAllLeads}
                disabled={bulkCreating}
                className="px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200 text-sm font-medium flex items-center gap-2 disabled:opacity-60"
              >
                <LeadPlusIco s={14} />
                {bulkCreating ? 'Creating…' : 'Create All Leads'}
              </button>
              <button
                onClick={exportList}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors duration-200 text-sm font-medium"
              >
                📥 Export List
              </button>
            </div>
          </motion.div>
        )}

        {/* Create Lead Modal */}
        <AnimatePresence>
          {creating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
              onClick={() => setCreating(null)}
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
                    <h3 className="text-lg font-bold text-gray-900">Create Lead from Call</h3>
                    <p className="text-sm text-gray-500 mt-0.5 font-mono">
                      {creating.contactNumber}
                    </p>
                  </div>
                  <button
                    onClick={() => setCreating(null)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors duration-200"
                  >
                    <CloseIco />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  {formErr && (
                    <div className="text-sm bg-red-50 text-red-600 rounded-xl px-4 py-3 border border-red-100">
                      {formErr}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Full Name *
                    </label>
                    <input
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 outline-none text-gray-900"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Email (optional)
                    </label>
                    <input
                      type="email"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 outline-none text-gray-900"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Assign To
                    </label>
                    <select
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 outline-none text-gray-900"
                      value={form.assignedTo}
                      onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
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
                      onClick={() => setCreating(null)}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors duration-200 font-medium text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createLead}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Create Lead
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}