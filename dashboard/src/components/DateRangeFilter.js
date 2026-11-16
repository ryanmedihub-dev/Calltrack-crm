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

  const quickPick = (label, start, end) => (
    <button
      key={label}
      onClick={() => { setCustomStart(start); setCustomEnd(end); }}
      className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors duration-150"
    >
      {label}
    </button>
  );

  const today = todayIST();

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm font-medium text-gray-700 transition-colors duration-200"
      >
        <CalendarIco />
        <span>{formatRangeLabel(value)}</span>
        <ChevronIco />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 top-full mt-2 z-30 bg-white rounded-xl shadow-2xl border border-gray-100 min-w-[260px] overflow-hidden"
          >
            {options.map((o) => (
              <button
                key={o.key}
                onClick={() => select(o.key)}
                className={`w-full text-left px-4 py-3 text-sm transition-colors duration-150 ${
                  value?.range === o.key
                    ? 'bg-blue-50 text-blue-600 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {o.label}
              </button>
            ))}
            <button
              onClick={openCustom}
              className={`w-full text-left px-4 py-3 text-sm border-t border-gray-100 transition-colors duration-150 ${
                value?.range === 'custom'
                  ? 'bg-blue-50 text-blue-600 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Custom Range
            </button>
            {showCustom && (
              <div className="p-4 border-t border-gray-100 bg-gray-50/60 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {quickPick('Last 7 days', addDays(today, -6), today)}
                  {quickPick('Last 30 days', addDays(today, -29), today)}
                  {quickPick('This month', today.slice(0, 8) + '01', today)}
                  {quickPick('This week', mondayOf(today), today)}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                      From
                    </label>
                    <input
                      type="date"
                      value={customStart}
                      max={customEnd || undefined}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                      To
                    </label>
                    <input
                      type="date"
                      value={customEnd}
                      min={customStart || undefined}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-200"
                    />
                  </div>
                </div>
                <button
                  onClick={applyCustom}
                  className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors duration-200"
                >
                  Apply
                </button>
              </div>
            )}
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/60">
              <p className="text-[10px] text-gray-400 font-medium">All dates in IST (Asia/Kolkata)</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
