'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * All range math is done on plain 'YYYY-MM-DD' calendar-date strings that
 * represent IST (Asia/Kolkata) days — the actual UTC bounds are resolved
 * server-side (see backend getISTDateBounds/resolveStatsRange).
 */
const IST_TZ = 'Asia/Kolkata';

export function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: IST_TZ });
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const diff = (d.getUTCDay() + 6) % 7; // 0=Mon..6=Sun
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function fmtShort(dateStr) {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', timeZone: 'UTC',
  });
}

const RANGE_OPTIONS = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'thisWeek', label: 'This Week' },
];

/**
 * Resolves a { range, startDate, endDate } filter value into concrete
 * { fromDate, toDate } IST calendar-date strings (inclusive on both ends).
 * Used to deep-link dashboard/overview cards into report pages with a date
 * filter that covers exactly the same days the card's count was computed
 * over, so the destination report's total matches the card.
 */
export function rangeToDates(value) {
  const today = todayIST();
  switch (value?.range) {
    case 'all':
      return { fromDate: '', toDate: '' };
    case 'yesterday': {
      const d = addDays(today, -1);
      return { fromDate: d, toDate: d };
    }
    case 'thisWeek':
      return { fromDate: mondayOf(today), toDate: today };
    case 'custom':
      if (value.startDate) return { fromDate: value.startDate, toDate: value.endDate || value.startDate };
      return { fromDate: today, toDate: today };
    case 'today':
    default:
      return { fromDate: today, toDate: today };
  }
}

/** Human label for the current filter value — usable outside the component too. */
export function formatRangeLabel(value) {
  if (!value) return 'All Time';
  if (value.range === 'custom' && value.startDate) {
    const s = fmtShort(value.startDate);
    const e = fmtShort(value.endDate || value.startDate);
    return value.startDate === (value.endDate || value.startDate) ? s : `${s} – ${e}`;
  }
  return RANGE_OPTIONS.find((o) => o.key === value.range)?.label || (value.range === 'all' ? 'All Time' : 'Today');
}

const CalendarIco = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const ChevronIco = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/**
 * Reusable date-range filter dropdown (Today / Yesterday / This Week / Custom Range).
 * `value` = { range: 'today'|'yesterday'|'thisWeek'|'custom', startDate, endDate }
 * `onChange(nextValue)` fires whenever the user picks a new range or applies a custom one.
 * All dates are plain 'YYYY-MM-DD' IST calendar-date strings.
 */
export default function DateRangeFilter({ value, onChange, className = '', includeAll = false }) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(value?.range === 'custom');
  const [customStart, setCustomStart] = useState(value?.startDate || todayIST());
  const [customEnd, setCustomEnd] = useState(value?.endDate || todayIST());
  const wrapRef = useRef(null);

  const options = includeAll || value?.range === 'all'
    ? RANGE_OPTIONS
    : RANGE_OPTIONS.filter((o) => o.key !== 'all');

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const select = (key) => {
    setShowCustom(false);
    onChange({ range: key, startDate: null, endDate: null });
    setOpen(false);
  };

  const openCustom = () => {
    const today = todayIST();
    setCustomStart(value?.startDate || today);
    setCustomEnd(value?.endDate || today);
    setShowCustom(true);
  };

  const applyCustom = () => {
    if (!customStart) return;
    onChange({
      range: 'custom',
      startDate: customStart,
      endDate: customEnd && customEnd >= customStart ? customEnd : customStart,
    });
    setOpen(false);
  };

  const quickPick = (label, start, end) => {
    const on = customStart === start && customEnd === end;
    return (
      <button
        key={label}
        type="button"
        onClick={() => { setCustomStart(start); setCustomEnd(end); }}
        className={`h-7 px-2.5 rounded-md text-xs font-medium transition-colors duration-150 ${on ? 'bg-[var(--blue-50)] text-[var(--blue)]' : 'bg-white border border-line text-ink-2 hover:border-gray-300'}`}
      >
        {label}
      </button>
    );
  };

  const today = todayIST();
  const isActive = (k) => value?.range === k;
  const itemCls = (on) =>
    `w-full flex items-center justify-between h-9 px-3 rounded-lg text-[13px] transition-colors duration-150 ${on ? 'bg-[var(--blue-50)] text-[var(--blue)] font-medium' : 'text-ink-2 hover:bg-gray-100 hover:text-ink'}`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="btn-secondary gap-2 pl-3 pr-2.5"
      >
        <span className="text-ink-3"><CalendarIco /></span>
        <span className="text-ink">{formatRangeLabel(value)}</span>
        <span className={`text-ink-3 transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`}><ChevronIco /></span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 top-full mt-1.5 z-40 bg-white rounded-xl shadow-lg border border-line w-[280px] p-1.5"
          >
            {options.map((o) => (
              <button key={o.key} role="menuitemradio" aria-checked={isActive(o.key)} onClick={() => select(o.key)} className={itemCls(isActive(o.key))}>
                {o.label}
                {isActive(o.key) && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </button>
            ))}
            <button role="menuitemradio" aria-checked={isActive('custom')} onClick={openCustom} className={itemCls(isActive('custom') || showCustom)}>
              Custom range…
            </button>
            {showCustom && (
              <div className="mt-1.5 p-3 rounded-lg bg-gray-50 border border-line-2 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {quickPick('Last 7 days', addDays(today, -6), today)}
                  {quickPick('Last 30 days', addDays(today, -29), today)}
                  {quickPick('This month', today.slice(0, 8) + '01', today)}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="block text-xs text-ink-3 mb-1">From</span>
                    <input type="date" value={customStart} max={customEnd || undefined}
                      onChange={(e) => setCustomStart(e.target.value)} className="form-input h-8 text-xs px-2" />
                  </label>
                  <label className="block">
                    <span className="block text-xs text-ink-3 mb-1">To</span>
                    <input type="date" value={customEnd} min={customStart || undefined}
                      onChange={(e) => setCustomEnd(e.target.value)} className="form-input h-8 text-xs px-2" />
                  </label>
                </div>
                <button onClick={applyCustom} className="btn-primary btn-sm w-full">Apply range</button>
              </div>
            )}
            <p className="px-3 pt-2 pb-1 text-[11.5px] text-ink-3">Dates are in IST</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
