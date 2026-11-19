'use client';
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../../../lib/api';
import { getAllEmployeesSafe } from '../../../../lib/employees';
import { triggerLocalExport } from '../../../../lib/downloads';
import { fmtDateTime } from '../../../../lib/timezone';
import { motion, AnimatePresence } from 'framer-motion';
import { DataTable, CallBadge, PageHeader } from '../../../../components/report-shared';
import MultiSelect from '../../../../components/MultiSelect';

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
const CALL_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'incoming', label: 'Incoming' },
  { value: 'outgoing', label: 'Outgoing' },
  { value: 'missed', label: 'Missed' },
  { value: 'rejected', label: 'Rejected' },
];

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
      <p className="mb-1.5 font-medium text-gray-500">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mt-1">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: p.color || p.fill || '#7C3AED' }}
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
    getAllEmployeesSafe(api).then(setEmployees).catch(() => {});
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

  const unsyncedColumns = [
    { key: 'employeeName', label: 'Agent', width: '20%', render: (c) => <span className="font-medium text-ink truncate block">{c.employeeName || '—'}</span> },
    {
      key: 'contactNumber', label: 'Contact', width: '24%',
      render: (c) => (
        <span className="block min-w-0">
          <span className="block tabular-nums text-ink">{c.contactNumber || '—'}</span>
          {c.contactName && c.contactName !== 'Unknown' && <span className="block text-xs text-ink-3 truncate">{c.contactName}</span>}
        </span>
      ),
    },
    { key: 'callType', label: 'Type', width: '14%', render: (c) => <CallBadge type={c.callType} /> },
    { key: 'duration', label: 'Duration', align: 'right', width: '10%', render: (c) => <span className="tabular-nums">{dur(c.duration)}</span> },
    { key: 'timestamp', label: 'When', width: '18%', render: (c) => <span className="tabular-nums whitespace-nowrap">{fmt(c.timestamp)}</span> },
    {
      key: 'action', label: '', align: 'right', width: '14%', sortable: false, searchable: false,
      render: (c) => (
        <button
          onClick={() => {
            setCreating(c);
            setForm({ name: c.contactName !== 'Unknown' ? c.contactName || '' : '', email: '', assignedTo: '' });
            setFormErr('');
          }}
          className="btn-secondary btn-sm"
        >
          <LeadPlusIco s={13} /> Create lead
        </button>
      ),
    },
  ];

  const confirmCreatePage = () => {
    if (!calls.length) return;
    if (window.confirm(`Create a lead for each of the ${calls.length} calls on this page?`)) createAllLeads();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Not synced"
        description={loading && !total ? 'Loading…' : `${total.toLocaleString('en-IN')} calls whose number doesn’t match any lead yet`}
        actions={
          <>
            <button onClick={exportList} className="btn-secondary" disabled={!calls.length}>Export this page</button>
            <button onClick={load} className="btn-secondary btn-icon" aria-label="Refresh" title="Refresh"><RefreshIco s={14} /></button>
          </>
        }
      />

      <p className="text-[13px] text-ink-2 -mt-2 max-w-3xl">
        These calls were made or received, but no lead has this phone number. Create a lead from a call to link it — future calls to that number then link automatically.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none"><SearchIco s={14} /></span>
          <input className="form-input pl-9" placeholder="Search number or agent" aria-label="Search calls"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="seg" role="group" aria-label="Call type">
          {CALL_TYPES.map((t) => (
            <button key={t.value || 'all'} aria-pressed={callType === t.value} onClick={() => { setCallType(t.value); setPage(1); }}>
              {t.value ? t.label : 'All'}
            </button>
          ))}
        </div>
        {calls.length > 0 && (
          <button onClick={confirmCreatePage} disabled={bulkCreating} className="btn-primary ml-auto">
            <LeadPlusIco s={14} /> {bulkCreating ? 'Creating…' : `Create leads for this page (${calls.length})`}
          </button>
        )}
      </div>

      <DataTable
        serverMode
        searchable={false}
        columns={unsyncedColumns}
        rows={calls}
        loading={loading}
        page={page}
        pageSize={PER_PAGE}
        totalPages={Math.max(1, totalPages)}
        totalCount={total}
        onPageChange={setPage}
        getRowId={(c) => c._id}
        emptyTitle={search || callType ? 'No unsynced calls match' : 'Every call is linked to a lead'}
        emptyHint={search || callType ? 'Clear the search or type filter.' : 'Nothing to do here.'}
      />

      {/* Create Lead Modal */}
        <AnimatePresence>
          {creating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(26,23,38,0.45)]"
              onClick={() => setCreating(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="w-full max-w-md bg-white rounded-xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Create Lead from Call</h3>
                    <p className="text-sm text-gray-500 mt-0.5 tabular-nums">
                      {creating.contactNumber}
                    </p>
                  </div>
                  <button
                    onClick={() => setCreating(null)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors duration-200"
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
                    <label className="form-label">
                      Full Name *
                    </label>
                    <input
                      className="form-input"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div>
                    <label className="form-label">
                      Email (optional)
                    </label>
                    <input
                      type="email"
                      className="form-input"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div>
                    <label className="form-label">
                      Assign To
                    </label>
                    <MultiSelect multiple={false} placeholder="Unassigned" ariaLabel="Assign to"
                      value={form.assignedTo} onChange={(v) => setForm({ ...form, assignedTo: v })}
                      options={employees.map((e) => [e._id, e.name])} />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setCreating(null)}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createLead}
                      className="btn-primary flex-1"
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
  );
}
