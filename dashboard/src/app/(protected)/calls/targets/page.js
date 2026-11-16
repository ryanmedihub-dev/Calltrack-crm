'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../../lib/api';
import { getAllEmployeesSafe } from '../../../../lib/employees';
import { DataTable, TLFilter, Truncate } from '../../../../components/report-shared';

const AVATAR_COLORS = ['#2563EB','#16A34A','#D97706','#DC2626','#0D9488','#7C3AED'];

function ProgressBar({ value, max }) {
  const pct   = max ? Math.min(100, Math.round((value/max)*100)) : 0;
  const color = pct >= 100 ? '#16A34A' : pct >= 70 ? '#D97706' : '#2563EB';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background:'#E2E8F0' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width:`${pct}%`, background:color }}/>
      </div>
      <span className="text-xs font-bold w-9 text-right tabular-nums" style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function DailyTargetsPage() {
  const [employees,  setEmployees]  = useState([]);
  const [callCounts, setCallCounts] = useState({});
  const [editId,     setEditId]     = useState(null);
  const [editVal,    setEditVal]    = useState('');
  const [loading,    setLoading]    = useState(true);
  const [defTarget,  setDefTarget]  = useState(100);
  const [tlFilter,   setTlFilter]   = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [empRes, statsRes] = await Promise.all([
          getAllEmployeesSafe(api),
          api.get('/api/calls/stats'),
        ]);
        setEmployees(Array.isArray(empRes) ? empRes : (empRes?.data?.data || []));
        const counts = {};
        // employeeStats covers every employee with activity today, not just
        // the top-5 dialers topDialers is capped to — fixes most employees
        // showing 0 calls regardless of actual activity.
        (statsRes.data.data?.today?.employeeStats||[]).forEach(d=>{ counts[d.employeeId]=d.count; });
        setCallCounts(counts);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const applyTarget = async (id, val) => {
    const n = parseInt(val, 10);
    if (isNaN(n)||n<1) return toast.error('Enter a positive number');
    try {
      await api.patch(`/api/employees/${id}/target`, { dailyTarget:n });
      setEmployees(prev=>prev.map(e=>e._id===id?{...e,dailyTarget:n}:e));
      setEditId(null); toast.success('Target updated');
    } catch { toast.error('Failed to update target'); }
  };

  const setAllTargets = async () => {
    const n = parseInt(defTarget, 10);
    if (isNaN(n)||n<1) return toast.error('Enter a positive number');
    const targets = tlFilter ? employees.filter((e) => e.tlName === tlFilter) : employees;
    try {
      await Promise.all(targets.map(e=>api.patch(`/api/employees/${e._id}/target`,{dailyTarget:n})));
      const ids = new Set(targets.map((e) => e._id));
      setEmployees(prev=>prev.map(e=>ids.has(e._id)?{...e,dailyTarget:n}:e));
      toast.success(`Set ${n} calls target for ${targets.length} agent${targets.length === 1 ? '' : 's'}${tlFilter ? ` under ${tlFilter}` : ''}`);
    } catch { toast.error('Failed to set targets'); }
  };

  const getTarget = (emp) => emp.dailyTarget||100;

  const visibleEmployees = employees.filter((e) => !tlFilter || e.tlName === tlFilter);

  const totCalls   = visibleEmployees.reduce((a,e)=>a+(callCounts[e._id]||0),0);
  const totTargets = visibleEmployees.reduce((a,e)=>a+getTarget(e),0);
  const overallPct = totTargets ? Math.min(100, Math.round((totCalls/totTargets)*100)) : 0;
  const achieved   = visibleEmployees.filter(e=>(callCounts[e._id]||0)>=getTarget(e)).length;

  const summaryRows = visibleEmployees.map(emp => {
    const calls  = callCounts[emp._id]||0;
    const target = getTarget(emp);
    const gap    = Math.max(0,target-calls);
    const done   = calls >= target;
    return { ...emp, calls, target, gap, done };
  });

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-8 w-48 rounded-lg"/>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1,2,3,4].map(i=><div key={i} className="skeleton h-20 rounded-xl"/>)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Daily Targets</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>
            Set and track daily call quotas · {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TLFilter value={tlFilter} onChange={setTlFilter} />
          <input type="number" min="1" max="500" value={defTarget}
            onChange={e=>setDefTarget(e.target.value)}
            className="form-input w-20 text-center"/>
          <button onClick={setAllTargets} className="btn-primary">Set All</button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
        {[
          { label:'Total Calls',       value:totCalls,                           color:'#2563EB' },
          { label:'Total Target',      value:totTargets,                         color:'#475569' },
          { label:'Overall Progress',  value:`${overallPct}%`,                   color:overallPct>=100?'#16A34A':overallPct>=70?'#D97706':'#2563EB' },
          { label:'Targets Hit',       value:`${achieved} / ${employees.length}`, color:'#16A34A' },
        ].map(k=>(
          <div key={k.label} className="page-card p-4">
            <p className="text-2xl font-bold leading-none tabular-nums" style={{ color:k.color }}>{k.value}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider mt-1.5" style={{ color:'#94A3B8' }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Employee cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
        {visibleEmployees.length === 0 && (
          <div className="col-span-full text-center py-16 text-sm" style={{ color:'#94A3B8' }}>No employees found</div>
        )}
        {visibleEmployees.map((emp,i)=>{
          const calls  = callCounts[emp._id]||0;
          const target = getTarget(emp);
          const done   = calls >= target;
          return (
            <div key={emp._id} className="page-card p-5 transition-all"
              style={{ borderColor:done?'rgba(22,163,74,0.35)':'#E2E8F0' }}
              onMouseEnter={e=>e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.10)'}
              onMouseLeave={e=>e.currentTarget.style.boxShadow=''}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold select-none"
                    style={{ background:done?'#16A34A':AVATAR_COLORS[i%AVATAR_COLORS.length] }}>
                    {emp.name.slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm leading-none" style={{ color:'#0F172A' }}><Truncate text={emp.name} /></p>
                    {emp.tlName && <p className="text-[10px] mt-0.5" style={{ color:'#94A3B8' }}>TL: <Truncate text={emp.tlName} max={14} /></p>}
                    {done&&<span className="text-[10px] font-bold tracking-wide" style={{ color:'#16A34A' }}>TARGET MET ✓</span>}
                  </div>
                </div>

                {editId===emp._id ? (
                  <div className="flex items-center gap-1.5">
                    <input type="number" autoFocus value={editVal}
                      onChange={e=>setEditVal(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Enter')applyTarget(emp._id,editVal); if(e.key==='Escape')setEditId(null); }}
                      className="form-input w-16 text-center py-1.5 text-sm"/>
                    <button onClick={()=>applyTarget(emp._id,editVal)}
                      className="w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center text-white"
                      style={{ background:'#2563EB' }}>✓</button>
                    <button onClick={()=>setEditId(null)}
                      className="w-7 h-7 rounded-lg text-xs flex items-center justify-center"
                      style={{ background:'#F1F5F9', color:'#64748B', border:'1px solid #E2E8F0' }}>✕</button>
                  </div>
                ) : (
                  <button onClick={()=>{ setEditId(emp._id); setEditVal(String(target)); }}
                    className="text-xs px-2.5 py-1 rounded-lg transition-all"
                    style={{ border:'1px dashed #E2E8F0', color:'#64748B' }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='#BFDBFE';e.currentTarget.style.color='#2563EB';}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='#E2E8F0';e.currentTarget.style.color='#64748B';}}>
                    Edit
                  </button>
                )}
              </div>

              <div className="flex items-end justify-between mb-3">
                <span className="text-3xl font-black leading-none tabular-nums" style={{ color:'#0F172A' }}>{calls}</span>
                <span className="text-sm" style={{ color:'#94A3B8' }}>/ {target} calls</span>
              </div>
              <ProgressBar value={calls} max={target}/>
            </div>
          );
        })}
      </div>

      {/* Summary table */}
      <div className="page-card overflow-hidden">
        <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
          <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Summary</h3>
        </div>
        <div className="px-5 py-4">
          <DataTable
            rows={summaryRows}
            getRowId={(emp) => emp._id}
            emptyTitle="No employees found"
            columns={[
              { key: 'name', label: 'Agent', render: (emp) => <span className="font-medium" style={{ color:'#0F172A' }}><Truncate text={emp.name} /></span> },
              { key: 'tlName', label: 'TL', render: (emp) => emp.tlName ? <Truncate text={emp.tlName} max={14} /> : <span style={{ color:'#CBD5E1' }}>—</span> },
              { key: 'calls', label: 'Calls', align: 'right', render: (emp) => <span style={{ fontWeight:700, color:'#2563EB' }}>{emp.calls}</span> },
              { key: 'target', label: 'Target', align: 'right', render: (emp) => <span style={{ color:'#374151' }}>{emp.target}</span> },
              {
                key: 'gap', label: 'Gap', align: 'right',
                render: (emp) => <span style={{ fontWeight:600, color:emp.gap>0?'#EF4444':'#16A34A' }}>{emp.gap>0?`-${emp.gap}`:'✓'}</span>,
              },
              {
                key: 'done', label: 'Status', align: 'right', searchable: false,
                render: (emp) => (
                  <span className="badge text-[11px]"
                    style={emp.done
                      ? { background:'rgba(22,163,74,0.08)', color:'#16A34A', border:'1px solid rgba(22,163,74,0.22)' }
                      : { background:'rgba(217,119,6,0.08)', color:'#D97706', border:'1px solid rgba(217,119,6,0.22)' }}>
                    {emp.done?'Done':'In Progress'}
                  </span>
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
