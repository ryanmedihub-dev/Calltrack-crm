'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '../../../../lib/api';
import useIsAdmin from '../../../../lib/useIsAdmin';
import { getAllEmployeesSafe } from '../../../../lib/employees';
import { DataTable, TLFilter, PageHeader, fmtNum, Skeleton } from '../../../../components/report-shared';

// `b` may hold several team leads from the multi-select ("Rahul,Priya").
const sameTL = (a, b) => String(b || '').split(',').some((t) => (a || '').trim().toLowerCase() === t.trim().toLowerCase());

// Click-to-edit target cell (admins only). Enter saves, Escape cancels.
function TargetCell({ emp, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(emp.target));
  const [saving, setSaving] = useState(false);
  useEffect(() => setVal(String(emp.target)), [emp.target]);
  const commit = async () => {
    if (val === String(emp.target)) { setEditing(false); return; }
    setSaving(true);
    const ok = await onSave(emp._id, val);
    setSaving(false);
    if (ok) setEditing(false);
  };
  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} title="Edit target"
        className="inline-flex items-center gap-1.5 h-7 px-2 -mr-2 rounded-md tabular-nums text-ink hover:bg-gray-100 transition-colors">
        {fmtNum(emp.target)}
        <svg className="text-ink-4" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 justify-end">
      <input type="number" min="1" autoFocus value={val} disabled={saving} aria-label={`Daily target for ${emp.name}`}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setVal(String(emp.target)); setEditing(false); } }}
        className="form-input h-8 w-20 text-right tabular-nums" />
      <button onClick={commit} disabled={saving} className="btn-primary btn-sm">{saving ? '…' : 'Save'}</button>
    </span>
  );
}

