'use client';
import { Fragment, useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';

/* ────────────────────────────────────────────────────────────
   CONSTANTS
──────────────────────────────────────────────────────────── */
export const TYPE_META = {
  incoming: { label: 'Incoming', color: '#16A34A', bg: '#F0FDF4' },
  outgoing: { label: 'Outgoing', color: '#D97706', bg: '#FFFBEB' },
  missed:   { label: 'Missed',   color: '#DC2626', bg: '#FEF2F2' },
  rejected: { label: 'Rejected', color: '#7C3AED', bg: '#F5F3FF' },
};

/* ────────────────────────────────────────────────────────────
   UTILITY
──────────────────────────────────────────────────────────── */
export function fmtSec(s) {
  if (!s || s <= 0) return '—';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  if (h) return `${h}h ${m}m ${sec}s`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/* ────────────────────────────────────────────────────────────
   ICON PRIMITIVE + NAMED ICONS
──────────────────────────────────────────────────────────── */
export const Ico = ({ size = 16, children, className = '', fill = 'none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {children}
  </svg>
);

export const CalendarIco  = ({ s = 14 }) => <Ico size={s}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Ico>;
export const PhoneIco     = ({ s = 14 }) => <Ico size={s}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></Ico>;
export const CheckIco     = ({ s = 14 }) => <Ico size={s}><polyline points="20 6 9 17 4 12"/></Ico>;
export const XIco         = ({ s = 12 }) => <Ico size={s}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Ico>;
export const ClockIco     = ({ s = 14 }) => <Ico size={s}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Ico>;
export const UsersIco     = ({ s = 14 }) => <Ico size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Ico>;
export const DownloadIco  = ({ s = 14 }) => <Ico size={s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Ico>;
export const RefreshIco   = ({ s = 14, spinning = false }) => <Ico size={s} className={spinning ? 'animate-spin' : ''}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></Ico>;
export const ChevronIco   = ({ open, s = 14 }) => <Ico size={s} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></Ico>;
export const SearchIco    = ({ s = 13 }) => <Ico size={s}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>;
export const ArrowUpIco   = ({ s = 12 }) => <Ico size={s}><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></Ico>;
export const ArrowDownIco = ({ s = 12 }) => <Ico size={s}><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></Ico>;
export const InboxIco     = ({ s = 32 }) => <Ico size={s}><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></Ico>;
export const TrophyIco    = ({ s = 16 }) => <Ico size={s} className="text-amber-500"><path d="M6 9H4a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1h3M18 9h2a2 2 0 0 0 2-2V5a1 1 0 0 0-1-1h-3M6 4h12v6a6 6 0 0 1-12 0V4z"/><path d="M12 15v3M8 21h8"/></Ico>;
export const StopwatchIco = ({ s = 16 }) => <Ico size={s} className="text-blue-500"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></Ico>;
export const GaugeIco     = ({ s = 16 }) => <Ico size={s} className="text-emerald-500"><path d="M12 15a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM4.93 19.07A10 10 0 1 1 19.07 19.07"/><path d="M12 13l3.5-3.5"/></Ico>;
export const ZapIco       = ({ s = 16 }) => <Ico size={s} className="text-yellow-500"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></Ico>;

// Tab-specific icons
export const BarChartTabIco = () => <Ico size={15} className="text-blue-500"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></Ico>;
export const CalendarTabIco = () => <Ico size={15} className="text-amber-500"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Ico>;
export const ClockTabIco    = () => <Ico size={15} className="text-sky-500"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></Ico>;
export const NoEntryIco     = () => <Ico size={15} className="text-red-500"><circle cx="12" cy="12" r="9"/><line x1="6" y1="6" x2="18" y2="18"/></Ico>;
export const PhoneTabIco    = () => <Ico size={15} className="text-rose-500"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></Ico>;
export const PersonTabIco   = () => <Ico size={15} className="text-gray-600"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/></Ico>;
export const ClipboardIco   = () => <Ico size={15} className="text-gray-600"><rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="15" y2="14"/></Ico>;
export const GridIco        = () => <Ico size={15} className="text-indigo-500"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Ico>;

/* ────────────────────────────────────────────────────────────
   UI PRIMITIVES
──────────────────────────────────────────────────────────── */
export function CallBadge({ type }) {
  const m = TYPE_META[type] || TYPE_META.outgoing;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
      style={{ color: m.color, background: m.bg }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

/* Lead status pill — statusStyle/statusLabel come from lib/leadStatus.js,
   the single source of truth for the 9-value lead status taxonomy. */
export function LeadStatusBadge({ status, style, label }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${style.bg} ${style.text} ${style.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
      {label}
    </span>
  );
}

export function InfoDot({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex ml-1 cursor-help" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 text-[9px] font-bold flex items-center justify-center select-none">i</span>
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute z-30 left-1/2 -translate-x-1/2 top-6 w-60 bg-gray-900 text-white text-[11px] leading-snug rounded-lg px-3 py-2 shadow-xl pointer-events-none">
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

export function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl px-3 py-2.5 text-xs shadow-lg border border-gray-200 min-w-[120px]">
      {label && <p className="text-gray-400 font-medium mb-1.5 text-[11px]">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-semibold flex items-center gap-1.5 mt-0.5" style={{ color: p.color || p.fill }}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
          {p.name}: {p.value?.toLocaleString?.() ?? p.value}
        </p>
      ))}
    </div>
  );
}

export function StatCard({ label, value, sub, color, icon, delta, loading = false }) {
  if (loading) return <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse"><div className="h-9 w-9 bg-gray-100 rounded-lg"/><div className="h-7 w-24 bg-gray-100 rounded mt-3"/><div className="h-3 w-20 bg-gray-100 rounded mt-2"/></div>;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="relative bg-white rounded-xl border border-gray-200 p-4 overflow-hidden group hover:border-gray-300 hover:shadow-sm transition-all">
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-[0.06] group-hover:opacity-[0.1] transition-opacity" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}14`, color }}>
          {icon}
        </div>
        {delta != null && (
          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${delta >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-3 tabular-nums leading-none">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </motion.div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`bg-gray-100 rounded animate-pulse ${className}`} />;
}

export function EmptyState({ title = 'No records found', hint = 'Try widening your date range or clearing filters.' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <InboxIco s={36} />
      <p className="mt-4 text-sm font-semibold text-gray-600">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{hint}</p>
    </div>
  );
}

export function InsightCard({ icon, title, rows }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h4 className="text-sm font-bold text-gray-900">{title}</h4>
      </div>
      <div className="space-y-4">
        {rows.map((r, i) => (
          <div key={i} className={i > 0 ? 'pt-3 border-t border-gray-100' : ''}>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">{r.label}</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{r.value || '—'}</p>
            {r.sub && <p className="text-xs text-gray-500 mt-0.5">{r.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LiveBanner({ count, label = 'new logs available — click to refresh', onRefresh }) {
  if (!count) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center mb-3">
      <button onClick={onRefresh}
        className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-amber-100 transition-colors shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        {count.toLocaleString()} {label}
      </button>
    </motion.div>
  );
}

// Clips any free-text cell value to `max` characters with an ellipsis, showing
// the full text on hover via `title` — keeps wide tables scannable when
// contact/employee/note text runs long.
export function Truncate({ text, max = 16 }) {
  const s = text == null ? '' : String(text);
  if (!s) return <span>—</span>;
  if (s.length <= max) return <span>{s}</span>;
  return <span title={s}>{s.slice(0, max - 1)}…</span>;
}

// Shared "Team Lead" filter dropdown — populated from GET /api/employees/tl-names.
// Reused across Analytics, Daily Targets, and every Reports page's filter bar
// so team-lead filtering behaves identically everywhere.
export function TLFilter({ value, onChange, className = '' }) {
  const [names, setNames] = useState([]);
  useEffect(() => {
    api.get('/api/employees/tl-names').then((r) => setNames(r.data.data || [])).catch(() => {});
  }, []);
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={`px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-blue-400 bg-white text-gray-700 ${className}`}>
      <option value="">All Team Leads</option>
      {names.map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );
}

export function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export function ActiveFilterChips({ filters, labels = {}, onClear, onClearAll }) {
  const SKIP = new Set(['excludeNumbers']);
  const entries = Object.entries(filters).filter(([k, v]) => !SKIP.has(k) && v && v !== '');
  if (!entries.length) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {entries.map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-full border border-blue-100">
          <span className="text-blue-400 text-[10px] uppercase tracking-wide">{labels[k] || k}:</span> {v}
          <button onClick={() => onClear(k)} className="hover:bg-blue-100 rounded-full p-0.5 transition-colors"><XIco /></button>
        </span>
      ))}
      <button onClick={onClearAll} className="text-xs text-gray-400 hover:text-red-500 underline underline-offset-2 transition-colors">Clear all</button>
    </div>
  );
}

/* Column-level filter match. `col.filterValue(row)` lets a column filter on its
   underlying raw value even when its `render()` shows a badge/pin/etc instead. */
function matchesColumnFilter(row, col, val) {
  const raw = col?.filterValue ? col.filterValue(row) : row[col?.key];
  if (col?.filterType === 'select') return String(raw ?? '') === val;
  if (col?.filterType === 'date') {
    if (!raw) return false;
    const d = new Date(raw), sel = new Date(val);
    if (isNaN(d.getTime()) || isNaN(sel.getTime())) return false;
    return d.getFullYear() === sel.getFullYear() && d.getMonth() === sel.getMonth() && d.getDate() === sel.getDate();
  }
  return String(raw ?? '').toLowerCase().includes(String(val).toLowerCase());
}

/* ────────────────────────────────────────────────────────────
   DATA TABLE — client-side search, sort, pagination
   Used for bounded datasets (summary, daywise, hourly, etc.)
──────────────────────────────────────────────────────────── */
export function DataTable({
  columns,
  rows,
  loading = false,
  pageSize = 10,
  searchable = true,
  emptyTitle,
  emptyHint,
  compact = false,
  footer,
  capNotice,
  // Server-driven pagination: pass `rows` as already the current page's data.
  // When set, DataTable stops slicing/sorting/filtering client-side and defers
  // page/limit changes to the caller via the on* callbacks below.
  serverMode = false,
  page: serverPage = 1,
  totalPages: serverTotalPages = 1,
  totalCount,
  onPageChange,
  onPageSizeChange,
  // Row selection (checkboxes) — caller owns the selected-id set.
  selectable = false,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  getRowId = (row) => row._id ?? row.id,
  // Expandable rows — renderExpanded(row) is shown in a full-width row
  // directly beneath the row whose id matches `expandedId`.
  renderExpanded,
  expandedId,
  onToggleExpand,
  // Extras adopted from the report-page-local DataTable clones — a leading
  // "Sr. No." column, a scrolling body with sticky header, and per-column
  // select/date filters (in addition to the default text filter).
  showRowNumber = false,
  maxBodyHeight,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [colSearch, setColSearch] = useState({});
  const [localPage, setLocalPage] = useState(1);
  const [rpp, setRpp] = useState(pageSize);

  const filtered = useMemo(() => {
    if (serverMode) return rows;
    let r = rows;
    Object.entries(colSearch).forEach(([key, val]) => {
      if (!val) return;
      const col = columns.find((c) => c.key === key);
      r = r.filter((row) => matchesColumnFilter(row, col, val));
    });
    if (sortKey) {
      r = [...r].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av ?? '').localeCompare(String(bv ?? ''));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return r;
  }, [rows, colSearch, sortKey, sortDir, serverMode]);

  const page = serverMode ? serverPage : localPage;
  const totalPages = serverMode ? Math.max(1, serverTotalPages) : Math.max(1, Math.ceil(filtered.length / rpp));
  const pageRows = serverMode ? rows : filtered.slice((page - 1) * rpp, page * rpp);
  const rangeTotal = serverMode ? (totalCount ?? rows.length) : filtered.length;

  useEffect(() => { if (!serverMode) setLocalPage(1); }, [colSearch, rpp, rows, serverMode]);

  const goToPage = (p) => (serverMode ? onPageChange?.(p) : setLocalPage(p));
  const changeRpp = (n) => (serverMode ? onPageSizeChange?.(n) : (setRpp(n)));

  const toggleSort = (key) => {
    if (serverMode) return;
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const cell = compact ? 'px-3 py-2' : 'px-4 py-3';

  const allOnPageSelected = selectable && pageRows.length > 0 && pageRows.every((r) => selectedIds?.has(getRowId(r)));
  let effectiveColumns = showRowNumber
    ? [{ key: '__srNo', label: 'Sr. No.', width: 72, sortable: false, searchable: false, render: (_row, i) => (page - 1) * rpp + i + 1 }, ...columns]
    : columns;
  if (selectable) {
    effectiveColumns = [{
      key: '__select', sortable: false, searchable: false, align: 'left',
      label: (
        <input type="checkbox" checked={allOnPageSelected} onChange={() => onToggleSelectAll?.(pageRows.map(getRowId))}
          className="w-3.5 h-3.5 rounded border-gray-300 cursor-pointer" />
      ),
      render: (row) => (
        <input type="checkbox" checked={!!selectedIds?.has(getRowId(row))} onChange={() => onToggleSelect?.(getRowId(row))}
          onClick={(e) => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded border-gray-300 cursor-pointer" />
      ),
    }, ...effectiveColumns];
  }
  const hasWidths = effectiveColumns.some((c) => c.width);

  return (
    <div>
      {capNotice && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          {capNotice}
        </div>
      )}
      <div className="flex items-center justify-between px-1 pb-3">
        <span className="text-xs text-gray-400">
          {rangeTotal === 0 ? '0'
            : serverMode
              ? `Page ${page}`
              : `${(page - 1) * rpp + 1}–${Math.min(page * rpp, rangeTotal)}`} of {rangeTotal.toLocaleString()}
        </span>
        {(!serverMode || onPageSizeChange) && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            Show
            <select value={rpp} onChange={(e) => { const n = Number(e.target.value); setRpp(n); changeRpp(n); }}
              className="border border-gray-200 rounded-md px-2 py-1 text-xs outline-none focus:border-blue-400 bg-white">
              {[10, 25, 50, 100].map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
        <div className="overflow-auto" style={maxBodyHeight ? { maxHeight: maxBodyHeight } : undefined}>
        <table className="w-full text-sm min-w-[600px]" style={hasWidths ? { tableLayout: 'fixed' } : undefined}>
          {hasWidths && (
            <colgroup>
              {effectiveColumns.map((c) => <col key={c.key} style={{ width: c.width ? c.width : `${100 / effectiveColumns.length}%` }} />)}
            </colgroup>
          )}
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
              {effectiveColumns.map((c) => (
                <th key={c.key}
                  className={`${cell} text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                  <button
                    onClick={() => c.sortable !== false && toggleSort(c.key)}
                    className={`inline-flex items-center gap-1 ${!serverMode && c.sortable !== false ? 'hover:text-gray-800 cursor-pointer' : 'cursor-default'}`}>
                    {c.label}
                    {!serverMode && sortKey === c.key && (sortDir === 'asc' ? <ArrowUpIco /> : <ArrowDownIco />)}
                  </button>
                </th>
              ))}
            </tr>
            {searchable && !serverMode && (
              <tr className="bg-white border-b border-gray-100">
                {effectiveColumns.map((c) => (
                  <td key={c.key} className={`${cell} pt-2 pb-2`}>
                    {c.searchable === false ? null : c.filterType === 'select' ? (
                      <select
                        value={colSearch[c.key] || ''}
                        onChange={(e) => setColSearch((s) => ({ ...s, [c.key]: e.target.value }))}
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 outline-none focus:border-blue-400 bg-gray-50">
                        <option value="">{c.filterPlaceholder || 'All'}</option>
                        {(c.filterOptions || []).map((opt) => {
                          const value = typeof opt === 'string' ? opt : opt.value;
                          const label = typeof opt === 'string' ? opt : opt.label;
                          return <option key={value} value={value}>{label}</option>;
                        })}
                      </select>
                    ) : c.filterType === 'date' ? (
                      <input
                        type="date"
                        value={colSearch[c.key] || ''}
                        onChange={(e) => setColSearch((s) => ({ ...s, [c.key]: e.target.value }))}
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 outline-none focus:border-blue-400 bg-gray-50"
                      />
                    ) : (
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300"><SearchIco /></span>
                        <input
                          placeholder="Filter…"
                          className="w-full pl-6 pr-2 py-1.5 text-xs rounded-lg border border-gray-200 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-gray-50"
                          value={colSearch[c.key] || ''}
                          onChange={(e) => setColSearch((s) => ({ ...s, [c.key]: e.target.value }))}
                        />
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {loading ? (
              Array.from({ length: Math.min(rpp, 8) }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {effectiveColumns.map((c, j) => (
                    <td key={j} className={cell}><div className="h-4 bg-gray-100 rounded w-3/4" /></td>
                  ))}
                </tr>
              ))
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={effectiveColumns.length}><EmptyState title={emptyTitle} hint={emptyHint} /></td></tr>
            ) : (
              pageRows.map((row, i) => {
                const rowId = getRowId(row) ?? i;
                const isExpanded = renderExpanded && expandedId === rowId;
                return (
                  <Fragment key={rowId}>
                    <motion.tr
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.015, 0.15) }}
                      onClick={renderExpanded ? () => onToggleExpand?.(rowId) : undefined}
                      className={`transition-colors hover:bg-blue-50/40 ${renderExpanded ? 'cursor-pointer' : ''} ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                      {effectiveColumns.map((c) => (
                        <td key={c.key}
                          className={`${cell} ${c.wrap ? 'whitespace-normal break-words align-top' : 'whitespace-nowrap overflow-hidden text-ellipsis'} text-gray-700 ${c.align === 'right' ? 'text-right tabular-nums' : 'text-left'} ${c.className || ''}`}>
                          {c.render ? c.render(row, i) : (row[c.key] ?? '—')}
                        </td>
                      ))}
                    </motion.tr>
                    {isExpanded && (
                      <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-50/60">
                        <td colSpan={effectiveColumns.length} className="px-4 py-3">
                          {renderExpanded(row)}
                        </td>
                      </motion.tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
          {footer && !loading && pageRows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-100 bg-gray-50/60 font-semibold text-gray-900">
                {effectiveColumns.map((c) => (
                  <td key={c.key} className={`${cell} whitespace-nowrap ${c.align === 'right' ? 'text-right tabular-nums' : 'text-left'}`}>
                    {footer[c.key] !== undefined ? footer[c.key] : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
        </div>
      </div>

      {!loading && rangeTotal > 0 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => goToPage(1)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-medium disabled:opacity-30 hover:bg-gray-50 hover:border-gray-300 transition-colors">
              «
            </button>
            <button disabled={page === 1} onClick={() => goToPage(page - 1)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium disabled:opacity-30 hover:bg-gray-50 hover:border-gray-300 transition-colors">
              Prev
            </button>
            <button disabled={page === totalPages} onClick={() => goToPage(page + 1)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium disabled:opacity-30 hover:bg-gray-50 hover:border-gray-300 transition-colors">
              Next
            </button>
            <button disabled={page === totalPages} onClick={() => goToPage(totalPages)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-medium disabled:opacity-30 hover:bg-gray-50 hover:border-gray-300 transition-colors">
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
