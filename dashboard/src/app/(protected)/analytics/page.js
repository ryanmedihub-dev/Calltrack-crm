'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, AreaChart, Area } from 'recharts';
import api from '../../../lib/api';

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background:'#0F172A', color:'#fff', boxShadow:'0 8px 24px rgba(0,0,0,0.25)' }}>
      <p style={{ color:'#94A3B8' }}>{label}</p>
      {payload.map((p,i)=><p key={i} className="font-bold">{p.name}: {p.value}</p>)}
    </div>
  );
};

const AVATAR_COLORS = ['#2563EB','#16A34A','#D97706','#DC2626','#0D9488','#7C3AED'];

export default function AnalyticsPage() {
  const [stats,     setStats]     = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([api.get('/api/calls/stats'), api.get('/api/employees')])
      .then(([s,e]) => { setStats(s.data.data); setEmployees(e.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = stats?.today;

  const connRate = today?.totalCalls ? Math.round((today.connectedCalls / today.totalCalls) * 100) : 0;
  const bestHour = stats?.callsPerHour?.length
    ? stats.callsPerHour.reduce((a,b) => b.count > a.count ? b : a, {hour:0,count:0}) : null;
  const topPerf  = stats?.topDialers?.[0];

  const metrics = [
    { label:'Connection Rate', value:`${connRate}%`,                    sub:'Answered vs total',             color:'#2563EB', bg:'#EFF6FF' },
    { label:'Working Hours',   value:today?.workingHours||'—',          sub:'Logged today',                  color:'#D97706', bg:'#FFFBEB' },
    { label:'Top Performer',   value:topPerf?.name?.split(' ')[0]||'—', sub:topPerf?`${topPerf.count} calls today`:'No data', color:'#16A34A', bg:'#F0FDF4' },
    { label:'Peak Hour',       value:bestHour?`${bestHour.hour}:00`:'—', sub:bestHour?`${bestHour.count} calls`:'No calls yet', color:'#7C3AED', bg:'#F5F3FF' },
  ];

  const periodData = stats ? [
    { name:'Today',     incoming:stats.today?.incoming||0,    outgoing:stats.today?.outgoing||0,    missed:stats.today?.missed||0 },
    { name:'Yesterday', incoming:stats.yesterday?.incoming||0, outgoing:stats.yesterday?.outgoing||0, missed:stats.yesterday?.missed||0 },
    { name:'Last Week', incoming:stats.lastWeek?.incoming||0,  outgoing:stats.lastWeek?.outgoing||0,  missed:stats.lastWeek?.missed||0 },
  ] : [];

  const empData  = (stats?.topDialers||[]).map(d=>({ name:d.name.split(' ')[0], calls:d.count }));
  const hourData = (stats?.callsPerHour||[]).map(h=>({ hour:`${h.hour}:00`, calls:h.count }));

  const qualityMetrics = [
    { label:'Connection Rate', t:today?.totalCalls?Math.round((today.connectedCalls/today.totalCalls)*100):0, y:stats?.yesterday?.totalCalls?Math.round(((stats.yesterday.connectedCalls||0)/stats.yesterday.totalCalls)*100):0, color:'#22C55E', suffix:'%' },
    { label:'Missed Rate',     t:today?.totalCalls?Math.round((today.missed/today.totalCalls)*100):0, y:stats?.yesterday?.totalCalls?Math.round(((stats.yesterday.missed||0)/stats.yesterday.totalCalls)*100):0, color:'#EF4444', suffix:'%' },
    { label:'Total Calls',     t:today?.totalCalls||0, y:stats?.yesterday?.totalCalls||0, color:'#2563EB', suffix:'' },
    { label:'Unique Clients',  t:today?.uniqueClients||0, y:stats?.yesterday?.uniqueClients||0, color:'#7C3AED', suffix:'' },
  ];

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[1,2,3,4].map(i=><div key={i} className="skeleton h-24 rounded-xl"/>)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {[1,2].map(i=><div key={i} className="skeleton h-72 rounded-xl"/>)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Analytics</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Performance overview across all periods</p>
        </div>
        <span className="text-xs font-medium px-3 py-1.5 rounded-lg"
          style={{ background:'#fff', border:'1px solid #E2E8F0', color:'#64748B' }}>
          {new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
        </span>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger">
        {metrics.map(m=>(
          <div key={m.label} className="page-card p-5 flex items-start gap-4"
            style={{ transition:'box-shadow 0.18s' }}
            onMouseEnter={e=>e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.10)'}
            onMouseLeave={e=>e.currentTarget.style.boxShadow=''}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background:m.bg, color:m.color }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-extrabold leading-none tabular-nums" style={{ color:'#0F172A', letterSpacing:'-0.03em' }}>{m.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider mt-1" style={{ color:'#94A3B8' }}>{m.label}</p>
              <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>{m.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Period comparison */}
        <div className="page-card p-5">
          <h3 className="font-bold text-sm mb-5" style={{ color:'#0F172A' }}>Period Comparison</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={periodData} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
              <XAxis dataKey="name" tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false} width={24}/>
              <Tooltip content={<ChartTip />}/>
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize:11, color:'#475569', paddingTop:8 }}/>
              <Bar dataKey="incoming" name="Incoming" fill="#22C55E" radius={[4,4,0,0]}/>
              <Bar dataKey="outgoing" name="Outgoing" fill="#F59E0B" radius={[4,4,0,0]}/>
              <Bar dataKey="missed"   name="Missed"   fill="#EF4444" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly area */}
        <div className="page-card p-5">
          <h3 className="font-bold text-sm mb-5" style={{ color:'#0F172A' }}>Hourly Activity (Today)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hourData}>
              <defs>
                <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
              <XAxis dataKey="hour" tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false} width={24}/>
              <Tooltip content={<ChartTip />}/>
              <Area type="monotone" dataKey="calls" name="Calls" stroke="#2563EB" strokeWidth={2.5}
                fill="url(#areaG)" dot={{ fill:'#2563EB', r:3, strokeWidth:0 }} activeDot={{ r:5, strokeWidth:0 }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Employee performance bar */}
        <div className="page-card p-5">
          <h3 className="font-bold text-sm mb-5" style={{ color:'#0F172A' }}>Employee Performance Today</h3>
          {empData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background:'#EFF6FF', color:'#2563EB' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              </div>
              <p className="text-sm" style={{ color:'#94A3B8' }}>No call data today</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, empData.length*44)}>
              <BarChart layout="vertical" data={empData} barCategoryGap="35%">
                <defs>
                  <linearGradient id="empG" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor="#2563EB" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false}/>
                <XAxis type="number" tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="name" tick={{ fill:'#475569', fontSize:12, fontWeight:500 }} axisLine={false} tickLine={false} width={70}/>
                <Tooltip content={<ChartTip />}/>
                <Bar dataKey="calls" name="Calls" fill="url(#empG)" radius={[0,5,5,0]}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Call quality comparison */}
        <div className="page-card p-5">
          <h3 className="font-bold text-sm mb-5" style={{ color:'#0F172A' }}>Call Quality — Today vs Yesterday</h3>
          <div className="space-y-5">
            {qualityMetrics.map(({label,t,y,color,suffix})=>{
              const max = Math.max(t,y,1);
              const delta = t - y;
              return (
                <div key={label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold" style={{ color:'#475569' }}>{label}</span>
                    <div className="flex items-center gap-2">
                      <span style={{ color:'#94A3B8' }}>Yest: {y}{suffix}</span>
                      <span className="font-bold" style={{ color:delta>0?'#16A34A':delta<0?'#DC2626':'#94A3B8' }}>
                        {delta>0?`+${delta}`:delta}{suffix}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'#E2E8F0' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width:`${(t/max)*100}%`, background:color }}/>
                  </div>
                  <div className="flex justify-between text-[10px]" style={{ color:'#94A3B8' }}>
                    <span>Today: {t}{suffix}</span>
                    <span style={{ color }}>{ ((t/max)*100).toFixed(0) }%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Employee table */}
      <div className="page-card overflow-hidden">
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom:'1px solid #E2E8F0' }}>
          <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>All Employees</h3>
          <span className="text-xs" style={{ color:'#94A3B8' }}>{employees.length} members</span>
        </div>
        <table className="data-table" style={{ minWidth:500 }}>
          <thead><tr><th>Name</th><th>Role</th><th>Calls Today</th><th>Status</th></tr></thead>
          <tbody>
            {employees.map((emp,i)=>{
              const callCount = stats?.topDialers?.find(d=>d.employeeId===emp._id)?.count ?? 0;
              return (
                <tr key={emp._id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background:AVATAR_COLORS[i%AVATAR_COLORS.length] }}>
                        {emp.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold" style={{ color:'#0F172A' }}>{emp.name}</p>
                        <p className="text-[10px]" style={{ color:'#94A3B8' }}>{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge text-[11px] capitalize" style={{ background:'#EFF6FF', color:'#2563EB', border:'1px solid #BFDBFE' }}>{emp.role}</span>
                  </td>
                  <td>
                    <span className="font-bold text-sm tabular-nums" style={{ color:'#2563EB' }}>{callCount}</span>
                  </td>
                  <td>
                    <span className="badge text-[11px]"
                      style={emp.isActive
                        ? { background:'rgba(22,163,74,0.08)', color:'#16A34A', border:'1px solid rgba(22,163,74,0.22)' }
                        : { background:'#F1F5F9', color:'#64748B', border:'1px solid #E2E8F0' }}>
                      {emp.isActive?'Active':'Inactive'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {employees.length===0&&<tr><td colSpan={4} className="py-10 text-center text-sm" style={{ color:'#94A3B8' }}>No employees yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