export default function DailyTargetsPage() {
  const isAdmin = useIsAdmin();
  const [employees, setEmployees] = useState([]);
  const [callCounts, setCallCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [defTarget, setDefTarget] = useState(100);
  const [tlFilter, setTlFilter] = useState('');
  const [settingAll, setSettingAll] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [empRes, statsRes] = await Promise.all([getAllEmployeesSafe(api), api.get('/api/calls/stats')]);
        setEmployees(Array.isArray(empRes) ? empRes : (empRes?.data?.data || []));
        const counts = {};
        // employeeStats covers every employee with activity today, not just the top five.
        (statsRes.data.data?.today?.employeeStats || []).forEach((d) => { counts[d.employeeId] = d.count; });
        setCallCounts(counts);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const applyTarget = async (id, val) => {
    const n = parseInt(val, 10);
    if (Number.isNaN(n) || n < 1) { toast.error('Enter a whole number above 0'); return false; }
    try {
      await api.patch(`/api/employees/${id}/target`, { dailyTarget: n });
      setEmployees((prev) => prev.map((e) => (e._id === id ? { ...e, dailyTarget: n } : e)));
      toast.success('Target updated');
      return true;
    } catch { toast.error('Couldn’t update the target'); return false; }
  };

  const visible = useMemo(() => employees.filter((e) => e.isActive !== false && (!tlFilter || sameTL(e.tlName, tlFilter))), [employees, tlFilter]);

  const setAllTargets = async () => {
    const n = parseInt(defTarget, 10);
    if (Number.isNaN(n) || n < 1) return toast.error('Enter a whole number above 0');
    if (!window.confirm(`Set a daily target of ${n} calls for ${visible.length} agent${visible.length === 1 ? '' : 's'}${tlFilter ? ` under ${tlFilter}` : ''}?`)) return;
    setSettingAll(true);
    try {
      await Promise.all(visible.map((e) => api.patch(`/api/employees/${e._id}/target`, { dailyTarget: n })));
      const ids = new Set(visible.map((e) => e._id));
      setEmployees((prev) => prev.map((e) => (ids.has(e._id) ? { ...e, dailyTarget: n } : e)));
      toast.success(`Target set to ${n} for ${visible.length} agents`);
    } catch { toast.error('Some targets couldn’t be updated'); }
    setSettingAll(false);
  };

  const rows = visible.map((e) => {
    const calls = callCounts[e._id] || 0;
    const target = e.dailyTarget || 100;
    return { ...e, calls, target, gap: Math.max(0, target - calls), pct: Math.round((calls / target) * 100), done: calls >= target };
  }).sort((a, b) => a.done - b.done || b.pct - a.pct);

  const totCalls = rows.reduce((a, r) => a + r.calls, 0);
  const totTarget = rows.reduce((a, r) => a + r.target, 0);
  const hit = rows.filter((r) => r.done).length;
  const started = rows.filter((r) => r.calls > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily targets"
        description={`Today’s calls against each agent’s quota · ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' })}`}
        actions={<TLFilter value={tlFilter} onChange={setTlFilter} />}
      />

      <section className="panel overflow-hidden" aria-label="Summary">
        <div className="grid grid-cols-2 md:grid-cols-4 [&>*]:border-line-2 [&>*]:border-b md:[&>*]:border-b-0 md:divide-x divide-line-2">
          {[
            ['Calls today', fmtNum(totCalls), `of ${fmtNum(totTarget)} target`],
            ['Team progress', `${totTarget ? Math.round((totCalls / totTarget) * 100) : 0}%`, `${fmtNum(Math.max(0, totTarget - totCalls))} still needed`],
            ['Targets hit', `${fmtNum(hit)}`, `of ${fmtNum(rows.length)} active agents`],
            ['Not started', `${fmtNum(rows.length - started)}`, 'agents with no calls today'],
          ].map(([l, v, s], i) => (
            <div key={l} className="px-5 py-4">
              <p className="stat-label">{l}</p>
              {loading ? <Skeleton className="h-7 w-16 mt-2" /> : <p className={`stat-number mt-1 ${i === 2 && hit ? 'text-met' : ''}`}>{v}</p>}
              <p className="text-xs text-ink-3 mt-1">{s}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel" aria-label="Agents">
        <div className="panel-head flex-wrap">
          <div><h2 className="panel-title">Agents</h2><p className="panel-sub">Behind target first{isAdmin ? ' · click a target to change it' : ''}</p></div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <label className="text-[13px] text-ink-3" htmlFor="set-all">Set everyone{tlFilter ? ` under ${tlFilter}` : ''} to</label>
              <input id="set-all" type="number" min="1" max="500" value={defTarget} onChange={(e) => setDefTarget(e.target.value)} className="form-input h-8 w-20 text-right tabular-nums" />
              <button onClick={setAllTargets} disabled={settingAll || !visible.length} className="btn-secondary btn-sm">{settingAll ? 'Saving…' : 'Apply'}</button>
            </div>
          )}
        </div>
        <div className="p-4 pt-3">
          <DataTable
            loading={loading}
            rows={rows}
            pageSize={25}
            getRowId={(e) => e._id}
            emptyTitle={tlFilter ? `No active agents under ${tlFilter}` : 'No active agents'}
            columns={[
              {
                key: 'name', label: 'Agent', width: '28%',
                filterValue: (e) => `${e.name} ${e.tlName || ''}`,
                render: (e) => (
                  <Link href={`/employees/${e._id}`} className="block min-w-0 group/a">
                    <span className="block font-medium text-ink truncate group-hover/a:text-[var(--blue)]">{e.name}</span>
                    <span className="block text-xs text-ink-3 truncate">{e.tlName ? `TL ${e.tlName}` : 'No team lead'}</span>
                  </Link>
                ),
              },
              {
                key: 'pct', label: 'Progress', width: '34%', searchable: false,
                render: (e) => (
                  <div className="flex items-center gap-3">
                    <span className="progress-bar flex-1"><span className="progress-fill block" style={{ width: `${Math.min(100, e.pct)}%`, background: e.done ? 'var(--met)' : 'var(--blue)' }} /></span>
                    <span className={`w-11 text-right text-xs tabular-nums ${e.done ? 'text-met font-medium' : 'text-ink-3'}`}>{e.pct}%</span>
                  </div>
                ),
              },
              { key: 'calls', label: 'Calls', align: 'right', width: '10%', searchable: false, render: (e) => <span className={e.calls ? 'font-semibold text-ink' : 'text-ink-4'}>{fmtNum(e.calls)}</span> },
              { key: 'gap', label: 'To go', align: 'right', width: '10%', searchable: false, render: (e) => (e.done ? <span className="text-met font-medium">Done</span> : fmtNum(e.gap)) },
              { key: 'target', label: 'Target', align: 'right', width: '18%', searchable: false, render: (e) => (isAdmin ? <TargetCell emp={e} onSave={applyTarget} /> : <span className="tabular-nums">{fmtNum(e.target)}</span>) },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
