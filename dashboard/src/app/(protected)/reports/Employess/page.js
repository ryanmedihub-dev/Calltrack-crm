'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../../../lib/api';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const DownloadIco = ({s=13}) => <Ico size={s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Ico>;
const UsersIco    = ({s=20}) => <Ico size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Ico>;

const PERIODS = [{ k:'today',l:'Today' },{ k:'week',l:'This Week' },{ k:'month',l:'This Month' }];

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg px-3 py-2 text-xs" style={{ background:'#0F172A', color:'#fff' }}>
    <p style={{ color:'#94A3B8' }}>{label}</p>
    {payload.map((p,i) => <p key={i} className="font-bold">{p.name}: {p.value}</p>)}
  </div>;
};

const MEDALS = ['🥇','🥈','🥉'];

export default function EmployeesReportPage() {
  const [period,    setPeriod]    = useState('week');
  const [employees, setEmployees] = useState([]);
  const [dialers,   setDialers]   = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [empRes, statsRes] = await Promise.allSettled([
          api.get('/api/employees'),
          api.get('/api/calls/stats'),
        ]);
        const emps   = empRes.status==='fulfilled'  ? empRes.value.data?.data||[]  : [];
        const stats  = statsRes.status==='fulfilled' ? statsRes.value.data?.data    : null;
        setEmployees(emps);
        const key = period==='today'?'today':period==='week'?'thisWeek':'thisMonth';
        setDialers(stats?.[key]?.topDialers||stats?.today?.topDialers||[]);
      } catch {}
      setLoading(false);
    })();
  }, [period]);

  const total     = dialers.reduce((s,d)=>s+d.count,0)||1;
  const maxCalls  = dialers[0]?.count||1;
  const barData   = dialers.slice(0,12).map(d=>({ name:(d.name||'').split(' ')[0], calls:d.count }));

  const exportCSV = () => {
    const rows = [['Rank','Name','Calls','Share %'],...dialers.map((d,i)=>[i+1,d.name,d.count,Math.round((d.count/total)*100)])];
    const csv  = rows.map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href=url; a.download='employees-report.csv'; a.click();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Employees Report</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Employee call activity, rankings, and performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 p-1 rounded-xl" style={{ background:'#fff', border:'1px solid #E2E8F0' }}>
            {PERIODS.map(p=>(
              <button key={p.k} onClick={()=>setPeriod(p.k)}
                className="px-3 h-7 flex items-center rounded-lg text-xs font-semibold transition-all"
                style={period===p.k?{background:'#2563EB',color:'#fff',boxShadow:'0 2px 6px rgba(37,99,235,0.25)'}:{color:'#94A3B8'}}>
                {p.l}
              </button>
            ))}
          </div>
          <button onClick={exportCSV} className="btn-secondary text-xs py-1.5 px-3"><DownloadIco/> Export</button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger">
        {[
          { label:'Total Employees', val:employees.length,                             color:'#2563EB', bg:'#EFF6FF' },
          { label:'Active Callers',  val:dialers.filter(d=>d.count>0).length,          color:'#16A34A', bg:'#F0FDF4' },
          { label:'Total Calls',     val:dialers.reduce((s,d)=>s+d.count,0),           color:'#D97706', bg:'#FFFBEB' },
          { label:'Avg per Caller',  val:dialers.length?Math.round(dialers.reduce((s,d)=>s+d.count,0)/dialers.length):0, color:'#7C3AED', bg:'#F5F3FF' },
        ].map((k,i)=>(
          <div key={k.label} className="page-card p-4 animate-fade-in-up" style={{ animationDelay:`${i*0.05}s` }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background:k.bg, color:k.color }}>
              <UsersIco s={14}/>
            </div>
            <p className="stat-number text-2xl">
              {loading?<span className="skeleton inline-block w-10 h-6 rounded"/>:k.val}
            </p>
            <p className="stat-label text-[10px] uppercase tracking-wider">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      {!loading && barData.length > 0 && (
        <div className="page-card p-5">
          <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Top Employees by Calls</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, barData.length*30)}>
            <BarChart data={barData} barSize={22} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false}/>
              <XAxis type="number" tick={{ fontSize:10, fill:'#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false}/>
              <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'#475569', fontWeight:600 }} tickLine={false} axisLine={false} width={72}/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="calls" name="Calls" fill="#2563EB" radius={[0,5,5,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Full table */}
      <div className="page-card overflow-hidden">
        <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
          <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Full Employee Rankings</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table" style={{ minWidth:560 }}>
            <thead><tr><th>Rank</th><th>Employee</th><th style={{ textAlign:'right' }}>Calls</th><th>Share</th><th>Status</th></tr></thead>
            <tbody>
              {loading ? (
                Array.from({length:8}).map((_,i)=>(
                  <tr key={i}>{Array.from({length:5}).map((_,j)=><td key={j}><div className="skeleton h-4 rounded"/></td>)}</tr>
                ))
              ) : dialers.length===0 ? (
                <tr><td colSpan={5}>
                  <div className="flex flex-col items-center py-14 gap-2">
                    <UsersIco s={28}/>
                    <p className="text-sm" style={{ color:'#94A3B8' }}>No data for this period</p>
                  </div>
                </td></tr>
              ) : dialers.map((d,i)=>{
                const share = Math.round((d.count/total)*100);
                const emp   = employees.find(e=>e._id===d.employeeId);
                return (
                  <tr key={d.employeeId||i}>
                    <td className="w-12">
                      {i<3?<span className="text-lg">{MEDALS[i]}</span>:<span className="font-bold text-xs" style={{ color:'#94A3B8' }}>#{i+1}</span>}
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ background:'linear-gradient(135deg,#2563EB,#60A5FA)' }}>
                          {(d.name||'?').slice(0,2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-xs" style={{ color:'#0F172A' }}>{d.name||'Unknown'}</p>
                          <p className="text-[10px] capitalize" style={{ color:'#94A3B8' }}>{emp?.role||'Agent'}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign:'right', fontWeight:700, color:'#2563EB' }}>{d.count}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full overflow-hidden" style={{ background:'#E2E8F0' }}>
                          <div className="h-full rounded-full" style={{ width:`${(d.count/maxCalls)*100}%`, background:'#2563EB' }}/>
                        </div>
                        <span className="text-[10px] tabular-nums" style={{ color:'#94A3B8' }}>{share}%</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{ background:'#F0FDF4', color:'#16A34A', border:'1px solid #BBF7D0' }}>Active</span>
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
