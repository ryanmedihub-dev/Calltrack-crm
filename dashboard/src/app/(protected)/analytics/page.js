'use client';
import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell, Legend, LineChart, Line, RadialBarChart, RadialBar,
} from 'recharts';
import api from '../../../lib/api';

function Ico({ size = 16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

const TrendUpIco  = ({size=12}) => <Ico size={size}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></Ico>;
const TrendDnIco  = ({size=12}) => <Ico size={size}><polyline points="1 6 10.5 15.5 15.5 10.5 23 18"/><polyline points="7 18 1 18 1 12"/></Ico>;
const TrendFlatIco = ({size=12}) => <Ico size={size}><line x1="5" y1="12" x2="19" y2="12"/></Ico>;

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs shadow-xl"
      style={{ background: '#0F172A', color: '#fff', border: '1px solid #1E293B' }}>
      <p className="mb-1.5 font-medium" style={{ color: '#94A3B8' }}>{label}</p>
      {payload.map((p,i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color || p.fill || '#2563EB' }} />
          <span className="font-bold">{p.name}: <span style={{ color: '#fff' }}>{p.value}</span></span>
        </div>
      ))}
    </div>
  );
};

const AVATAR_COLORS = ['#2563EB','#16A34A','#D97706','#DC2626','#0D9488','#7C3AED','#0891B2','#BE185D'];

