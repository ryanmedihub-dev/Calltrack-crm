'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
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

function pct(a, b) { return b ? Math.round(a/b*100) : 0; }

export default function AttemptReportsPage() {
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
  const month = stats?.thisMonth;

  const connRate    = pct(today?.connectedCalls, today?.totalCalls);
  const missRate    = pct(today?.missed, today?.totalCalls);
  const outConnRate = today?.outgoing ? pct(today?.connectedCalls, today?.outgoing) : 0;

  /* Hourly attempt data */
  const hourData = (stats?.callsPerHour || []).map(h => ({
    hour: `${h.hour}:00`,
    attempts: h.count,
  }));

  /* Period trend */
  const periodTrend = [
    { period:'Today',      attempts:today?.totalCalls||0, connected:today?.connectedCalls||0, missed:today?.missed||0 },
    { period:'Yesterday',  attempts:yest?.totalCalls||0,  connected:yest?.connectedCalls||0,  missed:yest?.missed||0 },
    { period:'Last Week',  attempts:week?.totalCalls||0,  connected:week?.connectedCalls||0,  missed:week?.missed||0 },
    { period:'This Month', attempts:month?.totalCalls||0, connected:month?.connectedCalls||0, missed:month?.missed||0 },
  ];

  /* Outcome distribution for the progress bars */
  const outcomes = today ? [
    { label:'Connected',         value:today.connectedCalls||0,  pct:pct(today.connectedCalls||0, today.totalCalls), color:'#22C55E' },
    { label:'Missed (no pickup)', value:today.missed||0,          pct:pct(today.missed||0, today.totalCalls),         color:'#EF4444' },
    { label:'Rejected',          value:today.rejected||0,         pct:pct(today.rejected||0, today.totalCalls),        color:'#8B5CF6' },
    { label:'Incoming only',     value:today.incoming||0,         pct:pct(today.incoming||0, today.totalCalls),         color:'#3B82F6' },
    { label:'Outgoing attempts', value:today.outgoing||0,         pct:pct(today.outgoing||0, today.totalCalls),         color:'#F59E0B' },
  ] : [];

  if (loading) return (
    <div className="space-y-5">
      <div className="skeleton h-8 w-56 rounded-xl" />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[1,2,3,4].map(i=><div key={i} className="skeleton h-24 rounded-xl"/>)}
      </div>
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Attempt Reports</h2>
        <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Call attempt patterns, success rates & outcome analysis</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger">
        {[
          { label:'Total Attempts',    value:today?.totalCalls??'—',  color:'#2563EB', bg:'#EFF6FF',
            icon:<Ico size={18}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></Ico>,
            sub:'Today' },
          { label:'Success Rate',      value:`${connRate}%`,          color:'#16A34A', bg:'#F0FDF4',
            icon:<Ico size={18}><polyline points="20 6 9 17 4 12"/></Ico>,
            sub:`${today?.connectedCalls||0} connected` },
          { label:'Outgoing Connect',  value:`${outConnRate}%`,       color:'#D97706', bg:'#FFFBEB',
            icon:<Ico size={18}><polyline points="1 6 10.5 15.5 15.5 10.5 23 18"/><polyline points="7 6 1 6 1 12"/></Ico>,
            sub:`Of outgoing calls` },
          { label:'Missed / Rejected', value:(today?.missed||0)+(today?.rejected||0), color:'#DC2626', bg:'#FFF1F2',
            icon:<Ico size={18}><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/></Ico>,
            sub:`${missRate}% miss rate` },
        ].map((c,i)=>(
          <div key={c.label} className="page-card p-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 flex-shrink-0" style={{ background:c.bg, color:c.color }}>
              {c.icon}
            </div>
            <p className="text-2xl font-extrabold leading-none tabular-nums" style={{ color:'#0F172A', letterSpacing:'-0.03em' }}>{c.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color:'#94A3B8' }}>{c.label}</p>
            <p className="text-[11px] mt-0.5" style={{ color:'#94A3B8' }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Outcome distribution + Hourly pattern */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Outcome distribution */}
        <div className="page-card p-5">
          <h3 className="font-bold text-sm mb-5" style={{ color:'#0F172A' }}>Outcome Distribution (Today)</h3>
          <div className="space-y-4">
            {outcomes.map(o=>(
              <div key={o.label}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium" style={{ color:'#475569' }}>{o.label}</span>
                  <div className="flex items-center gap-2">
                    <span style={{ color:'#94A3B8' }}>{o.value} calls</span>
                    <span className="font-bold" style={{ color:o.color }}>{o.pct}%</span>
                  </div>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background:'#F1F5F9' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width:`${o.pct}%`, background:o.color }}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hourly attempt pattern */}
        <div className="page-card p-5">
          <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Hourly Attempt Pattern</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hourData}>
              <defs>
                <linearGradient id="attG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
              <XAxis dataKey="hour" tick={{ fill:'#94A3B8', fontSize:9 }} axisLine={false} tickLine={false} interval={3}/>
              <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false} width={24} allowDecimals={false}/>
              <Tooltip content={<ChartTip />}/>
              <Area type="monotone" dataKey="attempts" name="Attempts" stroke="#2563EB" strokeWidth={2.5}
                fill="url(#attG)" dot={false} activeDot={{ r:5, strokeWidth:0, fill:'#2563EB' }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Period trend comparison */}
      <div className="page-card p-5">
        <h3 className="font-bold text-sm mb-5" style={{ color:'#0F172A' }}>Attempt Trend Across Periods</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={periodTrend} barGap={4} barCategoryGap="32%">
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
            <XAxis dataKey="period" tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false} width={32} allowDecimals={false}/>
            <Tooltip content={<ChartTip />}/>
            <Bar dataKey="attempts"  name="Total Attempts" fill="#2563EB" radius={[4,4,0,0]} opacity={0.85}/>
            <Bar dataKey="connected" name="Connected"      fill="#22C55E" radius={[4,4,0,0]}/>
            <Bar dataKey="missed"    name="Missed"         fill="#EF4444" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats table */}
      <div className="page-card overflow-hidden">
        <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
          <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Attempt Summary by Period</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr>
              <th>Period</th>
              <th style={{ textAlign:'right' }}>Total Attempts</th>
              <th style={{ textAlign:'right' }}>Connected</th>
              <th style={{ textAlign:'right' }}>Conn. Rate</th>
              <th style={{ textAlign:'right' }}>Missed</th>
              <th style={{ textAlign:'right' }}>Miss Rate</th>
              <th style={{ textAlign:'right' }}>Unique Contacts</th>
            </tr></thead>
            <tbody>
              {[
                { p:'Today',      d:today },
                { p:'Yesterday',  d:yest  },
                { p:'Last Week',  d:week  },
                { p:'This Month', d:month },
              ].map(({p,d})=>(
                <tr key={p}>
                  <td className="font-semibold" style={{ color:'#0F172A' }}>{p}</td>
                  <td style={{ textAlign:'right', fontWeight:600, color:'#2563EB' }}>{d?.totalCalls??'—'}</td>
                  <td style={{ textAlign:'right', color:'#0D9488' }}>{d?.connectedCalls??'—'}</td>
                  <td style={{ textAlign:'right' }}>
                    <span className="font-semibold" style={{ color:'#16A34A' }}>{d?.totalCalls ? `${pct(d.connectedCalls,d.totalCalls)}%` : '—'}</span>
                  </td>
                  <td style={{ textAlign:'right', color:'#DC2626' }}>{d?.missed??'—'}</td>
                  <td style={{ textAlign:'right' }}>
                    <span style={{ color:'#94A3B8' }}>{d?.totalCalls ? `${pct(d.missed,d.totalCalls)}%` : '—'}</span>
                  </td>
                  <td style={{ textAlign:'right', color:'#7C3AED' }}>{d?.uniqueClients??'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
