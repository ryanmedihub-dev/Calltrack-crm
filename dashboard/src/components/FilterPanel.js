'use client';

/**
 * Reusable filter panel — Periodic Reports style.
 *
 * Props:
 *   fields   – array of field configs (see below)
 *   onApply  – called with the current values object when Apply is clicked
 *   onReset  – called when Reset is clicked
 *   extra    – optional JSX rendered below the filter rows (e.g. a checkbox)
 *
 * Field config shape:
 *   { key, label, type: 'date'|'datetime-local'|'select'|'text', options?, placeholder? }
 *
 * Usage:
 *   <FilterPanel
 *     fields={[
 *       { key:'from', label:'From Date', type:'datetime-local' },
 *       { key:'to',   label:'To Date',   type:'datetime-local' },
 *       { key:'employee', label:'Select Employee', type:'select', options:[{label:'All',value:''},...] },
 *     ]}
 *     onApply={vals => setFilters(vals)}
 *     onReset={() => setFilters(defaultFilters)}
 *   />
 */

import { useState } from 'react';

function Ico({ size=13, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const FilterIco = () => <Ico><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></Ico>;
const RefreshIco= () => <Ico><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></Ico>;

const MAX_PER_ROW = 5;

export default function FilterPanel({ fields = [], onApply, onReset, extra, defaultValues = {} }) {
  const [vals, setVals] = useState(() => {
    const init = {};
    fields.forEach(f => { init[f.key] = defaultValues[f.key] ?? ''; });
    return init;
  });

  const set = (key, value) => setVals(v => ({ ...v, [key]: value }));

  const handleApply = () => onApply?.(vals);
  const handleReset = () => {
    const reset = {};
    fields.forEach(f => { reset[f.key] = ''; });
    setVals(reset);
    onReset?.(reset);
  };

  // Split fields into rows of MAX_PER_ROW
  const rows = [];
  for (let i = 0; i < fields.length; i += MAX_PER_ROW) {
    rows.push(fields.slice(i, i + MAX_PER_ROW));
  }
  // Last field row always ends with Apply + Reset buttons
  const lastRow = rows[rows.length - 1] || [];

  return (
    <div className="filter-panel">
      {rows.map((row, ri) => (
        <div key={ri}>
          {ri > 0 && <div className="filter-panel-divider" />}
          <div className="filter-panel-row">
            {row.map(field => (
              <div key={field.key} className="filter-panel-field">
                <label>{field.label}</label>
                {field.type === 'select' ? (
                  <select
                    className="form-input text-sm"
                    value={vals[field.key]}
                    onChange={e => set(field.key, e.target.value)}
                  >
                    <option value="">Select</option>
                    {(field.options || []).map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type || 'text'}
                    className="form-input text-sm"
                    placeholder={field.placeholder || ''}
                    value={vals[field.key]}
                    onChange={e => set(field.key, e.target.value)}
                  />
                )}
              </div>
            ))}

            {/* Action buttons on last row */}
            {ri === rows.length - 1 && (
              <div className="flex items-end gap-2 flex-shrink-0">
                <button className="filter-apply-btn" onClick={handleApply}>
                  <FilterIco /> Apply
                </button>
                <button className="filter-reset-btn" onClick={handleReset}>
                  <RefreshIco /> Reset
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {extra && (
        <>
          <div className="filter-panel-divider" />
          {extra}
        </>
      )}
    </div>
  );
}
