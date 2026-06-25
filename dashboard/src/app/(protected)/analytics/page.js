'use client';
import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Legend, LineChart, Line, Area, AreaChart,
} from 'recharts';
import api from '../../../lib/api';

function Svg({ children, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const TrendUpIco = () => <Svg><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></Svg>;
const ClockIco   = () => <Svg><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Svg>;
const StarIco    = () => <Svg><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Svg>;
const LinkIco    = () => <Svg><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></Svg>;

const METRIC_CARDS = [
  { key:'connection', label:'Connection Rate', sub:'Calls answered vs total', Icon:LinkIco,  grad:'linear-gradient(135deg,#0EA5E9,#14B8A6)', glow:'rgba(14,165,233,0.18)', lt:'#F0FDFA' },
  { key:'working',    label:'Working Hours',   sub:'Total today',             Icon:ClockIco, grad:'linear-gradient(135deg,#8B5CF6,#A78BFA)', glow:'rgba(139,92,246,0.18)', lt:'#F5F3FF' },
  { key:'top',        label:'Top Performer',   sub:'',                        Icon:StarIco,  grad:'linear-gradient(135deg,#F59E0B,#F97316)', glow:'rgba(245,158,11,0.18)', lt:'#FFFBEB' },
  { key:'peak',       label:'Peak Hour',       sub:'',                        Icon:TrendUpIco, grad:'linear-gradient(135deg,#10B981,#14B8A6)', glow:'rgba(16,185,129,0.18)', lt:'#ECFDF5' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs" style={{ background:'#0C0A1E', color:'#fff', border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 8px 24px rgba(0,0,0,0.25)' }}>
      <p style={{ color:'#8D8BAC' }}>{label}</p>
      {payload.map((p,i) => <p key={i} className="font-bold mt-0.5">{p.name}: {p.value}</p>)}
    </div>
  );
};

const AVATAR_GRADS = ['linear-gradient(135deg,#6366F1,#8B5CF6)','linear-gradient(135deg,#10B981,#14B8A6)','linear-gradient(135deg,#F59E0B,#F97316)','linear-gradient(135deg,#0EA5E9,#6366F1)','linear-gradient(135deg,#8B5CF6,#EC4899)','linear-gradient(135deg,#EF4444,#F97316)'];

export default function AnalyticsPage() {
  const [stats,     setStats]     = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([api.get('/api/calls/stats'), api.get('/api/employees')])
      .then(([s, e]) => { setStats(s.data.data); setEmployees(e.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = stats?.today;

  const connectionRate = today?.totalCalls
    ? Math.round((today.connectedCalls / today.totalCalls) * 100) : 0;

  const bestHour = stats?.callsPerHour?.length
    ? stats.callsPerHour.reduce((a,b) => b.count > a.count ? b : a, { hour:0, count:0 }) : null;

  const topPerformer = stats?.topDialers?.[0];

  const metricValues = {
    connection: { value:`${connectionRate}%`, sub:'Calls answered vs total' },
    working:    { value: today?.workingHours || '—', sub:'Total today' },
    top:        { value: topPerformer?.name?.split(' ')[0] || '—', sub: topPerformer ? `${topPerformer.count} calls today` : 'No data' },
    peak:       { value: bestHour ? `${bestHour.hour}:00` : '—', sub: bestHour ? `${bestHour.count} calls` : 'No calls yet' },
  };

  const periodData = stats ? [
    { name:'Today',     incoming:stats.today?.incoming||0,    outgoing:stats.today?.outgoing||0,    missed:stats.today?.missed||0 },
    { name:'Yesterday', incoming:stats.yesterday?.incoming||0, outgoing:stats.yesterday?.outgoing||0, missed:stats.yesterday?.missed||0 },
    { name:'Last Week', incoming:stats.lastWeek?.incoming||0,  outgoing:stats.lastWeek?.outgoing||0,  missed:stats.lastWeek?.missed||0 },
  ] : [];

  const employeeData = (stats?.topDialers || []).map(d => ({ name:d.name.split(' ')[0], calls:d.count }));
  const hourData     = (stats?.callsPerHour || []).map(h => ({ hour:`${h.hour}:00`, calls:h.count }));

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-8 skeleton w-48 rounded-xl" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_,i)=><div key={i} className="h-28 skeleton rounded-2xl"/>)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {[...Array(2)].map((_,i)=><div key={i} className="h-72 skeleton rounded-2xl"/>)}
        </div>
      </div>
    );
  }

  const cardStyle = { background:'#fff', border:'1px solid #E2E8F4', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', borderRadius:'1rem' };
  const theadStyle = { borderBottom:'1px solid #F1F5F9', background:'#F8FAFF' };
  const thStyle    = { padding:'10px 16px', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.1em', color:'#94A3B8', textAlign:'left', whiteSpace:'nowrap' };

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold leading-none" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Analytics</h2>
          <p className="text-sm mt-1" style={{ color:'#94A3B8' }}>Performance overview across all periods</p>
        </div>
        <span className="text-xs font-medium px-3 py-1.5 rounded-xl"
          style={{ background:'#fff', border:'1px solid #E2E8F4', color:'#64748B' }}>
          {new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger">
        {METRIC_CARDS.map(({ key, label, Icon, grad, glow, lt }) => {
          const mv = metricValues[key];
          return (
            <div key={key} style={cardStyle} className="p-5 flex items-start gap-4 card-hover">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{ background:grad, boxShadow:`0 4px 12px ${glow}` }}>
                <Icon />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-extrabold leading-none tabular-nums" style={{ color:'#0F172A', letterSpacing:'-0.03em' }}>
                  {mv.value}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider mt-1" style={{ color:'#94A3B8' }}>{label}</p>
                {mv.sub && <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>{mv.sub}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Period comparison */}
        <div style={cardStyle} className="p-5">
          <h3 className="font-bold text-sm mb-5" style={{ color:'#0F172A' }}>Period Comparison</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={periodData} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
              <XAxis dataKey="name" tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false}/>
              <Tooltip content={<CustomTooltip />}/>
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize:11, color:'#475569', paddingTop:8 }}/>
              <Bar dataKey="incoming" name="Incoming" fill="#10B981" radius={[4,4,0,0]}/>
              <Bar dataKey="outgoing" name="Outgoing" fill="#F59E0B" radius={[4,4,0,0]}/>
              <Bar dataKey="missed"   name="Missed"   fill="#EF4444" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly line chart */}
        <div style={cardStyle} className="p-5">
          <h3 className="font-bold text-sm mb-5" style={{ color:'#0F172A' }}>Hourly Activity (Today)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hourData}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.18}/>
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
              <XAxis dataKey="hour" tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false}/>
              <Tooltip content={<CustomTooltip />}/>
              <Area type="monotone" dataKey="calls" name="Calls" stroke="#6366F1" strokeWidth={2.5}
                fill="url(#areaGrad)"
                dot={{ fill:'#6366F1', r:3, strokeWidth:0 }}
                activeDot={{ r:5, strokeWidth:0 }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Employee performance */}
        <div style={cardStyle} className="p-5">
          <h3 className="font-bold text-sm mb-5" style={{ color:'#0F172A' }}>Employee Performance Today</h3>
          {employeeData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background:'#EEF2FF', color:'#818CF8' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <p className="text-sm" style={{ color:'#94A3B8' }}>No call data today</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180,employeeData.length*44)}>
              <BarChart layout="vertical" data={employeeData} barCategoryGap="35%">
                <defs>
                  <linearGradient id="empGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor="#6366F1" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.7}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false}/>
                <XAxis type="number" tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="name" tick={{ fill:'#475569', fontSize:12, fontWeight:500 }} axisLine={false} tickLine={false} width={70}/>
                <Tooltip content={<CustomTooltip />}/>
                <Bar dataKey="calls" name="Calls" fill="url(#empGrad)" radius={[0,6,6,0]}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Call quality */}
        <div style={cardStyle} className="p-5">
          <h3 className="font-bold text-sm mb-5" style={{ color:'#0F172A' }}>Call Quality — Today vs Yesterday</h3>
          <div className="space-y-5">
            {[
              { label:'Connection Rate', t:today?.totalCalls?Math.round((today.connectedCalls/today.totalCalls)*100):0, y:stats?.yesterday?.totalCalls?Math.round(((stats.yesterday.connectedCalls||0)/stats.yesterday.totalCalls)*100):0, color:'#10B981', suffix:'%' },
              { label:'Missed Rate',     t:today?.totalCalls?Math.round((today.missed/today.totalCalls)*100):0, y:stats?.yesterday?.totalCalls?Math.round(((stats.yesterday.missed||0)/stats.yesterday.totalCalls)*100):0, color:'#EF4444', suffix:'%' },
              { label:'Total Calls',     t:today?.totalCalls||0, y:stats?.yesterday?.totalCalls||0, color:'#6366F1', suffix:'' },
              { label:'Unique Clients',  t:today?.uniqueClients||0, y:stats?.yesterday?.uniqueClients||0, color:'#8B5CF6', suffix:'' },
            ].map(({ label, t, y, color, suffix }) => {
              const max   = Math.max(t, y, 1);
              const delta = t - y;
              return (
                <div key={label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold" style={{ color:'#475569' }}>{label}</span>
                    <div className="flex items-center gap-2">
                      <span style={{ color:'#94A3B8' }}>Yesterday: {y}{suffix}</span>
                      <span className="font-bold" style={{ color: delta>0?'#10B981':delta<0?'#EF4444':'#94A3B8' }}>
                        {delta>0?`+${delta}`:delta}{suffix}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background:'#F1F5F9' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width:`${(t/max)*100}%`, background:color }}/>
                  </div>
                  <div className="flex justify-between" style={{ fontSize:'10px', color:'#94A3B8' }}>
                    <span>Today: {t}{suffix}</span>
                    <span style={{ color }}>{((t/max)*100).toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Employee table */}
      <div style={{ ...cardStyle, overflow:'hidden' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom:'1px solid #F1F5F9' }}>
          <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>All Employees</h3>
          <span className="text-xs" style={{ color:'#94A3B8' }}>{employees.length} members</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth:500 }}>
            <thead>
              <tr style={theadStyle}>
                {['Name','Role','Calls Today','Status'].map(h=><th key={h} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, i) => {
                const callCount = stats?.topDialers?.find(d=>d.employeeId===emp._id)?.count ?? 0;
                return (
                  <tr key={emp._id} className="table-row-hover transition-colors" style={{ borderBottom:'1px solid #F8FAFF' }}>
                    <td style={{ padding:'12px 16px' }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background:AVATAR_GRADS[i%AVATAR_GRADS.length] }}>
                          {emp.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold" style={{ color:'#0F172A' }}>{emp.name}</p>
                          <p className="text-[10px]" style={{ color:'#94A3B8' }}>{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      <span className="capitalize text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background:'#EEF2FF', color:'#6366F1', border:'1px solid #C7D2FE' }}>{emp.role}</span>
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color:'#0F172A' }}>{callCount}</span>
                        {callCount > 0 && (
                          <div className="flex-1 max-w-24 h-1.5 rounded-full overflow-hidden" style={{ background:'#EEF2FF' }}>
                            <div className="h-full rounded-full" style={{ background:'#6366F1', width:`${Math.min(100,(callCount/(stats?.topDialers?.[0]?.count||1))*100)}%` }}/>
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                        style={emp.isActive !== false
                          ? { background:'rgba(16,185,129,0.10)', color:'#059669', border:'1px solid rgba(16,185,129,0.22)' }
                          : { background:'rgba(148,163,184,0.10)', color:'#64748B', border:'1px solid rgba(148,163,184,0.22)' }}>
                        {emp.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto" style={{ background:'#EEF2FF', color:'#818CF8' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                        </svg>
                      </div>
                      <span className="text-sm" style={{ color:'#94A3B8' }}>No employees found</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
