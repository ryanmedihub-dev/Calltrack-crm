'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import api from '../../../../lib/api';

function Ico({ size = 16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background:'#0F172A', color:'#fff', boxShadow:'0 8px 24px rgba(0,0,0,0.25)' }}>
      <p style={{ color:'#94A3B8' }}>{label}</p>
      {payload.map((p,i)=><p key={i} className="font-bold">{p.name}: {p.value}</p>)}
    </div>
  );
};

const PAGES = [
  { href:'/calls',                 label:'Call Logs',       desc:'All call records with filters',         color:'#2563EB', bg:'#EFF6FF' },
  { href:'/calls/live',            label:'Live Monitor',    desc:'Real-time call activity',               color:'#16A34A', bg:'#F0FDF4' },
  { href:'/calls/agent-reports',   label:'Agent Reports',   desc:'Per-agent performance breakdown',       color:'#D97706', bg:'#FFFBEB' },
  { href:'/calls/attempt-reports', label:'Attempt Reports', desc:'Call attempt patterns & success rates', color:'#7C3AED', bg:'#F5F3FF' },
  { href:'/calls/logs-report',     label:'Logs Report',     desc:'Detailed report with all metrics',      color:'#0D9488', bg:'#F0FDFA' },
  { href:'/calls/targets',         label:'Daily Targets',   desc:'Team daily call targets',               color:'#DC2626', bg:'#FFF1F2' },
];

export default function CallsOverviewPage() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/calls/stats')
      .then(r => setStats(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = stats?.today;
  const yest  = stats?.yesterday;
  const week  = stats?.lastWeek;

  const summaryRows = [
    { label:'Total Calls',    today:today?.totalCalls,    yest:yest?.totalCalls,    week:week?.totalCalls,    color:'#2563EB' },
    { label:'Incoming',       today:today?.incoming,      yest:yest?.incoming,      week:week?.incoming,      color:'#16A34A' },
    { label:'Outgoing',       today:today?.outgoing,      yest:yest?.outgoing,      week:week?.outgoing,      color:'#D97706' },
    { label:'Missed',         today:today?.missed,        yest:yest?.missed,        week:week?.missed,        color:'#DC2626' },
    { label:'Connected',      today:today?.connectedCalls,yest:yest?.connectedCalls,week:week?.connectedCalls,color:'#0D9488' },
    { label:'Unique Clients', today:today?.uniqueClients, yest:yest?.uniqueClients, week:week?.uniqueClients, color:'#7C3AED' },
  ];

  const barData = stats ? [
    { name:'Today',     calls:today?.totalCalls||0 },
    { name:'Yesterday', calls:yest?.totalCalls||0 },
    { name:'Last Week', calls:week?.totalCalls||0 },
  ] : [];

  const pieData = today ? [
    { name:'Incoming', value:today.incoming||0,      color:'#22C55E' },
    { name:'Outgoing', value:today.outgoing||0,      color:'#F59E0B' },
    { name:'Missed',   value:today.missed||0,        color:'#EF4444' },
    { name:'Rejected', value:today.rejected||0,      color:'#8B5CF6' },
  ].filter(d=>d.value>0) : [];

  if (loading) return (
    <div className="space-y-5">
      <div className="skeleton h-8 w-48 rounded-xl" />
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {[1,2,3,4,5,6].map(i=><div key={i} className="skeleton h-24 rounded-xl"/>)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Calls Overview</h2>
        <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>High-level summary across all call reports</p>
      </div>

      {/* Quick nav cards */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {PAGES.map(p=>(
          <Link key={p.href} href={p.href}>
            <div className="page-card p-4 cursor-pointer transition-all"
              onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.09)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=''; }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background:p.bg, color:p.color }}>
                <Ico size={16}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></Ico>
              </div>
              <p className="font-bold text-sm" style={{ color:'#0F172A' }}>{p.label}</p>
              <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>{p.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Period summary table + charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 page-card overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
            <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Period Summary</h3>
            <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>Today vs Yesterday vs Last Week</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr>
                <th>Metric</th>
                <th style={{ textAlign:'right', color:'#2563EB' }}>Today</th>
                <th style={{ textAlign:'right' }}>Yesterday</th>
                <th style={{ textAlign:'right' }}>Last Week</th>
              </tr></thead>
              <tbody>
                {summaryRows.map(r=>(
                  <tr key={r.label}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:r.color }} />
                        <span className="font-medium text-xs" style={{ color:'#0F172A' }}>{r.label}</span>
                      </div>
                    </td>
                    <td style={{ textAlign:'right', fontWeight:700, color:r.color }}>{r.today??'—'}</td>
                    <td style={{ textAlign:'right', color:'#374151' }}>{r.yest??'—'}</td>
                    <td style={{ textAlign:'right', color:'#374151' }}>{r.week??'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Today's pie breakdown */}
        <div className="page-card p-5">
          <h3 className="font-bold text-sm mb-1" style={{ color:'#0F172A' }}>Today's Mix</h3>
          <p className="text-xs mb-3" style={{ color:'#94A3B8' }}>{today?.totalCalls||0} total calls</p>
          {pieData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 gap-2">
              <p className="text-sm" style={{ color:'#94A3B8' }}>No calls yet today</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={62}
                    paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {pieData.map(d=>(
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background:d.color }} />
                      <span style={{ color:'#64748B' }}>{d.name}</span>
                    </div>
                    <span className="font-bold" style={{ color:'#0F172A' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Trend bar chart */}
      <div className="page-card p-5">
        <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Call Volume Trend</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={barData} barCategoryGap="40%">
            <defs>
              <linearGradient id="ovG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9}/>
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.4}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
            <XAxis dataKey="name" tick={{ fill:'#94A3B8', fontSize:12 }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false} width={30} allowDecimals={false}/>
            <Tooltip content={<ChartTip />}/>
            <Bar dataKey="calls" name="Calls" fill="url(#ovG)" radius={[6,6,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
