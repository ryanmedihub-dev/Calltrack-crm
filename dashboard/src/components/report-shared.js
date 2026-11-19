'use client';
import { Fragment, useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import { fmtDateTime } from '../lib/timezone';
import MultiSelect from './MultiSelect';
export { MultiSelect };

/* ────────────────────────────────────────────────────────────
   CONSTANTS
──────────────────────────────────────────────────────────── */
// One colour per call type, everywhere (badges, chart series, legends). Outgoing is the agent's
// own work, so it takes the brand blue; missed is the only red; no purple.
export const TYPE_META = {
  incoming: { label: 'Incoming', color: '#0E9384', bg: '#F0FDF9' },
  outgoing: { label: 'Outgoing', color: '#7C3AED', bg: '#F5F3FF' },
  missed:   { label: 'Missed',   color: '#D92D20', bg: '#FEF3F2' },
  rejected: { label: 'Rejected', color: '#B54708', bg: '#FFFAEB' },
};

export const fmtNum = (n) => (n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString('en-IN'));

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
    <span className="badge" style={{ color: m.color, background: m.bg }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

/* Lead status pill — statusStyle/statusLabel come from lib/leadStatus.js,
   the single source of truth for the lead status taxonomy. */
export function LeadStatusBadge({ status, style, label }) {
  return (
    <span className={`badge ${style.bg} ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
      {label}
    </span>
  );
}

// Hover/focus help. Fast (125ms) and scaled from just above the trigger, per the tooltip recipe.
export function InfoDot({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex ml-1 align-middle"
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      {/* A span, not a button: InfoDot often sits inside a tab or header button, and buttons can't nest. */}
      <span tabIndex={0} aria-label={text}
        className="w-4 h-4 rounded-full text-ink-3 hover:text-ink flex items-center justify-center cursor-help">
        <Ico size={13}><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12.01" y2="8"/></Ico>
      </span>
      <AnimatePresence>
        {open && (
          <motion.span role="tooltip"
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.125, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: 'top center' }}
            className="absolute z-40 left-1/2 -translate-x-1/2 top-6 w-60 bg-ink text-white text-xs font-normal normal-case tracking-normal leading-snug rounded-lg px-3 py-2 shadow-lg pointer-events-none">
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
    <div className="bg-white rounded-lg px-3 py-2 text-xs shadow-lg border border-line min-w-[140px]">
      {label != null && <p className="text-ink-3 mb-1.5">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 mt-0.5 text-ink-2">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.color || p.fill }} />
          <span className="flex-1">{p.name}</span>
          <span className="font-semibold text-ink tabular-nums">{p.value?.toLocaleString?.('en-IN') ?? p.value}</span>
        </p>
      ))}
    </div>
  );
}

// A score, not a tile: label, number, context. No icon blocks, no decorative circles.
// `tone` colours the number only when it carries meaning ('behind' / 'met').
export function StatCard({ label, value, sub, delta, tone, loading = false, onClick }) {
  if (loading) {
    return (
      <div className="panel p-4">
        <div className="skeleton h-3.5 w-24" />
        <div className="skeleton h-7 w-20 mt-3" />
        <div className="skeleton h-3 w-28 mt-2" />
      </div>
    );
  }
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick}
      className={`panel p-4 text-left w-full ${onClick ? 'card-hover cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="stat-label truncate">{label}</p>
        {delta != null && (
          <span className={`text-xs font-medium tabular-nums ${delta >= 0 ? 'text-met' : 'text-behind'}`}>
            {delta >= 0 ? '+' : '−'}{Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className={`stat-number mt-1.5 ${tone === 'behind' ? 'text-behind' : tone === 'met' ? 'text-met' : ''}`}>
        {typeof value === 'number' ? fmtNum(value) : value}
      </p>
      {sub && <p className="text-xs text-ink-3 mt-1 truncate">{sub}</p>}
    </Tag>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} />;
}

export function EmptyState({ title = 'No records found', hint = 'Try a wider date range or clear the filters.', action }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <span className="w-10 h-10 rounded-full bg-gray-100 text-ink-3 flex items-center justify-center"><InboxIco s={20} /></span>
      <p className="mt-3 text-sm font-medium text-ink">{title}</p>
      <p className="text-[13px] text-ink-3 mt-1 max-w-sm">{hint}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function InsightCard({ icon, title, rows }) {
  return (
    <div className="panel h-full">
      <div className="panel-head">
        <h4 className="panel-title flex items-center gap-2">{icon}{title}</h4>
      </div>
      <dl className="px-5 py-2">
        {rows.map((r, i) => (
          <div key={i} className={`py-3 ${i > 0 ? 'border-t border-line-2' : ''}`}>
            <dt className="text-xs text-ink-3">{r.label}</dt>
            <dd className="text-sm font-medium text-ink mt-0.5 truncate">{r.value || '—'}</dd>
            {r.sub && <dd className="text-xs text-ink-3 mt-0.5">{r.sub}</dd>}
          </div>
        ))}
      </dl>
    </div>
  );
}

export function LiveBanner({ count, label = 'new logs available — click to refresh', onRefresh }) {
  if (!count) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} className="flex justify-center mb-3">
      <button onClick={onRefresh} className="btn-secondary btn-sm rounded-full">
        <span className="live-dot" />
        {count.toLocaleString('en-IN')} {label}
      </button>
    </motion.div>
  );
}

// One page header pattern for every page: title, optional description, actions on the right.
export function PageHeader({ title, description, actions, children }) {
  return (
    <div className="page-header">
      <div className="min-w-0">
        <h1 className="page-title truncate">{title}</h1>
        {description && <p className="page-subtitle">{description}</p>}
      </div>
      {(actions || children) && <div className="flex items-center gap-2 flex-wrap">{actions}{children}</div>}
    </div>
  );
}

// Sliding-underline tabs (state indication). The indicator moves between tabs with layout
// animation instead of colours swapping in place.
export function Tabs({ tabs, value, onChange, id = 'tabs' }) {
  return (
    <div className="tab-nav" role="tablist">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button key={t.key} role="tab" aria-selected={active} onClick={() => onChange(t.key)}
            className={`tab-item ${active ? '!border-transparent text-ink' : ''}`}>
            {t.icon}{t.label}
            {t.count != null && <span className="text-xs text-ink-3 tabular-nums">{fmtNum(t.count)}</span>}
            {active && (
              <motion.span layoutId={`${id}-indicator`} className="absolute left-0 right-0 -bottom-px h-0.5 bg-[var(--blue)] rounded-full"
                transition={{ duration: 0.25, ease: [0.77, 0, 0.175, 1] }} />
            )}
          </button>
        );
      })}
    </div>
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
    <MultiSelect value={value || ''} onChange={onChange} options={names} placeholder="All Team Leads"
      noun="team leads" ariaLabel="Team lead" className={`w-auto min-w-[180px] ${className}`} />
  );
}

export function Field({ label, hint, children }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      {children}
      {hint && <p className="form-hint">{hint}</p>}
    </div>
  );
}

// Inline remark editor for report tables — click to edit, Enter/blur to save, Esc to cancel.
// Saves through the caller's `onSave` (which PATCHes /api/calls/:id/notes) and renders the
// "last edited" stamp underneath, so a reader can tell an original sync-time remark apart
// from one an admin revised later. Optimistic: shows the new text immediately and rolls
// back if the save rejects, so a failed edit never looks like it stuck.
export function EditableRemarks({ value, updatedAt, updatedByName, onSave, placeholder = 'Add remark' }) {
  const [text, setText]       = useState(value || '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value || '');
  const [saving, setSaving]   = useState(false);
  const [stamp, setStamp]     = useState({ at: updatedAt, by: updatedByName });

  // Re-sync when the row's underlying data changes (refetch, pagination, filter change) —
  // without this the cell would keep showing a previous row's text after the list reloads.
  useEffect(() => {
    setText(value || '');
    setDraft(value || '');
    setStamp({ at: updatedAt, by: updatedByName });
  }, [value, updatedAt, updatedByName]);

  const commit = async () => {
    const next = draft.trim();
    setEditing(false);
    if (next === (text || '')) return;
    const prev = text;
    const prevStamp = stamp;
    setText(next);
    setStamp({ at: new Date().toISOString(), by: null }); // optimistic; server is source of truth
    setSaving(true);
    try {
      await onSave?.(next);
    } catch {
      setText(prev);
      setStamp(prevStamp);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <textarea
        autoFocus
        rows={2}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setDraft(text || ''); setEditing(false); }
        }}
        className="w-full text-xs border border-blue-300 rounded-md px-2 py-1 outline-none resize-y focus:border-blue-500"
      />
    );
  }

  return (
    <div className={saving ? 'opacity-60' : ''}>
      {text ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Click to edit remark"
          className="text-left w-full text-xs text-gray-700 hover:text-blue-600 whitespace-pre-wrap break-words"
        >
          {text}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-blue-600 font-medium hover:underline"
        >
          + {placeholder}
        </button>
      )}
      {stamp.at && (
        <p className="text-xs text-gray-400 mt-1">
          edited {fmtDateTime(stamp.at)}{stamp.by ? ` · ${stamp.by}` : ''}
        </p>
      )}
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
        <span key={k} className="inline-flex items-center gap-1.5 h-7 bg-white text-ink-2 text-xs pl-2.5 pr-1 rounded-md border border-line">
          <span className="text-ink-3">{labels[k] || k}</span>
          <span className="font-medium text-ink">{v}</span>
          <button onClick={() => onClear(k)} aria-label={`Clear ${labels[k] || k}`}
            className="w-5 h-5 rounded flex items-center justify-center text-ink-3 hover:bg-gray-100 hover:text-ink transition-colors"><XIco s={11} /></button>
        </span>
      ))}
      <button onClick={onClearAll} className="text-xs font-medium text-ink-3 hover:text-ink px-1 transition-colors">Clear all</button>
    </div>
  );
}

