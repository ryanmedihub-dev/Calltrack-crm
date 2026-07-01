'use client';
import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../../../../lib/api';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const TrendUpIco = ({s=12}) => <Ico size={s}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></Ico>;
const TrendDnIco = ({s=12}) => <Ico size={s}><polyline points="1 6 10.5 15.5 15.5 10.5 23 18"/><polyline points="7 18 1 18 1 12"/></Ico>;

const PERIODS = [{ key:'today',label:'Today' },{ key:'week',label:'This Week' },{ key:'month',label:'This Month' }];

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg px-3 py-2 text-xs" style={{ background:'#0F172A', color:'#fff' }}>
    <p style={{ color:'#94A3B8' }}>{label}</p>
    {payload.map((p,i) => <p key={i} className="font-bold">{p.name}: {p.value}</p>)}
  </div>;
};

export default function EmployeePerformanceReportPage() {
  const [employees, setEmployees] = useState([]);
  const [selected,  setSelected]  = useState('');
  const [period,    setPeriod]    = useState('week');
  const [stats,     setStats]     = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [loadingEmp,setLoadingEmp]= useState(true);

  useEffect(() => {
    api.get('/api/employees').then(r => {
      const emps = r.data?.data||[];
      setEmployees(emps);
      if (emps.length) setSelected(emps[0]._id);
    }).catch(()=>{}).finally(()=>setLoadingEmp(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    api.get('/api/calls/stats', { params: { employee: selected } })
      .then(r => setStats(r.data?.data))
      .catch(()=>setStats(null))
      .finally(()=>setLoading(false));
  }, [selected, period]);

  const emp  = employees.find(e=>e._id===selected);
  const data = period==='today' ? stats?.today : period==='week' ? stats?.lastWeek : stats?.lastMonth;

  const metrics = [
    { label:'Total Calls',   val:data?.totalCalls??'—',     color:'#2563EB', bg:'#EFF6FF' },
    { label:'Incoming',      val:data?.incoming??'—',       color:'#16A34A', bg:'#F0FDF4' },
    { label:'Outgoing',      val:data?.outgoing??'—',       color:'#D97706', bg:'#FFFBEB' },
    { label:'Missed',        val:data?.missed??'—',         color:'#DC2626', bg:'#FFF1F2' },
    { label:'Connected',     val:data?.connectedCalls??'—', color:'#0D9488', bg:'#F0FDFA' },
    { label:'Unique Clients',val:data?.uniqueClients??'—',  color:'#7C3AED', bg:'#F5F3FF' },
  ];

  const hourlyData = stats?.callsPerHour||[];

  const connRate = data?.totalCalls > 0
    ? Math.round(((data.connectedCalls||0)/data.totalCalls)*100)
    : 0;

  const missRate = data?.totalCalls > 0
    ? Math.round(((data.missed||0)/data.totalCalls)*100)
    : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Performance Report</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Individual employee call performance with detailed metrics</p>
        </div>
        <div className="flex items-center gap-2">
          {loadingEmp ? <div className="skeleton h-9 w-44 rounded-lg"/> : (
            <select className="form-input text-sm font-semibold w-48" value={selected} onChange={e=>setSelected(e.target.value)}>
              {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          )}
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
      </div>

      {/* Employee card */}
      {emp && (
        <div className="page-card p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black flex-shrink-0"
              style={{ background:'linear-gradient(135deg,#2563EB,#60A5FA)' }}>
              {emp.name.slice(0,2).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-bold text-base" style={{ color:'#0F172A' }}>{emp.name}</p>
              <p className="text-sm" style={{ color:'#64748B' }}>{emp.role||'Agent'} · {emp.phone||'—'}</p>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-20 rounded-full overflow-hidden" style={{ background:'#E2E8F0' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width:`${connRate}%`, background:'#16A34A' }}/>
                  </div>
                  <span className="text-xs font-semibold" style={{ color:'#16A34A' }}>{connRate}% connect rate</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-16 rounded-full overflow-hidden" style={{ background:'#E2E8F0' }}>
                    <div className="h-full rounded-full" style={{ width:`${missRate}%`, background:'#DC2626' }}/>
                  </div>
                  <span className="text-xs font-semibold" style={{ color:'#DC2626' }}>{missRate}% miss rate</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 stagger">
        {metrics.map((m,i) => (
          <div key={m.label} className="page-card p-4 animate-fade-in-up" style={{ animationDelay:`${i*0.04}s` }}>
            <div className="w-2 h-6 rounded-full mb-2" style={{ background:m.color }}/>
            <p className="stat-number text-xl">
              {loading ? <span className="skeleton inline-block w-10 h-6 rounded"/> : m.val}
            </p>
            <p className="stat-label text-[10px] uppercase tracking-wider">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Performance indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="page-card p-5">
          <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Performance Score</h3>
          {[
            { label:'Connection Rate', val:connRate, color:'#16A34A', max:100 },
            { label:'Miss Rate',       val:missRate, color:'#DC2626', max:100 },
            { label:'Outgoing Share',  val:data?.totalCalls>0?Math.round(((data.outgoing||0)/data.totalCalls)*100):0, color:'#D97706', max:100 },
            { label:'Incoming Share',  val:data?.totalCalls>0?Math.round(((data.incoming||0)/data.totalCalls)*100):0, color:'#2563EB', max:100 },
          ].map(r => (
            <div key={r.label} className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color:'#64748B' }}>{r.label}</span>
                <span className="text-xs font-bold tabular-nums" style={{ color:r.color }}>{r.val}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background:'#F1F5F9' }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width:`${r.val}%`, background:r.color }}/>
              </div>
            </div>
          ))}
        </div>

        <div className="page-card p-5">
          <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Hourly Distribution</h3>
          {hourlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={hourlyData} barCategoryGap="38%">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                <XAxis dataKey="hour" tick={{ fill:'#94A3B8', fontSize:9 }} tickFormatter={h=>`${h}h`} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill:'#94A3B8', fontSize:9 }} axisLine={false} tickLine={false} width={20} allowDecimals={false}/>
                <Tooltip content={<ChartTip/>}/>
                <Bar dataKey="count" name="Calls" fill="#2563EB" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-36" style={{ color:'#94A3B8' }}>
              <span className="text-sm">No hourly data</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
