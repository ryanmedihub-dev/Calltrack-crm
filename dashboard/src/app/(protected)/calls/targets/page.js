'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../../lib/api';
import { SkeletonTable } from '../../../../components/Skeleton';

function ProgressBar({ value, max }) {
  const pct   = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = pct >= 100 ? '#10B981' : pct >= 70 ? '#F59E0B' : '#1A6BFF';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold w-8 text-right tabular-nums" style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function DailyTargetsPage() {
  const [employees,  setEmployees]  = useState([]);
  const [callCounts, setCallCounts] = useState({});
  const [editId,     setEditId]     = useState(null);
  const [editVal,    setEditVal]    = useState('');
  const [loading,    setLoading]    = useState(true);
  const [defTarget,  setDefTarget]  = useState(50);

  useEffect(() => {
    (async () => {
      try {
        const [empRes, statsRes] = await Promise.all([
          api.get('/api/employees'),
          api.get('/api/calls/stats'),
        ]);
        setEmployees(empRes.data.data || []);
        const counts = {};
        (statsRes.data.data?.today?.topDialers || []).forEach(d => {
          counts[d.employeeId] = d.count;
        });
        setCallCounts(counts);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const applyTarget = async (id, val) => {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 1) return toast.error('Enter a positive number');
    try {
      const res = await api.patch(`/api/employees/${id}/target`, { dailyTarget: n });
      setEmployees(prev => prev.map(e => e._id === id ? { ...e, dailyTarget: n } : e));
      setEditId(null);
      toast.success('Target updated');
    } catch { toast.error('Failed to update target'); }
  };

  const setAllTargets = async () => {
    const n = parseInt(defTarget, 10);
    if (isNaN(n) || n < 1) return toast.error('Enter a positive number');
    try {
      await Promise.all(employees.map(e => api.patch(`/api/employees/${e._id}/target`, { dailyTarget: n })));
      setEmployees(prev => prev.map(e => ({ ...e, dailyTarget: n })));
      toast.success(`Set ${n} calls target for all ${employees.length} agents`);
    } catch { toast.error('Failed to set targets'); }
  };

  const getTarget = (emp) => emp.dailyTarget || 50;

  const totCalls   = Object.values(callCounts).reduce((a, b) => a + b, 0);
  const totTargets = employees.reduce((a, e) => a + getTarget(e), 0);
  const overallPct = totTargets ? Math.min(100, Math.round((totCalls / totTargets) * 100)) : 0;
  const achieved   = employees.filter(e => (callCounts[e._id] || 0) >= getTarget(e)).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-textPrimary">Daily Targets</h2>
          <p className="text-textMuted text-sm mt-0.5">Track team call targets</p>
        </div>
        <SkeletonTable />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-textPrimary">Daily Targets</h2>
          <p className="text-textMuted text-sm mt-0.5">
            Set and track daily call quotas · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number" min="1" max="500" value={defTarget}
            onChange={e => setDefTarget(e.target.value)}
            className="w-20 border border-border rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-bg"
          />
          <button onClick={setAllTargets}
            className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primaryDk transition-colors">
            Set All
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Calls',       value: totCalls },
          { label: 'Total Target',      value: totTargets },
          { label: 'Overall Progress',  value: `${overallPct}%` },
          { label: 'Targets Hit',       value: `${achieved} / ${employees.length}` },
        ].map(k => (
          <div key={k.label} className="bg-white border border-border rounded-2xl p-4 shadow-card">
            <p className="text-2xl font-bold text-textPrimary leading-none">{k.value}</p>
            <p className="text-xs text-textMuted font-medium uppercase tracking-wide mt-1.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Employee Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {employees.length === 0 && (
          <div className="col-span-full text-center py-16 text-textMuted">No employees found</div>
        )}
        {employees.map(emp => {
          const calls  = callCounts[emp._id] || 0;
          const target = getTarget(emp);
          const done   = calls >= target;
          return (
            <div key={emp._id}
              className={`bg-white rounded-2xl p-5 shadow-card transition-shadow hover:shadow-card-md border ${done ? 'border-green-300' : 'border-border'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold select-none ${done ? 'bg-gradient-to-br from-green-400 to-emerald-600' : 'bg-gradient-to-br from-primary to-purple-500'}`}>
                    {emp.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-textPrimary text-sm leading-none">{emp.name}</p>
                    {done && <span className="text-[10px] text-green-600 font-bold tracking-wide">TARGET MET ✓</span>}
                  </div>
                </div>

                {editId === emp._id ? (
                  <div className="flex items-center gap-1.5">
                    <input type="number" autoFocus value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') applyTarget(emp._id, editVal);
                        if (e.key === 'Escape') setEditId(null);
                      }}
                      className="w-16 border border-primary rounded-lg px-2 py-1 text-sm text-center focus:outline-none" />
                    <button onClick={() => applyTarget(emp._id, editVal)}
                      className="w-7 h-7 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primaryDk flex items-center justify-center">✓</button>
                    <button onClick={() => setEditId(null)}
                      className="w-7 h-7 bg-bg border border-border text-textMuted rounded-lg text-xs hover:border-danger hover:text-danger flex items-center justify-center">✕</button>
                  </div>
                ) : (
                  <button onClick={() => { setEditId(emp._id); setEditVal(String(target)); }}
                    className="text-xs text-textMuted hover:text-primary transition-colors border border-dashed border-border hover:border-primary px-2.5 py-1 rounded-lg">
                    Edit
                  </button>
                )}
              </div>

              <div className="flex items-end justify-between mb-3">
                <span className="text-3xl font-black text-textPrimary leading-none tabular-nums">{calls}</span>
                <span className="text-sm text-textMuted">/ {target} calls</span>
              </div>
              <ProgressBar value={calls} max={target} />
            </div>
          );
        })}
      </div>

      {/* Summary Table */}
      <div className="bg-white border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-bold text-textPrimary">Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg border-b border-border">
                {['Agent', 'Calls', 'Target', 'Gap', 'Status'].map((h, i) => (
                  <th key={h} className={`px-5 py-3 text-xs font-semibold text-textMuted uppercase tracking-wide ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.map(emp => {
                const calls  = callCounts[emp._id] || 0;
                const target = getTarget(emp);
                const gap    = Math.max(0, target - calls);
                const done   = calls >= target;
                return (
                  <tr key={emp._id} className="hover:bg-bg transition-colors">
                    <td className="px-5 py-3 font-medium text-textPrimary">{emp.name}</td>
                    <td className="px-5 py-3 text-right font-bold text-textPrimary tabular-nums">{calls}</td>
                    <td className="px-5 py-3 text-right text-textSecondary tabular-nums">{target}</td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums" style={{ color: gap > 0 ? '#EF4444' : '#10B981' }}>
                      {gap > 0 ? `-${gap}` : '✓'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${done ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                        {done ? 'Done' : 'In Progress'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
