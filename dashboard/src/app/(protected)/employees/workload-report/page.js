'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../../../lib/api';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const ActivityIco = ({s=16}) => <Ico size={s}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></Ico>;

const PERIODS = [{ key:'today',label:'Today' },{ key:'week',label:'This Week' },{ key:'month',label:'This Month' }];

const WORKLOAD_LEVELS = [
  { min:0,  max:10,  label:'Low',     color:'#94A3B8', bg:'#F1F5F9', border:'#CBD5E1' },
  { min:10, max:30,  label:'Moderate',color:'#D97706', bg:'#FFFBEB', border:'#FDE68A' },
  { min:30, max:60,  label:'High',    color:'#2563EB', bg:'#EFF6FF', border:'#BFDBFE' },
  { min:60, max:Infinity, label:'Very High', color:'#DC2626', bg:'#FFF1F2', border:'#FECACA' },
];

function getLevel(calls) {
  return WORKLOAD_LEVELS.find(l => calls >= l.min && calls < l.max) || WORKLOAD_LEVELS[0];
}

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg px-3 py-2 text-xs" style={{ background:'#0F172A', color:'#fff' }}>
    <p style={{ color:'#94A3B8' }}>{label}</p>
    {payload.map((p,i) => <p key={i} className="font-bold">{p.name}: {p.value}</p>)}
  </div>;
};

export default function WorkloadReportPage() {
  const [period,  setPeriod]  = useState('week');
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [empRes, statsRes] = await Promise.allSettled([
          api.get('/api/employees'),
          api.get('/api/calls/stats'),
        ]);
        const emps  = empRes.status==='fulfilled'  ? empRes.value.data?.data||[]  : [];
        const stats = statsRes.status==='fulfilled' ? statsRes.value.data?.data    : null;
        const periodKey = period==='today' ? 'topDialers' : period==='week' ? 'thisWeek' : 'thisMonth';
        const dialers   = stats?.today?.topDialers || stats?.[periodKey]?.topDialers || [];
        const processed = emps.map(e => {
          const dialer = dialers.find(d => d.employeeId===e._id);
          const calls  = dialer?.count||0;
          const level  = getLevel(calls);
          return { id:e._id, name:e.name, role:e.role||'Agent', calls, level };
        }).sort((a,b)=>b.calls-a.calls);
        setData(processed);
      } catch { setData([]); }
      setLoading(false);
    })();
  }, [period]);

  const maxCalls = data[0]?.calls||1;
  const totalCalls = data.reduce((s,d)=>s+d.calls,0);

  const levelSummary = WORKLOAD_LEVELS.slice(0,-1).map(l => ({
    ...l,
    count: data.filter(d => d.calls>=l.min && d.calls<l.max).length,
  }));

  const barData = data.slice(0,15).map(d => ({
    name: d.name.split(' ')[0],
    calls: d.calls,
    fill: d.level.color,
  }));

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Workload Report</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Employee call workload distribution and activity levels</p>
        </div>
        <div className="flex gap-0.5 p-1 rounded-xl" style={{ background:'#fff', border:'1px solid #E2E8F0' }}>
          {PERIODS.map(p=>(
            <button key={p.key} onClick={()=>setPeriod(p.key)}
              className="px-3 h-7 flex items-center rounded-lg text-xs font-semibold transition-all"
              style={period===p.key?{background:'#2563EB',color:'#fff',boxShadow:'0 2px 6px rgba(37,99,235,0.25)'}:{color:'#94A3B8'}}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger">
        {levelSummary.map((l,i)=>(
          <div key={l.label} className="page-card p-4 animate-fade-in-up" style={{ animationDelay:`${i*0.05}s`, borderLeft:`3px solid ${l.color}` }}>
            <p className="stat-number text-2xl" style={{ color:l.color }}>
              {loading?<span className="skeleton inline-block w-8 h-6 rounded"/>:l.count}
            </p>
            <p className="stat-label text-xs font-semibold">{l.label} Workload</p>
            <p className="text-[10px] mt-0.5" style={{ color:'#94A3B8' }}>{l.min}–{l.max=== Infinity?'∞':l.max} calls</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="page-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Top 15 by Call Volume</h3>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background:'#EFF6FF', color:'#2563EB' }}>
            {totalCalls} total calls
          </span>
        </div>
        {loading ? (
          <div className="skeleton h-48 rounded-xl"/>
        ) : barData.length === 0 ? (
          <div className="flex items-center justify-center h-36" style={{ color:'#94A3B8' }}>
            <span className="text-sm">No call data available</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, barData.length*28)}>
            <BarChart data={barData} barSize={20} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false}/>
              <XAxis type="number" tick={{ fontSize:10, fill:'#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false}/>
              <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'#475569', fontWeight:600 }} tickLine={false} axisLine={false} width={72}/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="calls" name="Calls" radius={[0,5,5,0]}>
                {barData.map((e,i)=><Cell key={i} fill={e.fill}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Full table */}
      <div className="page-card overflow-hidden">
        <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
          <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>All Employees Workload</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table" style={{ minWidth:520 }}>
            <thead><tr><th>Employee</th><th>Role</th><th style={{ textAlign:'right' }}>Calls</th><th>Share</th><th>Level</th></tr></thead>
            <tbody>
              {loading ? (
                Array.from({length:8}).map((_,i)=>(
                  <tr key={i}>{Array.from({length:5}).map((_,j)=><td key={j}><div className="skeleton h-4 rounded"/></td>)}</tr>
                ))
              ) : data.map((d,i) => (
                <tr key={d.id||i}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ background:'#2563EB' }}>{d.name.slice(0,2).toUpperCase()}</div>
                      <span className="font-semibold text-xs" style={{ color:'#0F172A' }}>{d.name}</span>
                    </div>
                  </td>
                  <td className="text-xs capitalize" style={{ color:'#64748B' }}>{d.role}</td>
                  <td style={{ textAlign:'right', fontWeight:700, color:'#0F172A' }}>{d.calls}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full overflow-hidden" style={{ background:'#E2E8F0' }}>
                        <div className="h-full rounded-full" style={{ width:`${(d.calls/maxCalls)*100}%`, background:d.level.color }}/>
                      </div>
                      <span className="text-[10px] tabular-nums" style={{ color:'#94A3B8' }}>{totalCalls>0?Math.round((d.calls/totalCalls)*100):0}%</span>
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={{ background:d.level.bg, color:d.level.color, border:`1px solid ${d.level.border}` }}>
                      {d.level.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
