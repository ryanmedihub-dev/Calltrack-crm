'use client';
import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import api from '../../../../lib/api';

const TABS = ['Trends', 'Comparison', 'Patterns', 'Efficiency'];

function formatDur(sec) {
  if (!sec) return '0m';
  return `${Math.floor(sec/60)}m`;
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

export default function AdvancedAnalyticsPage() {
  const [tab,     setTab]     = useState('Trends');
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/calls/stats').then(res => setStats(res.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const today = stats?.today;
  const week  = stats?.thisWeek;
  const month = stats?.thisMonth;

  const trendData = [
    { period:'Today',      calls:today?.totalCalls||0, incoming:today?.incoming||0, outgoing:today?.outgoing||0, missed:today?.missed||0 },
    { period:'This Week',  calls:week?.totalCalls||0,  incoming:week?.incoming||0,  outgoing:week?.outgoing||0,  missed:week?.missed||0 },
    { period:'This Month', calls:month?.totalCalls||0, incoming:month?.incoming||0, outgoing:month?.outgoing||0, missed:month?.missed||0 },
  ];

  const hourlyMap = {};
  (today?.callsPerHour||[]).forEach(({ _id, count }) => { hourlyMap[_id] = count; });
  const hourlyData = Array.from({ length:24 }, (_, h) => ({ hour:`${String(h).padStart(2,'0')}h`, calls:hourlyMap[h]||0 }));
  const peakHour   = hourlyData.reduce((a,b) => b.calls > a.calls ? b : a, { calls:0, hour:'—' });

  const empData  = (today?.topDialers||[]).slice(0,6).map(d => ({ name:d.name?.split(' ')[0]||'Agent', calls:d.count }));

  const connRate = today?.totalCalls ? Math.round(((today.connectedCalls||0)/today.totalCalls)*100) : 0;
  const avgDur   = today?.totalCalls ? Math.round((today.totalDuration||0)/today.totalCalls) : 0;
  const missRate = today?.totalCalls ? Math.round(((today.missed||0)/today.totalCalls)*100) : 0;
  const outRate  = today?.totalCalls ? Math.round(((today.outgoing||0)/today.totalCalls)*100) : 0;

  const effData = [
    { metric:'Connect Rate',  value:connRate, fill:'#22C55E' },
    { metric:'Outgoing Rate', value:outRate,  fill:'#2563EB' },
    { metric:'Miss Rate',     value:missRate, fill:'#EF4444' },
  ];

  const kpis4 = (items) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
      {items.map(({label,value,color='#2563EB',sub})=>(
        <div key={label} className="page-card p-4">
          <p className="text-2xl font-bold leading-none tabular-nums" style={{ color }}>{value??'—'}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider mt-1.5" style={{ color:'#94A3B8' }}>{label}</p>
          {sub&&<p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>{sub}</p>}
        </div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1,2,3,4].map(i=><div key={i} className="skeleton h-24 rounded-xl"/>)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Advanced Analytics</h2>
        <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Deep dives into call trends, patterns, and efficiency metrics</p>
      </div>

      {/* Tab nav */}
      <div className="tab-nav">
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={`tab-item${tab===t?' active':''}`}>{t}</button>
        ))}
      </div>

      {/* ── TRENDS ── */}
      {tab==='Trends' && (
        <div className="space-y-4">
          {kpis4([
            { label:'Today',           value:today?.totalCalls,     color:'#2563EB' },
            { label:'This Week',       value:week?.totalCalls,      color:'#16A34A' },
            { label:'This Month',      value:month?.totalCalls,     color:'#7C3AED' },
            { label:'Unique Contacts', value:month?.uniqueClients,  color:'#D97706', sub:'this month' },
          ])}

          <div className="page-card p-5">
            <h3 className="font-bold text-sm mb-5" style={{ color:'#0F172A' }}>Call Volume by Period</h3>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="advG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                <XAxis dataKey="period" tick={{ fontSize:11, fill:'#94A3B8' }} tickLine={false} axisLine={false}/>
                <YAxis tick={{ fontSize:11, fill:'#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} width={28}/>
                <Tooltip content={<ChartTip/>}/>
                <Legend iconType="line" iconSize={12} wrapperStyle={{ fontSize:12 }}/>
                <Area type="monotone" dataKey="calls"    stroke="#2563EB" fill="url(#advG)" strokeWidth={2} name="Total"/>
                <Area type="monotone" dataKey="incoming" stroke="#22C55E" fill="none"       strokeWidth={2} name="Incoming" strokeDasharray="4 4"/>
                <Area type="monotone" dataKey="outgoing" stroke="#F59E0B" fill="none"       strokeWidth={2} name="Outgoing" strokeDasharray="4 4"/>
                <Area type="monotone" dataKey="missed"   stroke="#EF4444" fill="none"       strokeWidth={2} name="Missed"   strokeDasharray="4 4"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="page-card overflow-hidden">
            <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
              <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Call Type Breakdown</h3>
            </div>
            <table className="data-table">
              <thead><tr>
                <th>Type</th>
                <th style={{ textAlign:'right', color:'#2563EB' }}>Today</th>
                <th style={{ textAlign:'right' }}>This Week</th>
                <th style={{ textAlign:'right' }}>This Month</th>
              </tr></thead>
              <tbody>
                {[
                  { label:'Incoming', key:'incoming', color:'#22C55E' },
                  { label:'Outgoing', key:'outgoing', color:'#F59E0B' },
                  { label:'Missed',   key:'missed',   color:'#EF4444' },
                  { label:'Rejected', key:'rejected', color:'#7C3AED' },
                ].map(row=>(
                  <tr key={row.key}>
                    <td className="font-medium" style={{ color:row.color }}>{row.label}</td>
                    <td style={{ textAlign:'right', fontWeight:700, color:'#0F172A' }}>{today?.[row.key]??'—'}</td>
                    <td style={{ textAlign:'right', color:'#374151' }}>{week?.[row.key]??'—'}</td>
                    <td style={{ textAlign:'right', color:'#374151' }}>{month?.[row.key]??'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── COMPARISON ── */}
      {tab==='Comparison' && (
        <div className="space-y-4">
          {kpis4([
            { label:'Top Agent Calls',  value:today?.topDialers?.[0]?.count, color:'#2563EB', sub:today?.topDialers?.[0]?.name },
            { label:'Unique Clients',   value:today?.uniqueClients,          color:'#16A34A', sub:'today' },
            { label:'Not Picked Up',    value:today?.notPickedByClient,      color:'#EF4444', sub:'no callback yet' },
          ])}

          <div className="page-card p-5">
            <h3 className="font-bold text-sm mb-5" style={{ color:'#0F172A' }}>Agent Performance — Top 6 Today</h3>
            {empData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm" style={{ color:'#94A3B8' }}>No agent data for today</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={empData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                  <XAxis dataKey="name" tick={{ fontSize:11, fill:'#94A3B8' }} tickLine={false} axisLine={false}/>
                  <YAxis tick={{ fontSize:11, fill:'#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} width={28}/>
                  <Tooltip content={<ChartTip/>}/>
                  <Bar dataKey="calls" fill="#2563EB" radius={[6,6,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── PATTERNS ── */}
      {tab==='Patterns' && (
        <div className="space-y-4">
          {kpis4([
            { label:'Peak Hour',       value:peakHour.hour,                                              color:'#2563EB', sub:`${peakHour.calls} calls` },
            { label:'Calls This Hour', value:hourlyMap[new Date().getHours()]||0,                        color:'#16A34A' },
            { label:'Avg per Hour',    value:today?.totalCalls?Math.round(today.totalCalls/24):0,        color:'#D97706', sub:'today' },
          ])}

          <div className="page-card p-5">
            <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Hourly Call Distribution (Today)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourlyData} barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                <XAxis dataKey="hour" tick={{ fontSize:9, fill:'#94A3B8' }} tickLine={false} axisLine={false} interval={3}/>
                <YAxis tick={{ fontSize:10, fill:'#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} width={28}/>
                <Tooltip content={<ChartTip/>}/>
                <Bar dataKey="calls" fill="#2563EB" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="page-card p-5">
            <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Business Hours vs Off-Hours</h3>
            {(() => {
              const business = hourlyData.slice(9,19).reduce((s,h)=>s+h.calls,0);
              const off      = hourlyData.reduce((s,h)=>s+h.calls,0) - business;
              const total    = business + off || 1;
              return (
                <div className="space-y-4">
                  {[
                    { label:'Business Hours (9am–7pm)', value:business, color:'#2563EB' },
                    { label:'Off-Hours',                value:off,      color:'#94A3B8' },
                  ].map(row=>(
                    <div key={row.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span style={{ color:'#475569' }}>{row.label}</span>
                        <span className="font-bold" style={{ color:row.color }}>{row.value} ({Math.round(row.value/total*100)}%)</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background:'#E2E8F0' }}>
                        <div className="h-full rounded-full" style={{ width:`${(row.value/total)*100}%`, background:row.color }}/>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── EFFICIENCY ── */}
      {tab==='Efficiency' && (
        <div className="space-y-4">
          {kpis4([
            { label:'Connect Rate',  value:`${connRate}%`, color:'#16A34A', sub:'calls connected' },
            { label:'Avg Duration',  value:formatDur(avgDur), color:'#2563EB', sub:'per call today' },
            { label:'Miss Rate',     value:`${missRate}%`, color:'#EF4444', sub:'not answered' },
            { label:'Outgoing Rate', value:`${outRate}%`,  color:'#D97706', sub:'of total calls' },
          ])}

          <div className="page-card p-5">
            <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Efficiency Breakdown (Today)</h3>
            <div className="space-y-5">
              {effData.map(({metric,value,fill})=>(
                <div key={metric} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium" style={{ color:'#475569' }}>{metric}</span>
                    <span className="font-bold" style={{ color:fill }}>{value}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background:'#E2E8F0' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width:`${value}%`, background:fill }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="page-card p-5">
            <h3 className="font-bold text-sm mb-3" style={{ color:'#0F172A' }}>Never Attended Clients</h3>
            <div className="flex items-center gap-4 py-2">
              <div className="text-4xl font-black tabular-nums" style={{ color:'#EF4444' }}>{today?.neverAttended??'—'}</div>
              <div>
                <p className="text-sm font-medium" style={{ color:'#0F172A' }}>Clients with missed calls but no follow-up outgoing</p>
                <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>These contacts need immediate outreach attention</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