function pct(num, den) { return den ? Math.round((num / den) * 100) : 0; }
function delta(cur, prev) {
  if (prev === 0 || prev == null) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

function MetricCard({ label, value, sub, color, bg, icon, dval, idx }) {
  const d = dval;
  return (
    <div className="page-card p-5 animate-fade-in-up" style={{ animationDelay: `${idx*0.05}s`, transition: 'box-shadow 0.18s' }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.08)'}
      onMouseLeave={e=>e.currentTarget.style.boxShadow=''}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: bg, color }}>
          {icon}
        </div>
        {d !== null && d !== undefined && (
          <span className="flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: d > 0 ? 'rgba(22,163,74,0.10)' : d < 0 ? 'rgba(220,38,38,0.10)' : '#F1F5F9',
              color: d > 0 ? '#16A34A' : d < 0 ? '#DC2626' : '#64748B',
            }}>
            {d > 0 ? <TrendUpIco /> : d < 0 ? <TrendDnIco /> : <TrendFlatIco />}
            {Math.abs(d)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-extrabold leading-none tabular-nums" style={{ color: '#0F172A', letterSpacing: '-0.03em' }}>{value ?? '—'}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider mt-1.5" style={{ color: '#94A3B8' }}>{label}</p>
      {sub && <p className="text-[11px] mt-0.5" style={{ color: '#94A3B8' }}>{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [stats,     setStats]     = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [period,    setPeriod]    = useState('today');

  useEffect(() => {
    Promise.all([api.get('/api/calls/stats'), api.get('/api/employees')])
      .then(([s,e]) => { setStats(s.data.data); setEmployees(e.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const d = period === 'today' ? stats?.today : period === 'yesterday' ? stats?.yesterday : stats?.lastWeek;
  const today = stats?.today;
  const yest  = stats?.yesterday;
  const week  = stats?.lastWeek;

  const connRate    = pct(d?.connectedCalls, d?.totalCalls);
  const missRate    = pct(d?.missed, d?.totalCalls);
  const outRate     = pct(d?.outgoing, d?.totalCalls);
  const bestHour    = (stats?.callsPerHour||[]).reduce((a,b)=>b.count>a.count?b:a,{hour:0,count:0});
  const topPerf     = stats?.topDialers?.[0];
  const avgDur      = d?.totalCalls ? Math.round((d?.totalDuration||0)/d?.totalCalls) : 0;
  const avgDurFmt   = avgDur >= 60 ? `${Math.floor(avgDur/60)}m ${avgDur%60}s` : `${avgDur}s`;

  const periodLabel = { today: 'Today', yesterday: 'Yesterday', lastWeek: 'Last Week' }[period];

  const metricCards = [
    {
      label: 'Total Calls', value: d?.totalCalls ?? '—', color: '#2563EB', bg: '#EFF6FF',
      sub: `${periodLabel}`, dval: period==='today'?delta(today?.totalCalls,yest?.totalCalls):null,
      icon: <Ico size={18}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></Ico>,
    },
    {
      label: 'Connection Rate', value: `${connRate}%`, color: '#16A34A', bg: '#F0FDF4',
      sub: `${d?.connectedCalls??0} connected`, dval: period==='today'?delta(connRate,pct(yest?.connectedCalls,yest?.totalCalls)):null,
      icon: <Ico size={18}><polyline points="20 6 9 17 4 12"/></Ico>,
    },
    {
      label: 'Missed Rate', value: `${missRate}%`, color: '#DC2626', bg: '#FFF1F2',
      sub: `${d?.missed??0} missed calls`, dval: period==='today'?delta(missRate,pct(yest?.missed,yest?.totalCalls)):null,
      icon: <Ico size={18}><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/></Ico>,
    },
    {
      label: 'Avg Duration', value: avgDurFmt, color: '#D97706', bg: '#FFFBEB',
      sub: 'Per connected call', dval: null,
      icon: <Ico size={18}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Ico>,
    },
    {
      label: 'Unique Clients', value: d?.uniqueClients ?? '—', color: '#7C3AED', bg: '#F5F3FF',
      sub: `${periodLabel}`, dval: period==='today'?delta(today?.uniqueClients,yest?.uniqueClients):null,
      icon: <Ico size={18}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Ico>,
    },
    {
      label: 'Peak Hour', value: bestHour?.count ? `${bestHour.hour}:00` : '—', color: '#0D9488', bg: '#F0FDFA',
      sub: bestHour?.count ? `${bestHour.count} calls` : 'No calls yet',
      dval: null,
      icon: <Ico size={18}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></Ico>,
    },
  ];

  const periodCompData = stats ? [
    { name: 'Today',     incoming: today?.incoming||0, outgoing: today?.outgoing||0, missed: today?.missed||0, connected: today?.connectedCalls||0 },
    { name: 'Yesterday', incoming: yest?.incoming||0,  outgoing: yest?.outgoing||0,  missed: yest?.missed||0,  connected: yest?.connectedCalls||0 },
    { name: 'Last Week', incoming: week?.incoming||0,  outgoing: week?.outgoing||0,  missed: week?.missed||0,  connected: week?.connectedCalls||0 },
  ] : [];

  const hourData = (stats?.callsPerHour||[]).map(h=>({ hour:`${h.hour}:00`, calls: h.count }));

  const empData = (stats?.topDialers||[]).slice(0,8).map((d,i)=>({
    name: d.name.length > 10 ? d.name.split(' ')[0] : d.name,
    fullName: d.name,
    calls: d.count,
    fill: AVATAR_COLORS[i % AVATAR_COLORS.length],
  }));

  const outcomePie = today ? [
    { name: 'Connected',  value: today.connectedCalls||0,  color: '#22C55E' },
    { name: 'Missed',     value: today.missed||0,           color: '#EF4444' },
    { name: 'Rejected',   value: today.rejected||0,         color: '#8B5CF6' },
  ].filter(x => x.value > 0) : [];

  const qualityData = [
    { name: 'Connection', today: pct(today?.connectedCalls, today?.totalCalls), yest: pct(yest?.connectedCalls, yest?.totalCalls), color: '#22C55E', suffix: '%' },
    { name: 'Missed',     today: pct(today?.missed, today?.totalCalls),         yest: pct(yest?.missed, yest?.totalCalls),         color: '#EF4444', suffix: '%' },
    { name: 'Outgoing',   today: pct(today?.outgoing, today?.totalCalls),       yest: pct(yest?.outgoing, yest?.totalCalls),       color: '#F59E0B', suffix: '%' },
    { name: 'Incoming',   today: pct(today?.incoming, today?.totalCalls),       yest: pct(yest?.incoming, yest?.totalCalls),       color: '#2563EB', suffix: '%' },
  ];

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
          {[1,2,3,4,5,6].map(i=><div key={i} className="skeleton h-28 rounded-xl"/>)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {[1,2,3,4].map(i=><div key={i} className="skeleton h-64 rounded-xl"/>)}
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
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Deep-dive into call performance and agent metrics</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: '#F1F5F9' }}>
          {[['today','Today'],['yesterday','Yesterday'],['lastWeek','Last Week']].map(([v,l])=>(
            <button key={v} onClick={()=>setPeriod(v)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={period===v
                ? { background:'#fff', color:'#0F172A', boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }
                : { color:'#64748B' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 xl:grid-cols-6 gap-4 stagger">
        {metricCards.map((m,i)=><MetricCard key={m.label} idx={i} {...m} />)}
      </div>

      {/* Charts row 1: Period comparison + Call outcome */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 page-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Period Comparison</h3>
              <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>Today vs Yesterday vs Last Week</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={periodCompData} barGap={3} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
              <XAxis dataKey="name" tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false} width={24}/>
              <Tooltip content={<ChartTip />}/>
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize:11, color:'#475569', paddingTop:8 }}/>
              <Bar dataKey="incoming"  name="Incoming"  fill="#22C55E" radius={[4,4,0,0]}/>
              <Bar dataKey="outgoing"  name="Outgoing"  fill="#F59E0B" radius={[4,4,0,0]}/>
              <Bar dataKey="missed"    name="Missed"    fill="#EF4444" radius={[4,4,0,0]}/>
              <Bar dataKey="connected" name="Connected" fill="#2563EB" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="page-card p-5">
          <div className="mb-4">
            <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Call Outcomes</h3>
            <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>Today's distribution</p>
          </div>
          {outcomePie.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background:'#EFF6FF', color:'#2563EB' }}>
                <Ico size={20}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></Ico>
              </div>
              <p className="text-sm" style={{ color:'#94A3B8' }}>No calls yet today</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={outcomePie} cx="50%" cy="50%" innerRadius={48} outerRadius={72}
                    paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {outcomePie.map((e,i)=><Cell key={i} fill={e.color}/>)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {outcomePie.map(o=>(
                  <div key={o.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: o.color }} />
                      <span style={{ color:'#64748B' }}>{o.name}</span>
                    </div>
                    <span className="font-bold" style={{ color:'#0F172A' }}>
                      {o.value} <span className="font-normal" style={{ color:'#94A3B8' }}>({pct(o.value, today?.totalCalls)}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Charts row 2: Hourly + Agent bar */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="page-card p-5">
          <div className="mb-5">
            <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Hourly Activity</h3>
            <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>Call distribution across the day</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hourData}>
              <defs>
                <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
              <XAxis dataKey="hour" tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false} interval={3}/>
              <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false} width={24} allowDecimals={false}/>
              <Tooltip content={<ChartTip />}/>
              <Area type="monotone" dataKey="calls" name="Calls" stroke="#2563EB" strokeWidth={2.5}
                fill="url(#areaG)" dot={false} activeDot={{ r:5, strokeWidth:0, fill:'#2563EB' }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="page-card p-5">
          <div className="mb-5">
            <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Top Performers</h3>
            <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>Calls made today by agent</p>
          </div>
          {empData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background:'#EFF6FF', color:'#2563EB' }}>
                <Ico size={20}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></Ico>
              </div>
              <p className="text-sm" style={{ color:'#94A3B8' }}>No call data today</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, empData.length*42)}>
              <BarChart layout="vertical" data={empData} barCategoryGap="30%">
                <defs>
                  <linearGradient id="empG" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor="#2563EB" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.7}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false}/>
                <XAxis type="number" tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false}/>
                <YAxis type="category" dataKey="name" tick={{ fill:'#475569', fontSize:12, fontWeight:500 }} axisLine={false} tickLine={false} width={72}/>
                <Tooltip content={<ChartTip />}/>
                <Bar dataKey="calls" name="Calls" fill="url(#empG)" radius={[0,5,5,0]}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Call Quality Today vs Yesterday */}
      <div className="page-card p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Call Quality — Today vs Yesterday</h3>
            <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>Key performance ratios comparison</p>
          </div>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-6">
          {qualityData.map(({name,today:t,yest:y,color,suffix})=>{
            const diff = t - y;
            return (
              <div key={name}>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold" style={{ color:'#475569' }}>{name} Rate</span>
                  <span className="font-bold text-sm" style={{ color, fontSize:20, letterSpacing:'-0.03em' }}>{t}{suffix}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background:'#F1F5F9' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width:`${t}%`, background:color }}/>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span style={{ color:'#94A3B8' }}>Yesterday: {y}{suffix}</span>
                  <span className="font-semibold flex items-center gap-0.5"
                    style={{ color: diff > 0 ? '#16A34A' : diff < 0 ? '#DC2626' : '#94A3B8' }}>
                    {diff > 0 ? <TrendUpIco /> : diff < 0 ? <TrendDnIco /> : null}
                    {diff > 0 ? '+' : ''}{diff}{suffix}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agent Performance Table */}
      <div className="page-card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom:'1px solid #E2E8F0' }}>
          <div>
            <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Agent Performance</h3>
            <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>{employees.length} agents · Today's metrics</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table" style={{ minWidth:640 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Agent</th>
                <th>Role</th>
                <th style={{ textAlign:'right' }}>Calls</th>
                <th style={{ textAlign:'right' }}>Conn. Rate</th>
                <th style={{ textAlign:'right' }}>Missed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp,i)=>{
                const dialerData = stats?.topDialers?.find(d=>d.employeeId===emp._id);
                const callCount  = dialerData?.count ?? 0;
                const connR      = callCount > 0 ? `${Math.round((dialerData?.connected||0)/callCount*100)}%` : '—';
                return (
                  <tr key={emp._id}>
                    <td style={{ color:'#CBD5E1' }}>{i+1}</td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: AVATAR_COLORS[i%AVATAR_COLORS.length] }}>
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
                    <td style={{ textAlign:'right' }}>
                      <span className="font-bold tabular-nums" style={{ color: callCount > 0 ? '#2563EB' : '#CBD5E1', fontSize:15 }}>{callCount}</span>
                    </td>
                    <td style={{ textAlign:'right' }}>
                      <span className="text-xs font-semibold" style={{ color:'#16A34A' }}>{connR}</span>
                    </td>
                    <td style={{ textAlign:'right' }}>
                      <span className="text-xs font-semibold" style={{ color:'#DC2626' }}>{dialerData?.missed ?? '—'}</span>
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
              {employees.length===0&&<tr><td colSpan={7} className="py-10 text-center text-sm" style={{ color:'#94A3B8' }}>No employees yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
