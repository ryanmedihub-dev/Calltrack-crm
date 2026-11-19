'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Searchable dropdown for filters. `value` is a comma-separated string ('' = all) so pages keep
// their existing string state and send it straight to the API as `a,b,c`.
// multiple={false} gives a searchable single-choice picker with the same look.
const norm = (o) => (Array.isArray(o) ? { value: String(o[0]), label: String(o[1]) }
  : typeof o === 'object' ? { value: String(o.value), label: String(o.label ?? o.value) }
  : { value: String(o), label: String(o) });

export default function MultiSelect({
  options = [], value = '', onChange, placeholder = 'All', multiple = true,
  clearable = true, className = '', ariaLabel, disabled = false, noun = 'selected',
}) {
  const opts = useMemo(() => options.map(norm), [options]);
  const selected = useMemo(() => (value ? String(value).split(',').filter(Boolean) : []), [value]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  const pop = useRef(null);
  const list = useRef(null);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? opts.filter((o) => o.label.toLowerCase().includes(s)) : opts;
  }, [opts, q]);

  const place = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const w = Math.max(r.width, 240);
    const left = Math.min(r.left, window.innerWidth - w - 8);
    const below = window.innerHeight - r.bottom;
    const up = below < 300 && r.top > below;
    setPos({ left, width: w, ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) });
  };

  useEffect(() => {
    if (!open) return;
    place();
    setActive(0);
    const onDown = (e) => { if (!pop.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false); };
    const onMove = (e) => { if (!pop.current?.contains(e.target)) place(); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  useEffect(() => { if (!open) setQ(''); }, [open]);

  // Latest selection, updated on every emit, so rapid clicks before the parent re-renders
  // build on each other instead of on a stale `value`.
  const cur = useRef(selected);
  cur.current = selected;
  const emit = (arr) => { cur.current = arr; onChange(arr.join(',')); };
  const toggle = (v) => {
    if (!multiple) { onChange(v); setOpen(false); btn.current?.focus(); return; }
    const s = cur.current;
    emit(s.includes(v) ? s.filter((x) => x !== v) : [...s, v]);
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); btn.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) toggle(shown[active].value); }
  };

  useEffect(() => { list.current?.children[active]?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const labelOf = (v) => opts.find((o) => o.value === v)?.label ?? v;
  const text = selected.length === 0 ? placeholder : labelOf(selected[0]);
  const fullTitle = selected.length > 1 ? `${selected.length} ${noun}: ${selected.map(labelOf).join(', ')}` : undefined;

  return (
    <>
      <button ref={btn} type="button" disabled={disabled} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); } }}
        title={fullTitle}
        className={`form-input flex items-center gap-2 text-left pr-2 ${className}`}>
        <span className={`flex-1 truncate ${selected.length ? 'text-ink' : 'text-ink-2'}`}>{text}</span>
        {multiple && selected.length > 1 && (
          <span className="shrink-0 h-5 min-w-5 px-1.5 rounded-md bg-[var(--blue-50)] text-[var(--blue-600)] text-xs font-medium inline-flex items-center justify-center tabular-nums">+{selected.length - 1}</span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-ink-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden><polyline points="6 9 12 15 18 9" /></svg>
      </button>

      {open && pos && createPortal(
        // React events bubble through portals; keep clicks here from reaching row/overlay handlers.
        <div ref={pop} onKeyDown={onKey} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} style={{ position: 'fixed', zIndex: 70, ...pos, transformOrigin: pos.bottom != null ? 'bottom' : 'top' }}
          className="popover flex flex-col overflow-hidden">
          <div className="p-2 border-b border-line-2">
            <div className="relative">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} placeholder="Search…"
                aria-label="Search options" className="form-input h-8 pl-8 text-[13px]" />
            </div>
          </div>
          <ul ref={list} role="listbox" aria-multiselectable={multiple} className="max-h-64 overflow-y-auto py-1">
            {shown.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-ink-3">No matches</li>}
            {shown.map((o, i) => {
              const on = selected.includes(o.value) || (!multiple && value === o.value);
              return (
                <li key={o.value} role="option" aria-selected={on}
                  onMouseEnter={() => setActive(i)} onClick={() => toggle(o.value)}
                  className={`mx-1 px-2.5 h-8 rounded-md flex items-center gap-2.5 text-[13px] cursor-pointer ${i === active ? 'bg-gray-100' : ''} ${on ? 'text-ink font-medium' : 'text-ink-2'}`}>
                  {multiple ? (
                    <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors duration-100 ${on ? 'bg-[var(--blue)] border-[var(--blue)]' : 'border-gray-300 bg-white'}`}>
                      {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>}
                    </span>
                  ) : (
                    <span className="w-4 shrink-0 text-[var(--blue)]">
                      {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>}
                    </span>
                  )}
                  <span className="truncate">{o.label}</span>
                </li>
              );
            })}
          </ul>
          {(multiple || (clearable && value)) && (
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-t border-line-2 text-[12.5px]">
              {multiple
                ? <button type="button" className="btn-ghost btn-sm" onClick={() => emit([...new Set([...cur.current, ...shown.map((o) => o.value)])])}>
                    {q ? `Select ${shown.length} shown` : 'Select all'}
                  </button>
                : <span />}
              {clearable && <button type="button" className="btn-ghost btn-sm" disabled={!selected.length} onClick={() => { onChange(''); if (!multiple) setOpen(false); }}>Clear</button>}
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
