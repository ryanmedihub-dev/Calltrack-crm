'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../../../../lib/api';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const StarIco    = ({s=14}) => <Ico size={s}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Ico>;
const ChevronIco = ({s=13}) => <Ico size={s}><polyline points="9 18 15 12 9 6"/></Ico>;

const PERIODS = [{ key:'today',label:'Today' },{ key:'week',label:'This Week' },{ key:'month',label:'This Month' }];

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg px-3 py-2 text-xs" style={{ background:'#0F172A', color:'#fff' }}>
    <p style={{ color:'#94A3B8' }}>{label}</p>
    {payload.map((p,i) => <p key={i} className="font-bold">{p.name}: {p.value}</p>)}
  </div>;
};

const RANK_COLORS = ['#F59E0B','#94A3B8','#B45309'];
const RANK_BG     = ['rgba(245,158,11,0.12)','rgba(148,163,184,0.12)','rgba(180,83,9,0.12)'];
const MEDALS      = ['🥇','🥈','🥉'];

export default function PerformanceReportsPage() {
  const [period,  setPeriod]  = useState('week');
  const [dialers, setDialers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats,   setStats]   = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get('/api/calls/stats');
        const d = r.data?.data;
        setStats(d);
        const key = period==='today'?'today':period==='week'?'thisWeek':'thisMonth';
        setDialers(d?.[key]?.topDialers||d?.today?.topDialers||[]);
      } catch { setDialers([]); }
      setLoading(false);
    })();
  }, [period]);

  const maxCalls   = dialers[0]?.count||1;
  const totalCalls = dialers.reduce((s,d)=>s+d.count,0)||1;

  const barData = dialers.slice(0,12).map(d=>({
    name: (d.name||'').split(' ')[0],
    calls: d.count,
    id: d.employeeId,
  }));

  const GRADIENT_COLORS = ['#2563EB','#3B82F6','#60A5FA','#93C5FD','#BFDBFE'].reverse();

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Performance Reports</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Consolidated performance rankings across all employees</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 p-1 rounded-xl" style={{ background:'#fff', border:'1px solid #E2E8F0' }}>
            {PERIODS.map(p=>(
              <button key={p.key} onClick={()=>setPeriod(p.key)}
                className="px-3 h-7 flex items-center rounded-lg text-xs font-semibold transition-all"
                style={period===p.key?{background:'#2563EB',color:'#fff',boxShadow:'0 2px 6px rgba(37,99,235,0.25)'}:{color:'#94A3B8'}}>
                {p.label}
              </button>
            ))}
          </div>
          <Link href="/employees/performance-report" className="btn-secondary text-xs py-1.5 px-3">
            Individual Report
          </Link>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger">
        {[
          { label:'Active Agents',  val:dialers.length,             color:'#2563EB', bg:'#EFF6FF' },
          { label:'Total Calls',    val:dialers.reduce((s,d)=>s+d.count,0), color:'#16A34A', bg:'#F0FDF4' },
          { label:'Avg per Agent',  val:dialers.length?Math.round(dialers.reduce((s,d)=>s+d.count,0)/dialers.length):0, color:'#D97706', bg:'#FFFBEB' },
          { label:'Top Performer',  val:dialers[0]?.count||0,       color:'#F59E0B', bg:'#FFFBEB' },
        ].map((k,i)=>(
          <div key={k.label} className="page-card p-4 animate-fade-in-up" style={{ animationDelay:`${i*0.05}s` }}>
            <p className="stat-number text-2xl" style={{ color:k.color }}>
              {loading?<span className="skeleton inline-block w-10 h-6 rounded"/>:k.val}
            </p>
            <p className="stat-label text-[10px] uppercase tracking-wider">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Top 3 podium */}
      {!loading && dialers.length >= 3 && (
        <div className="page-card p-8">
          <p className="text-xs font-bold text-center uppercase tracking-widest mb-8" style={{ color:'#94A3B8' }}>Top Performers</p>
          <div className="flex items-end justify-center gap-8">
            {[
              dialers[1] ? { ...dialers[1], rank:2 } : null,
              dialers[0] ? { ...dialers[0], rank:1 } : null,
              dialers[2] ? { ...dialers[2], rank:3 } : null,
            ].filter(Boolean).map(d => {
              const heights = { 1:'8rem', 2:'5.5rem', 3:'4rem' };
              const grads   = {
                1:'linear-gradient(135deg,#F59E0B,#D97706)',
                2:'linear-gradient(135deg,#94A3B8,#64748B)',
                3:'linear-gradient(135deg,#FB923C,#F97316)',
              };
              return (
                <div key={d.employeeId} className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-md"
                      style={{ background:grads[d.rank] }}>
                      {(d.name||'?').slice(0,2).toUpperCase()}
                    </div>
                    <span className="absolute -top-2 -right-2 text-xl">{MEDALS[d.rank-1]}</span>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold max-w-[80px] truncate" style={{ color:'#0F172A' }}>{d.name}</p>
                    <span className="text-[10px] font-bold rounded-full px-2 py-0.5"
                      style={{ background:RANK_BG[d.rank-1], color:RANK_COLORS[d.rank-1] }}>
                      {d.count} calls
                    </span>
                  </div>
                  <div className="w-20 rounded-t-xl opacity-20" style={{ height:heights[d.rank], background:grads[d.rank] }}/>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Horizontal bar chart */}
      {!loading && barData.length > 0 && (
        <div className="page-card p-5">
          <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Call Volume — Top 12</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, barData.length*32)}>
            <BarChart data={barData} barSize={20} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false}/>
              <XAxis type="number" tick={{ fontSize:10, fill:'#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false}/>
              <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'#475569', fontWeight:600 }} tickLine={false} axisLine={false} width={72}/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="calls" name="Calls" radius={[0,5,5,0]}>
                {barData.map((_,i) => <Cell key={i} fill={GRADIENT_COLORS[Math.min(i, GRADIENT_COLORS.length-1)]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Full rankings */}
      <div className="page-card overflow-hidden">
        <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
          <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Full Rankings</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table" style={{ minWidth:520 }}>
            <thead><tr><th>Rank</th><th>Agent</th><th style={{ textAlign:'right' }}>Calls</th><th>Share</th><th>Action</th></tr></thead>
            <tbody>
              {loading ? (
                Array.from({length:8}).map((_,i)=>(
                  <tr key={i}>{Array.from({length:5}).map((_,j)=><td key={j}><div className="skeleton h-4 rounded"/></td>)}</tr>
                ))
              ) : dialers.length===0 ? (
                <tr><td colSpan={5}>
                  <div className="flex flex-col items-center py-14 gap-2">
                    <StarIco s={24}/>
                    <p className="text-sm" style={{ color:'#94A3B8' }}>No performance data for this period</p>
                  </div>
                </td></tr>
              ) : dialers.map((d,i)=>(
                <tr key={d.employeeId||i}>
                  <td className="w-12">
                    {i<3 ? <span className="text-lg">{MEDALS[i]}</span>
                         : <span className="font-bold text-xs" style={{ color:'#94A3B8' }}>#{i+1}</span>}
                  </td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ background:'#2563EB' }}>
                        {(d.name||'?').slice(0,2).toUpperCase()}
                      </div>
                      <span className="font-semibold text-sm" style={{ color:'#0F172A' }}>{d.name||'Unknown'}</span>
                    </div>
                  </td>
                  <td style={{ textAlign:'right', fontWeight:700, color:'#2563EB' }}>{d.count}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full overflow-hidden" style={{ background:'#E2E8F0' }}>
                        <div className="h-full rounded-full" style={{ width:`${(d.count/maxCalls)*100}%`, background:'#2563EB' }}/>
                      </div>
                      <span className="text-[10px] tabular-nums" style={{ color:'#94A3B8' }}>{Math.round((d.count/totalCalls)*100)}%</span>
                    </div>
                  </td>
                  <td>
                    <Link href={`/employees/performance-report?emp=${d.employeeId}`}
                      className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded transition-all"
                      style={{ color:'#2563EB' }}>
                      Detail <ChevronIco s={11}/>
                    </Link>
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
