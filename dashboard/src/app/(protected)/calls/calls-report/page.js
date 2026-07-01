'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, ComposedChart, Line, Area,
} from 'recharts';
import api from '../../../../lib/api';
import { utcHourToISTLabel } from '../../../../lib/timezone';
import { motion, AnimatePresence } from 'framer-motion';

/* ────────────────────────────────────────────────────────────
   ICONS
──────────────────────────────────────────────────────────── */
const Ico = ({ size = 16, children, className = '', fill = 'none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {children}
  </svg>
);
const CalendarIco = () => <Ico size={14}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></Ico>;
const PhoneIco = ({ s = 14 }) => <Ico size={s}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></Ico>;
const CheckIco = () => <Ico size={14}><polyline points="20 6 9 17 4 12" /></Ico>;
const XIco = () => <Ico size={12}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Ico>;
const ClockIco = () => <Ico size={14}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></Ico>;
const UsersIco = () => <Ico size={14}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Ico>;
const DownloadIco = () => <Ico size={14}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></Ico>;
const RefreshIco = ({ spinning }) => <Ico size={14} className={spinning ? 'animate-spin' : ''}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></Ico>;
const ChevronIco = ({ open }) => <Ico size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9" /></Ico>;
const SearchIco = () => <Ico size={13}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Ico>;
const ArrowUpIco = () => <Ico size={12}><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></Ico>;
const ArrowDownIco = () => <Ico size={12}><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></Ico>;
const InboxIco = () => <Ico size={32}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></Ico>;

/* Tab-specific icons */
const BarChartTabIco = () => (
  <Ico size={15} className="text-blue-500">
    <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
  </Ico>
);
const CalendarTabIco = () => (
  <Ico size={15} className="text-amber-500">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </Ico>
);
const ClockTabIco = () => <Ico size={15} className="text-sky-500"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></Ico>;
const NoEntryIco = () => <Ico size={15} className="text-red-500"><circle cx="12" cy="12" r="9" /><line x1="6" y1="6" x2="18" y2="18" /></Ico>;
const PhoneTabIco = () => (
  <Ico size={15} className="text-rose-500">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  </Ico>
);
const PersonTabIco = () => <Ico size={15} className="text-gray-700"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a7 7 0 0 1 14 0v1" /></Ico>;
const ClipboardIco = () => (
  <Ico size={15} className="text-gray-700">
    <rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" /><line x1="9" y1="10" x2="15" y2="10" /><line x1="9" y1="14" x2="15" y2="14" />
  </Ico>
);
const GridIco = () => (
  <Ico size={15} className="text-indigo-500">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </Ico>
);

/* Extra icons for content-specific components */
const PinIco = ({ filled }) => (
  <Ico size={13} className={filled ? 'text-amber-500' : 'text-gray-300'} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 17v5M9 3h6l-1 6 4 4H8l4-4-1-6z" />
  </Ico>
);
const DotsIco = () => <Ico size={14}><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></Ico>;
const PlusIco = () => <Ico size={12}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Ico>;
const TrophyIco = () => <Ico size={16} className="text-amber-500"><path d="M6 9H4a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1h3M18 9h2a2 2 0 0 0 2-2V5a1 1 0 0 0-1-1h-3M6 4h12v6a6 6 0 0 1-12 0V4z" /><path d="M12 15v3M8 21h8" /></Ico>;
const StopwatchIco = () => <Ico size={16} className="text-blue-500"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9 2h6" /></Ico>;
const GaugeIco = () => <Ico size={16} className="text-emerald-500"><path d="M12 15a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM4.93 19.07A10 10 0 1 1 19.07 19.07" /><path d="M12 13l3.5-3.5" /></Ico>;

/* ────────────────────────────────────────────────────────────
   CONSTANTS
──────────────────────────────────────────────────────────── */
const TYPE_META = {
  incoming: { label: 'Incoming', color: '#16A34A', bg: '#F0FDF4' },
  outgoing: { label: 'Outgoing', color: '#D97706', bg: '#FFFBEB' },
  missed: { label: 'Missed', color: '#DC2626', bg: '#FEF2F2' },
  rejected: { label: 'Rejected', color: '#7C3AED', bg: '#F5F3FF' },
};
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TABS = [
  { key: 'summary', label: 'Summary', icon: <GridIco /> },
  { key: 'analysis', label: 'Analysis', icon: <BarChartTabIco /> },
  { key: 'dayWise', label: 'Day-wise Analysis', icon: <CalendarTabIco /> },
  { key: 'hourly', label: 'Hourly Analysis', icon: <ClockTabIco /> },
  { key: 'neverAttended', label: 'Never Attended', icon: <NoEntryIco />, hint: 'Calls that were never returned, even after being missed.' },
  { key: 'notPickup', label: 'Not Pickup by Client', icon: <PhoneTabIco />, hint: 'Outgoing calls the client never answered.' },
  { key: 'uniqueClients', label: 'Unique Clients', icon: <PersonTabIco />, hint: 'One row per distinct phone number contacted.' },
  { key: 'callHistory', label: 'Call History', icon: <ClipboardIco /> },
];

/* ────────────────────────────────────────────────────────────
   SMALL UI PRIMITIVES
──────────────────────────────────────────────────────────── */
function CallBadge({ type }) {
  const m = TYPE_META[type] || TYPE_META.outgoing;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium" style={{ color: m.color, background: m.bg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

function InfoDot({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex ml-1 cursor-help" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 text-[9px] font-bold flex items-center justify-center">i</span>
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute z-20 left-1/2 -translate-x-1/2 top-6 w-56 bg-gray-900 text-white text-[11px] leading-snug rounded-lg px-3 py-2 shadow-xl"
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
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

function StatCard({ label, value, sub, color, icon, delta }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="relative bg-white rounded-xl border border-gray-200 p-4 overflow-hidden group hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-[0.06] group-hover:opacity-[0.1] transition-opacity" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}14`, color }}>
          {icon}
        </div>
        {delta != null && (
          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${delta >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-3 tabular-nums">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </motion.div>
  );
}

function Skeleton({ className = '' }) {
  return <div className={`bg-gray-100 rounded animate-pulse ${className}`} />;
}

function EmptyState({ title = 'No records found', hint = 'Try widening your date range or clearing filters.' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <InboxIco />
      <p className="mt-3 text-sm font-medium text-gray-600">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{hint}</p>
    </div>
  );
}

/* Pin toggle used in Call History "To Number" column */
function PinnedNumber({ number }) {
  const [pinned, setPinned] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-amber-600 font-medium">{number}</span>
      <button type="button" onClick={() => setPinned((p) => !p)} title={pinned ? 'Unpin' : 'Pin this number'}>
        <PinIco filled={pinned} />
      </button>
    </div>
  );
}

/* Inline note editor used in Call History "Notes" column */
function NoteCell({ initial }) {
  const [note, setNote] = useState(initial || '');
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        autoFocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
        className="text-xs border border-blue-300 rounded-md px-2 py-1 outline-none w-32"
      />
    );
  }
  return note ? (
    <div className="flex items-center gap-1.5 justify-between">
      <span className="text-xs text-gray-600">{note}</span>
      <button type="button" onClick={() => setEditing(true)}><DotsIco /></button>
    </div>
  ) : (
    <button type="button" onClick={() => setEditing(true)} className="text-xs text-blue-600 font-medium flex items-center gap-1 hover:underline">
      <PlusIco /> Add Note
    </button>
  );
}

/* Highlight card used in Analysis tab */
function InsightCard({ icon, title, rows }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h4 className="text-sm font-bold text-gray-900">{title}</h4>
      </div>
      <div className="space-y-4">
        {rows.map((r, i) => (
          <div key={i} className={i > 0 ? 'pt-3 border-t border-gray-100' : ''}>
            <p className="text-xs text-gray-400">{r.label}</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{r.value}</p>
            {r.sub && <p className="text-xs text-gray-500 mt-0.5">{r.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Floating "new logs" banner used in Call History */
function LiveBanner({ count, label = 'New Call Logs Available', onRefresh }) {
  if (!count) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center">
      <button
        onClick={onRefresh}
        className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-amber-100 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        {`{${count}} ${label}`}
      </button>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────
   GENERIC DATA TABLE — search per column, sort, pagination
──────────────────────────────────────────────────────────── */
function DataTable({ columns, rows, loading, pageSize = 5, searchable = true, emptyTitle }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [colSearch, setColSearch] = useState({});
  const [page, setPage] = useState(1);
  const [rpp, setRpp] = useState(pageSize);

  const filtered = useMemo(() => {
    let r = rows;
    Object.entries(colSearch).forEach(([key, val]) => {
      if (!val) return;
      r = r.filter((row) => String(row[key] ?? '').toLowerCase().includes(val.toLowerCase()));
    });
    if (sortKey) {
      r = [...r].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return r;
  }, [rows, colSearch, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rpp));
  const pageRows = filtered.slice((page - 1) * rpp, page * rpp);

  useEffect(() => setPage(1), [colSearch, rpp, rows]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between px-1 pb-3">
        <span className="text-xs text-gray-500">
          {filtered.length === 0 ? '0' : `${(page - 1) * rpp + 1}-${Math.min(page * rpp, filtered.length)}`} of {filtered.length}
        </span>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          Show
          <select value={rpp} onChange={(e) => setRpp(Number(e.target.value))} className="border border-gray-200 rounded-md px-2 py-1 text-xs outline-none focus:border-blue-400">
            {[5, 10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50/80 sticky top-0">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                  <button
                    onClick={() => c.sortable !== false && toggleSort(c.key)}
                    className={`inline-flex items-center gap-1 ${c.sortable !== false ? 'hover:text-gray-800 cursor-pointer' : 'cursor-default'}`}
                  >
                    {c.label}
                    {sortKey === c.key && (sortDir === 'asc' ? <ArrowUpIco /> : <ArrowDownIco />)}
                  </button>
                </th>
              ))}
            </tr>
            {searchable && (
              <tr className="bg-white">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-2 border-t border-gray-100">
                    {c.searchable !== false ? (
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300"><SearchIco /></span>
                        <input
                          placeholder="Search"
                          className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md border border-gray-200 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                          value={colSearch[c.key] || ''}
                          onChange={(e) => setColSearch((s) => ({ ...s, [c.key]: e.target.value }))}
                        />
                      </div>
                    ) : null}
                  </td>
                ))}
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: rpp }).map((_, i) => (
                <tr key={i}>
                  {columns.map((c, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full max-w-[120px]" /></td>
                  ))}
                </tr>
              ))
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={columns.length}><EmptyState title={emptyTitle} /></td></tr>
            ) : (
              pageRows.map((row, i) => (
                <motion.tr
                  key={row.id ?? i}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.2) }}
                  className="hover:bg-blue-50/30 transition-colors"
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 whitespace-nowrap ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-md border border-gray-200 text-xs font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors">
              Prev
            </button>
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-md border border-gray-200 text-xs font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   FILTER CHIP BAR
──────────────────────────────────────────────────────────── */
function ActiveFilterChips({ filters, onClear, onClearAll }) {
  const entries = Object.entries(filters).filter(([k, v]) => {
    if (k === 'excludeDays') return v.length > 0;
    if (k === 'businessHours') return false;
    if (k === 'excludeNumbers') return false;
    return !!v;
  });
  if (entries.length === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {entries.map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-full">
          {Array.isArray(v) ? `${k}: ${v.length}` : `${k}: ${v}`}
          <button onClick={() => onClear(k)} className="hover:bg-blue-100 rounded-full p-0.5"><XIco /></button>
        </span>
      ))}
      <button onClick={onClearAll} className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
        Clear all
      </button>
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

/* ────────────────────────────────────────────────────────────
   MAIN PAGE
──────────────────────────────────────────────────────────── */
export default function PeriodicReportsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState(null);
  const [calls, setCalls] = useState([]);
  const [activeTab, setActiveTab] = useState('summary');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [chartMode, setChartMode] = useState('composed');

  const [filters, setFilters] = useState({
    fromDate: '', toDate: '', employeeTags: '', employee: '', callType: '',
    callMethod: '', duration: '', callTime: '',
    excludeNumbers: true,
    businessHours: { start: '08:30', end: '19:00' },
    excludeDays: [],
  });

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const params = {
        ...(filters.fromDate && { fromDate: filters.fromDate }),
        ...(filters.toDate && { toDate: filters.toDate }),
        ...(filters.callType && { callType: filters.callType }),
        ...(filters.employee && { employee: filters.employee }),
      };
      const [callsRes, statsRes] = await Promise.allSettled([
        api.get('/api/calls', { params }),
        api.get('/api/calls/stats'),
      ]);
      if (callsRes.status === 'fulfilled') {
        setCalls(callsRes.value.data?.data?.calls || callsRes.value.data?.data || []);
      }
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data?.data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/api/employees').then((r) => setEmployees(r.data.data || [])).catch(() => {});
  }, []);

  const today = stats?.today;
  const pieData = today
    ? [
        { name: 'Incoming', value: today.incoming || 0, color: TYPE_META.incoming.color },
        { name: 'Outgoing', value: today.outgoing || 0, color: TYPE_META.outgoing.color },
        { name: 'Missed', value: today.missed || 0, color: TYPE_META.missed.color },
        { name: 'Rejected', value: today.rejected || 0, color: TYPE_META.rejected.color },
      ].filter((d) => d.value > 0)
    : [
        { name: 'Incoming', value: 401, color: TYPE_META.incoming.color },
        { name: 'Outgoing', value: 4424, color: TYPE_META.outgoing.color },
        { name: 'Missed', value: 229, color: TYPE_META.missed.color },
        { name: 'Rejected', value: 23, color: TYPE_META.rejected.color },
      ];

  const hourlyData = (stats?.callsPerHour || []).map((h) => ({
    hour: utcHourToISTLabel(h.hour),
    calls: h.count,
    connected: h.connected ?? Math.round(h.count * 0.42),
  }));

  // ── mock/derivable datasets for tabs not yet wired to API ──
  const dayWiseRows = [
    { id: 1, day: 'Monday, 29-Jun-2026', total: 7408, connected: 3139, duration: '65:46:12' },
    { id: 2, day: 'Tuesday, 30-Jun-2026', total: 7232, connected: 3093, duration: '63:58:39' },
  ];
  const hourlySlotRows = [
    { id: 1, slot: 'Before 08:30 AM', total: 99, connected: 29, duration: '00:30:57', pct: 0.68 },
    { id: 2, slot: '08:30 – 08:59 AM', total: 56, connected: 21, duration: '00:19:54', pct: 0.38 },
    { id: 3, slot: '09:00 – 09:59 AM', total: 715, connected: 240, duration: '04:00:03', pct: 4.88 },
    { id: 4, slot: '10:00 – 10:59 AM', total: 2261, connected: 994, duration: '18:30:39', pct: 15.44 },
    { id: 5, slot: '11:00 – 11:59 AM', total: 2039, connected: 910, duration: '18:18:09', pct: 13.93 },
    { id: 6, slot: '12:00 – 12:59 PM', total: 1837, connected: 805, duration: '17:43:55', pct: 12.55 },
  ];
  const employeeSummaryRows = [
    { id: 1, employee: 'Aachal (Team Himanshu)', total: 77, connected: 28, duration: '0h 27m 8s', connDuration: '0h 27m 5s', unique: 70 },
    { id: 2, employee: 'Aarti salal (TL Muskan)', total: 0, connected: 0, duration: '0h 0m 0s', connDuration: '0h 0m 0s', unique: 0 },
    { id: 3, employee: 'Ai sensy', total: 2, connected: 1, duration: '0h 0m 18s', connDuration: '0h 0m 17s', unique: 1 },
    { id: 4, employee: 'Alisha (Team Bharat)', total: 24, connected: 13, duration: '0h 25m 41s', connDuration: '0h 25m 41s', unique: 22 },
    { id: 5, employee: 'AMIT THAPA (TL Bharat)', total: 54, connected: 23, duration: '0h 35m 31s', connDuration: '0h 35m 31s', unique: 41 },
  ];
  const neverAttendedRows = [
    { id: 1, employee: 'Nitika (Team Himanshu)', number: '+91-7037101112', type: 'rejected', date: '01 Jul 2026', time: '03:02 PM', note: '', attempts: 1, after: 'Not Attempted' },
    { id: 2, employee: 'Neha Mandal', number: '+91-9340288043', type: 'missed', date: '01 Jul 2026', time: '02:47 PM', note: '', attempts: 2, after: '1 Time' },
    { id: 3, employee: 'Nitika (Team Himanshu)', number: '+91-8686270016', type: 'missed', date: '01 Jul 2026', time: '02:46 PM', note: 'Miss', attempts: 2, after: '1 Time' },
    { id: 4, employee: 'Rajesh (TL Himanshu)', number: '+91-6397855811', type: 'missed', date: '01 Jul 2026', time: '02:42 PM', note: '', attempts: 1, after: 'Not Attempted' },
    { id: 5, employee: 'HARSHITA SHARMA (TL Rahul)', number: '+91-9643270722', type: 'missed', date: '01 Jul 2026', time: '02:41 PM', note: 'Miss call', attempts: 2, after: '1 Time' },
  ];
  const notPickupRows = [
    { id: 1, employee: 'Devraj (TL Bharat)', number: '+91-6572307028', type: 'outgoing', date: '01 Jul 2026', time: '03:04 PM' },
    { id: 2, employee: 'kumkum (Team Himanshu)', number: '+91-9606865219', type: 'outgoing', date: '01 Jul 2026', time: '03:04 PM' },
    { id: 3, employee: 'Neha Mandal', number: '+91-9098946935', type: 'outgoing', date: '01 Jul 2026', time: '03:04 PM' },
    { id: 4, employee: 'Devraj (TL Bharat)', number: '+91-6576138427', type: 'outgoing', date: '01 Jul 2026', time: '03:04 PM' },
    { id: 5, employee: 'Devraj (TL Bharat)', number: '+91-6582361056', type: 'outgoing', date: '01 Jul 2026', time: '03:03 PM' },
  ];
  const uniqueClientRows = [
    { id: 1, client: 'Aniket Pt Up', number: '+91-7827241534', total: 74, incoming: 22, outgoing: 6, missed: 40, connected: 22, lastCall: 'MANSI (TL Himanshu) — 01 Jul, 02:45 PM · 0h 5m 7s' },
    { id: 2, client: 'Pammi', number: '+91-8588991070', total: 39, incoming: 12, outgoing: 12, missed: 15, connected: 22, lastCall: 'vidit saini muskan mam — 01 Jul, 12:41 PM · 0h 1m 16s' },
    { id: 3, client: 'Ajay Shivangi pt', number: '+91-9643602xxx', total: 33, incoming: 0, outgoing: 33, missed: 0, connected: 2, lastCall: 'Anjali Rana (TL Ashu) — 30 Jun, 03:47 PM' },
  ];
  const callHistoryRows = [
    { id: 1, employee: 'kanak (TL Bharat)', number: '+91-7400270887', date: '01 Jul 2026', time: '03:05 PM', duration: '-', type: 'missed', note: '' },
    { id: 2, employee: 'simran team muskan', number: '+91-8741003585', date: '01 Jul 2026', time: '03:05 PM', duration: '-', type: 'outgoing', note: '' },
    { id: 3, employee: 'Faiz team bharat', number: '+91-8448872486', date: '01 Jul 2026', time: '03:05 PM', duration: '-', type: 'missed', note: '' },
    { id: 4, employee: 'Nikhil Arora (Team Muskan)', number: '+91-8800910105', date: '01 Jul 2026', time: '03:05 PM', duration: '0h 0m 11s', type: 'outgoing', note: '' },
    { id: 5, employee: 'Sunita (Team Ashu)', number: '+91-8607090516', date: '01 Jul 2026', time: '03:05 PM', duration: '0h 0m 6s', type: 'outgoing', note: 'Voice mail' },
  ];

  const summaryTotals = {
    incoming: today?.incoming ?? 401,
    outgoing: today?.outgoing ?? 4424,
    missed: today?.missed ?? 229,
    rejected: today?.rejected ?? 23,
  };
  const grandTotal = Object.values(summaryTotals).reduce((a, b) => a + b, 0);

  const clearFilter = (key) => setFilters((f) => ({ ...f, [key]: key === 'excludeDays' ? [] : '' }));
  const clearAllFilters = () => setFilters((f) => ({ ...f, fromDate: '', toDate: '', employeeTags: '', employee: '', callType: '', callMethod: '', duration: '', callTime: '', excludeDays: [] }));

  return (
    <div className="min-h-screen">
      <div className=" space-y-5">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              Reports <span className="text-gray-300">/</span> <span className="text-gray-500">Periodic Reports</span>
            </p>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5">Ryan Skin & Hair Transplant Clinic</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => load(true)} className="flex items-center gap-2 px-3.5 py-2 border border-gray-200 bg-white text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
              <RefreshIco spinning={refreshing} /> Refresh
            </button>
            <button className="flex items-center gap-2 px-3.5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium shadow-sm">
              <DownloadIco /> Export
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <button onClick={() => setFiltersOpen((o) => !o)} className="w-full flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-800">Filters</span>
              <span className="text-xs text-gray-400">{filters.fromDate || 'Any date'} – {filters.toDate || 'today'}</span>
            </div>
            <ChevronIco open={filtersOpen} />
          </button>

          <AnimatePresence initial={false}>
            {filtersOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Field label="From Date">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><CalendarIco /></span>
                        <input type="datetime-local" className="input pl-9" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} />
                      </div>
                    </Field>
                    <Field label="To Date">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><CalendarIco /></span>
                        <input type="datetime-local" className="input pl-9" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} />
                      </div>
                    </Field>
                    <Field label="Employee Tag">
                      <select className="input" value={filters.employeeTags} onChange={(e) => setFilters({ ...filters, employeeTags: e.target.value })}>
                        <option value="">All tags</option>
                        <option value="team_himanshu">Team Himanshu</option>
                        <option value="team_bharat">Team Bharat</option>
                        <option value="team_muskan">Team Muskan</option>
                      </select>
                    </Field>
                    <Field label="Employee">
                      <select className="input" value={filters.employee} onChange={(e) => setFilters({ ...filters, employee: e.target.value })}>
                        <option value="">All employees</option>
                        {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Call Type">
                      <select className="input" value={filters.callType} onChange={(e) => setFilters({ ...filters, callType: e.target.value })}>
                        <option value="">All types</option>
                        <option value="incoming">Incoming</option>
                        <option value="outgoing">Outgoing</option>
                        <option value="missed">Missed</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </Field>
                    <Field label="Call Method">
                      <select className="input" value={filters.callMethod} onChange={(e) => setFilters({ ...filters, callMethod: e.target.value })}>
                        <option value="">All methods</option>
                        <option value="dialer">Dialer</option>
                        <option value="manual">Manual</option>
                      </select>
                    </Field>
                    <Field label="Duration">
                      <select className="input" value={filters.duration} onChange={(e) => setFilters({ ...filters, duration: e.target.value })}>
                        <option value="">Any duration</option>
                        <option value="0-60">0 – 60s</option>
                        <option value="60-300">60 – 300s</option>
                        <option value="300+">300s+</option>
                      </select>
                    </Field>
                    <Field label="Call Time">
                      <select className="input" value={filters.callTime} onChange={(e) => setFilters({ ...filters, callTime: e.target.value })}>
                        <option value="">Any time</option>
                        <option value="morning">Morning (6AM–12PM)</option>
                        <option value="afternoon">Afternoon (12PM–6PM)</option>
                        <option value="evening">Evening (6PM–12AM)</option>
                      </select>
                    </Field>
                  </div>

                  {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <Field label="Business Hours">
                      <div className="flex items-center gap-2">
                        <input type="time" className="input" value={filters.businessHours.start}
                          onChange={(e) => setFilters({ ...filters, businessHours: { ...filters.businessHours, start: e.target.value } })} />
                        <span className="text-gray-400 text-xs">to</span>
                        <input type="time" className="input" value={filters.businessHours.end}
                          onChange={(e) => setFilters({ ...filters, businessHours: { ...filters.businessHours, end: e.target.value } })} />
                      </div>
                    </Field>
                    <Field label="Exclude Days">
                      <div className="flex flex-wrap gap-1.5">
                        {DAYS.map((day) => {
                          const active = filters.excludeDays.includes(day);
                          return (
                            <button
                              key={day}
                              onClick={() => setFilters({
                                ...filters,
                                excludeDays: active ? filters.excludeDays.filter((d) => d !== day) : [...filters.excludeDays, day],
                              })}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                                active ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              {day.slice(0, 3)}{active && ' ×'}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                  </div> */}

                  <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-100">
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                      <input type="checkbox" checked={filters.excludeNumbers}
                        onChange={(e) => setFilters({ ...filters, excludeNumbers: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600" />
                      Exclude numbers in <span className="text-blue-600 underline underline-offset-2 cursor-pointer">exclude list</span>
                    </label>
                    <div className="flex gap-2 ml-auto">
                      <button onClick={clearAllFilters} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
                        Reset
                      </button>
                      <button onClick={() => load()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">
                        Apply Filters
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <ActiveFilterChips filters={filters} onClear={clearFilter} onClearAll={clearAllFilters} />

        {/* <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Calls" value={grandTotal.toLocaleString()} color="#2563EB" icon={<PhoneIco s={16} />} delta={12} sub="vs. previous period" />
          <StatCard label="Connected Calls" value={(stats?.connected ?? 2171).toLocaleString()} color="#16A34A" icon={<CheckIco />} delta={8} sub="47% connect rate" />
          <StatCard label="Unique Clients" value={(stats?.uniqueClients ?? 3585).toLocaleString()} color="#7C3AED" icon={<UsersIco />} delta={5} />
          <StatCard label="Working Hours" value={stats?.workingHours ?? '156h 21m'} color="#D97706" icon={<ClockIco />} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(summaryTotals).map(([k, v]) => {
            const m = TYPE_META[k];
            const pct = grandTotal ? ((v / grandTotal) * 100).toFixed(1) : 0;
            return (
              <div key={k} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <CallBadge type={k} />
                  <span className="text-[11px] text-gray-400">{pct}%</span>
                </div>
                <p className="text-lg font-bold text-gray-900 tabular-nums">{v.toLocaleString()}</p>
                <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: m.color }} />
                </div>
              </div>
            );
          })}
        </div> */}

        {/* ── Tab nav ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <div className="flex gap-1 px-4 py-3 overflow-hidden">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-2 py-3.5 text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                  activeTab === tab.key ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className={`flex items-center justify-center transition-transform ${activeTab === tab.key ? 'scale-110' : ''}`}>
                  {tab.icon}
                </span>
                {tab.label}
                {tab.hint && <InfoDot text={tab.hint} />}
                {activeTab === tab.key && (
                  <motion.span layoutId="tabUnderline" className="absolute left-3 right-3 -bottom-px h-[2.5px] bg-blue-600 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-5"
          >
            {/* ═══════════════ SUMMARY ═══════════════ */}
            {activeTab === 'summary' && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-1">Calls</h3>
                  <p className="text-xs text-gray-400 mb-3">Overall split by call type</p>
                  {loading ? <Skeleton className="h-56 w-full" /> : (
                    <div className="relative">
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={62} outerRadius={92} paddingAngle={4} dataKey="value">
                            {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                          </Pie>
                          <Tooltip content={<ChartTip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: -8 }}>
                        <p className="text-2xl font-bold text-gray-900">{grandTotal.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">Calls</p>
                      </div>
                      <div className="flex justify-center gap-4 mt-2 flex-wrap">
                        {pieData.map((d, i) => (
                          <span key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
                            <span className="w-2 h-2 rounded-full" style={{ background: d.color }} /> {d.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Call Type Breakdown</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 uppercase">
                        <th className="text-left pb-2">Call Type</th>
                        <th className="text-right pb-2">Calls</th>
                        <th className="text-right pb-2">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {Object.entries(summaryTotals).map(([k, v]) => (
                        <tr key={k}>
                          <td className="py-2.5"><CallBadge type={k} /></td>
                          <td className="py-2.5 text-right font-semibold text-gray-900">{v.toLocaleString()}</td>
                          <td className="py-2.5 text-right text-gray-500">{k === 'incoming' ? '8h 3m 35s' : k === 'outgoing' ? '35h 32m 42s' : '-'}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-gray-100">
                        <td className="py-2.5 font-bold text-gray-900">Total</td>
                        <td className="py-2.5 text-right font-bold text-gray-900">{grandTotal.toLocaleString()}</td>
                        <td className="py-2.5 text-right font-bold text-gray-900">43h 36m 17s</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
                    {[
                      { label: 'Never Attended', value: 104, color: '#DC2626' },
                      { label: 'Not Pickup by Client', value: 2020, color: '#EA580C' },
                      { label: 'Connected Calls', value: 2171, color: '#16A34A' },
                      { label: 'Unique Connected', value: 1729, color: '#0891B2' },
                      { label: 'Unique Clients', value: 3585, color: '#7C3AED' },
                      { label: 'Working Hours', value: '156h 21m', color: '#D97706' },
                    ].map((s, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-400">{s.label}</p>
                        <p className="text-sm font-bold mt-0.5" style={{ color: s.color }}>{s.value.toLocaleString?.() ?? s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-1">Employee Summary</h3>
                  <p className="text-xs text-gray-400 mb-3">Per-employee call performance</p>
                  <DataTable
                    loading={loading}
                    columns={[
                      { key: 'employee', label: 'Employee' },
                      { key: 'total', label: 'Total', align: 'right' },
                      { key: 'connected', label: 'Connected', align: 'right', render: (r) => <span className="text-emerald-600 font-semibold">{r.connected}</span> },
                      { key: 'duration', label: 'Duration', align: 'right', searchable: false },
                      { key: 'connDuration', label: 'Conn. Duration', align: 'right', searchable: false },
                      { key: 'unique', label: 'Unique Clients', align: 'right' },
                    ]}
                    rows={employeeSummaryRows}
                  />
                </div>
              </div>
            )}

            {/* ═══════════════ ANALYSIS ═══════════════ */}
            {activeTab === 'analysis' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Calls vs. Connected — Hourly</h3>
                      <p className="text-xs text-gray-400">Bars = total calls · Line = connected calls</p>
                    </div>
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                      {['composed', 'bar'].map((m) => (
                        <button key={m} onClick={() => setChartMode(m)}
                          className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${chartMode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  {loading ? <Skeleton className="h-72 w-full" /> : (
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={hourlyData}>
                        <defs>
                          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#2563EB" stopOpacity={0.25} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                        <XAxis dataKey="hour" tick={{ fill: '#94A3B8', fontSize: 10 }} tickLine={false} axisLine={false} interval={1} />
                        <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                        <Tooltip content={<ChartTip />} />
                        <Bar dataKey="calls" name="Total Calls" fill="url(#barGrad)" radius={[4, 4, 0, 0]} barSize={22} />
                        {chartMode === 'composed' && (
                          <Line type="monotone" dataKey="connected" name="Connected" stroke="#16A34A" strokeWidth={2} dot={{ r: 3, fill: '#16A34A' }} />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <InsightCard
                    icon={<TrophyIco />}
                    title="Mobile Call Analysis"
                    rows={[
                      { label: 'Top Dialer', value: 'Urvashi (TL Rahul)', sub: '194 dialed calls · +91-9540230819' },
                      { label: 'Top Answered', value: "What's app Leads", sub: '29 received calls · +91-8882356930' },
                      { label: 'Top Caller', value: 'Urvashi (TL Rahul)', sub: '200 total calls (In + Out)' },
                    ]}
                  />
                  <InsightCard
                    icon={<StopwatchIco />}
                    title="Total Call Duration Analysis"
                    rows={[
                      { label: 'Highest Total Duration', value: 'Faiz team bharat', sub: '1h 15m 20s · +91-8744816952' },
                      { label: 'Longest Single Call', value: '0h 28m 16s (Outgoing)', sub: 'To Unknown (+91-8758404863), 01 Jul 10:00 AM' },
                    ]}
                  />
                  <InsightCard
                    icon={<GaugeIco />}
                    title="Avg. Duration of Connected Calls"
                    rows={[
                      { label: 'Per Incoming Call', value: '0h 1m 15s', sub: '397 total calls' },
                      { label: 'Per Outgoing Call', value: '0h 1m 11s', sub: '1,868 total calls' },
                      { label: 'Per Day', value: '45h 28m 12s', sub: '1 business day' },
                    ]}
                  />
                </div>
              </div>
            )}

            {/* ═══════════════ DAY-WISE ═══════════════ */}
            {activeTab === 'dayWise' && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-gray-900">Business Days: {dayWiseRows.length}</h3>
                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                    {['line', 'bar'].map((m) => (
                      <button key={m} onClick={() => setChartMode(m)}
                        className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${chartMode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                        {m} chart
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-4">Daily totals within the selected date range</p>

                <DataTable
                  loading={loading}
                  searchable={false}
                  columns={[
                    { key: 'day', label: 'Day' },
                    { key: 'total', label: 'Total Calls', align: 'right' },
                    { key: 'connected', label: 'Connected', align: 'right', render: (r) => <span className="text-emerald-600 font-semibold">{r.connected}</span> },
                    { key: 'duration', label: 'Total Duration', align: 'right', searchable: false },
                  ]}
                  rows={dayWiseRows}
                />

                {!loading && (
                  <div className="mt-6">
                    <ResponsiveContainer width="100%" height={220}>
                      {chartMode === 'bar' ? (
                        <BarChart data={dayWiseRows.map((r) => ({ day: r.day.split(',')[0], total: r.total, connected: r.connected }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                          <XAxis dataKey="day" tick={{ fill: '#94A3B8', fontSize: 11 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                          <Tooltip content={<ChartTip />} />
                          <Bar dataKey="total" name="Total Calls" fill="#2563EB" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="connected" name="Connected" fill="#16A34A" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      ) : (
                        <ComposedChart data={dayWiseRows.map((r) => ({ day: r.day.split(',')[0], total: r.total, connected: r.connected }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                          <XAxis dataKey="day" tick={{ fill: '#94A3B8', fontSize: 11 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                          <Tooltip content={<ChartTip />} />
                          <Line type="monotone" dataKey="total" name="Total Calls" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="connected" name="Connected" stroke="#16A34A" strokeWidth={2} dot={{ r: 3 }} />
                        </ComposedChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════ HOURLY ═══════════════ */}
            {activeTab === 'hourly' && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-1">Hourly Time Slots</h3>
                <p className="text-xs text-gray-400 mb-4">Share of total call volume by hour</p>
                <DataTable
                  loading={loading}
                  searchable={false}
                  columns={[
                    { key: 'slot', label: 'Time Slot' },
                    { key: 'total', label: 'Total Calls', align: 'right' },
                    { key: 'connected', label: 'Connected', align: 'right' },
                    { key: 'duration', label: 'Duration', align: 'right' },
                    {
                      key: 'pct', label: '% of Total', align: 'right',
                      render: (r) => (
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(r.pct * 4, 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-10 text-right">{r.pct}%</span>
                        </div>
                      ),
                    },
                  ]}
                  rows={hourlySlotRows}
                />
              </div>
            )}

            {/* ═══════════════ NEVER ATTENDED ═══════════════ */}
            {activeTab === 'neverAttended' && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center">
                  Never Attended <InfoDot text="Calls that were never returned, even after being missed." />
                </h3>
                <p className="text-xs text-gray-400 mb-4">Missed or rejected calls with zero follow-up</p>
                <DataTable
                  loading={loading}
                  emptyTitle="Nothing slipped through 🎉"
                  columns={[
                    { key: 'employee', label: 'Employee' },
                    { key: 'number', label: 'To Number' },
                    { key: 'type', label: 'Call Type', searchable: false, render: (r) => <CallBadge type={r.type} /> },
                    { key: 'date', label: 'Date', searchable: false },
                    { key: 'time', label: 'Time', searchable: false },
                    { key: 'note', label: 'Call Note' },
                    {
                      key: 'attempts', label: 'Attempt Summary', align: 'right', searchable: false,
                      render: (r) => <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">{r.attempts}×</span>,
                    },
                    {
                      key: 'after', label: 'After Missed', align: 'right', searchable: false,
                      render: (r) => (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.after === 'Not Attempted' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {r.after}
                        </span>
                      ),
                    },
                  ]}
                  rows={neverAttendedRows}
                />
              </div>
            )}

            {/* ═══════════════ NOT PICKUP BY CLIENT ═══════════════ */}
            {activeTab === 'notPickup' && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center">
                  Not Pickup by Client <InfoDot text="Outgoing calls the client never answered." />
                </h3>
                <p className="text-xs text-gray-400 mb-4">Outbound attempts that went unanswered</p>
                <DataTable
                  loading={loading}
                  columns={[
                    { key: 'employee', label: 'Employee' },
                    { key: 'number', label: 'To Number' },
                    { key: 'type', label: 'Call Type', searchable: false, render: (r) => <CallBadge type={r.type} /> },
                    { key: 'date', label: 'Date', searchable: false },
                    { key: 'time', label: 'Time', searchable: false },
                  ]}
                  rows={notPickupRows}
                />
              </div>
            )}

            {/* ═══════════════ UNIQUE CLIENTS ═══════════════ */}
            {activeTab === 'uniqueClients' && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center">
                  Unique Clients <InfoDot text="One row per distinct phone number contacted." />
                </h3>
                <p className="text-xs text-gray-400 mb-4">Every distinct client contacted this period</p>
                <DataTable
                  loading={loading}
                  columns={[
                    {
                      key: 'client', label: 'Client',
                      render: (r) => (
                        <div>
                          <p className="font-medium text-gray-900">{r.client}</p>
                          <p className="text-xs text-gray-400">{r.number}</p>
                        </div>
                      ),
                    },
                    { key: 'total', label: 'Total', align: 'right' },
                    { key: 'incoming', label: 'In', align: 'right', searchable: false },
                    { key: 'outgoing', label: 'Out', align: 'right', searchable: false },
                    { key: 'missed', label: 'Missed', align: 'right', searchable: false, render: (r) => <span className="text-red-600">{r.missed}</span> },
                    { key: 'connected', label: 'Connected', align: 'right', searchable: false, render: (r) => <span className="text-emerald-600 font-semibold">{r.connected}</span> },
                    {
                      key: 'lastCall', label: 'Last Call Details', searchable: false,
                      render: (r) => (
                        <div className="bg-gray-50 rounded-lg px-3 py-2 max-w-[240px]">
                          <p className="text-xs text-gray-500 truncate">{r.lastCall}</p>
                        </div>
                      ),
                    },
                  ]}
                  rows={uniqueClientRows}
                />
              </div>
            )}

            {/* ═══════════════ CALL HISTORY ═══════════════ */}
            {activeTab === 'callHistory' && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-1">Call History</h3>
                <p className="text-xs text-gray-400 mb-3">Every individual call record, most recent first</p>

                <LiveBanner count={2185} onRefresh={() => load(true)} />

                <div className="mt-3">
                  <DataTable
                    loading={loading}
                    columns={[
                      { key: 'employee', label: 'Employee' },
                      { key: 'number', label: 'To Number', render: (r) => <PinnedNumber number={r.number} /> },
                      { key: 'date', label: 'Date' },
                      { key: 'time', label: 'Time', searchable: false },
                      { key: 'duration', label: 'Duration', align: 'right', searchable: false },
                      { key: 'type', label: 'Call Type', searchable: false, render: (r) => <CallBadge type={r.type} /> },
                      { key: 'notes', label: 'Notes', searchable: false, render: (r) => <NoteCell initial={r.note} /> },
                    ]}
                    rows={callHistoryRows}
                  />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* ── Footer ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 py-4 text-xs text-gray-400">
          <span>© 2026 LogiMinds Technolab LLP · Callyzer v2.2.9</span>
          <span>Protected by Google reCAPTCHA</span>
        </div>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid #E5E7EB;
          font-size: 0.8125rem;
          outline: none;
          background: white;
          transition: border-color 0.15s;
        }
        .input:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
      `}</style>
    </div>
  );
}