/* Column-level filter match. `col.filterValue(row)` lets a column filter on its
   underlying raw value even when its `render()` shows a badge/pin/etc instead. */
function matchesColumnFilter(row, col, val) {
  const raw = col?.filterValue ? col.filterValue(row) : row[col?.key];
  if (col?.filterType === 'select') return String(val).split(',').includes(String(raw ?? ''));
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
  const [localRpp, setLocalRpp] = useState(pageSize);
  // In serverMode the caller owns the page size (it drives the API's `limit`), so track the
  // prop rather than local state — otherwise row numbering and the "showing X–Y of Z" label
  // keep using the initial size after the user picks a different one.
  const rpp = serverMode ? pageSize : localRpp;
  const setRpp = serverMode ? () => {} : setLocalRpp;

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

  const cell = compact ? 'px-3 py-2' : 'px-4 py-2.5';

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
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-[var(--warn-50)] text-xs text-[var(--warn)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--warn)] shrink-0" />
          {capNotice}
        </div>
      )}

      <div className="overflow-hidden rounded-[10px] border border-line bg-white">
        <div className="overflow-auto" style={maxBodyHeight ? { maxHeight: maxBodyHeight } : undefined}>
        <table className="w-full text-[13px] min-w-[720px] border-separate border-spacing-0" style={hasWidths ? { tableLayout: 'fixed' } : undefined}>
          {hasWidths && (
            <colgroup>
              {effectiveColumns.map((c) => <col key={c.key} style={{ width: c.width ? c.width : `${100 / effectiveColumns.length}%` }} />)}
            </colgroup>
          )}
          <thead>
            <tr className="sticky top-0 z-10">
              {effectiveColumns.map((c) => {
                const sortable = !serverMode && c.sortable !== false;
                const sorted = !serverMode && sortKey === c.key;
                return (
                  <th key={c.key} aria-sort={sorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`${cell} h-9 py-0 bg-gray-50 border-b border-line text-xs font-medium whitespace-nowrap ${sorted ? 'text-ink' : 'text-ink-3'} ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                    <button
                      onClick={() => sortable && toggleSort(c.key)}
                      className={`group/sort inline-flex items-center gap-1 ${c.align === 'right' ? 'flex-row-reverse' : ''} ${sortable ? 'hover:text-ink cursor-pointer' : 'cursor-default'}`}>
                      {c.label}
                      {sortable && (
                        <span className={`transition-opacity duration-150 ${sorted ? 'opacity-100' : 'opacity-0 group-hover/sort:opacity-50'}`}>
                          {sorted && sortDir === 'desc' ? <ArrowDownIco s={11} /> : <ArrowUpIco s={11} />}
                        </span>
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
            {searchable && !serverMode && (
              <tr>
                {effectiveColumns.map((c) => (
                  <td key={c.key} className={`${cell} py-1.5 bg-white border-b border-line-2`}>
                    {c.searchable === false ? null : c.filterType === 'select' ? (
                      <MultiSelect
                        value={colSearch[c.key] || ''}
                        onChange={(v) => setColSearch((s) => ({ ...s, [c.key]: v }))}
                        placeholder={c.filterPlaceholder || 'All'} ariaLabel={`Filter ${c.label || c.key}`}
                        options={c.filterOptions || []} className="h-8 text-xs" />
                    ) : c.filterType === 'date' ? (
                      <input
                        type="date"
                        value={colSearch[c.key] || ''}
                        onChange={(e) => setColSearch((s) => ({ ...s, [c.key]: e.target.value }))}
                        className="form-input h-8 text-xs"
                      />
                    ) : (
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none"><SearchIco s={12} /></span>
                        <input
                          placeholder="Filter"
                          aria-label={`Filter ${typeof c.label === 'string' ? c.label : ''}`}
                          className="form-input h-8 text-xs pl-7"
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
          <tbody className="bg-white">
            {loading ? (
              Array.from({ length: Math.min(rpp, 8) }).map((_, i) => (
                <tr key={i}>
                  {effectiveColumns.map((c, j) => (
                    <td key={j} className={`${cell} h-11 border-b border-line-2`}>
                      <div className={`skeleton h-3.5 ${c.align === 'right' ? 'ml-auto w-10' : j === 0 ? 'w-32' : 'w-20'}`} />
                    </td>
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
                    <tr
                      onClick={renderExpanded ? () => onToggleExpand?.(rowId) : undefined}
                      className={`group/row transition-colors duration-150 hover:bg-[#F8F9FB] ${renderExpanded ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-[#F8F9FB]' : ''}`}>
                      {effectiveColumns.map((c) => (
                        <td key={c.key}
                          className={`${cell} h-11 border-b border-line-2 ${c.wrap ? 'whitespace-normal break-words align-top' : 'whitespace-nowrap overflow-hidden text-ellipsis'} text-ink-2 ${c.align === 'right' ? 'text-right tabular-nums' : 'text-left'} ${c.className || ''}`}>
                          {c.render ? c.render(row, i) : (typeof row[c.key] === 'number' ? fmtNum(row[c.key]) : (row[c.key] ?? '—'))}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={effectiveColumns.length} className="px-4 py-3 border-b border-line-2">
                          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}>
                            {renderExpanded(row)}
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
          {footer && !loading && pageRows.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 font-semibold text-ink">
                {effectiveColumns.map((c) => (
                  <td key={c.key} className={`${cell} h-11 border-t border-line whitespace-nowrap ${c.align === 'right' ? 'text-right tabular-nums' : 'text-left'}`}>
                    {footer[c.key] !== undefined ? footer[c.key] : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
        </div>
      </div>

      {/* Footer: range on the left, page size + pager on the right — one row, under the table */}
      {(rangeTotal > 0 || loading) && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 px-0.5">
          <span className="text-xs text-ink-3 tabular-nums">
            {loading ? 'Loading…' : serverMode
              ? <>Page <b className="font-medium text-ink-2">{page}</b> of {fmtNum(totalPages)} · {fmtNum(rangeTotal)} total</>
              : <><b className="font-medium text-ink-2">{fmtNum((page - 1) * rpp + 1)}–{fmtNum(Math.min(page * rpp, rangeTotal))}</b> of {fmtNum(rangeTotal)}</>}
          </span>
          <div className="flex items-center gap-3">
            {(!serverMode || onPageSizeChange) && (
              <label className="flex items-center gap-2 text-xs text-ink-3">
                Rows
                <select value={rpp} onChange={(e) => { const n = Number(e.target.value); setRpp(n); changeRpp(n); }}
                  className="form-input h-8 w-[68px] text-xs pr-7">
                  {[10, 25, 50, 100].map((n) => <option key={n}>{n}</option>)}
                </select>
              </label>
            )}
            <div className="flex items-center gap-1">
              <button aria-label="Previous page" disabled={page === 1 || loading} onClick={() => goToPage(page - 1)}
                className="btn-secondary btn-sm btn-icon w-8">
                <Ico size={14}><polyline points="15 18 9 12 15 6"/></Ico>
              </button>
              <span className="text-xs text-ink-2 tabular-nums px-2 min-w-[56px] text-center">{fmtNum(page)} / {fmtNum(totalPages)}</span>
              <button aria-label="Next page" disabled={page === totalPages || loading} onClick={() => goToPage(page + 1)}
                className="btn-secondary btn-sm btn-icon w-8">
                <Ico size={14}><polyline points="9 18 15 12 9 6"/></Ico>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
