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
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background:'#1A1726', color:'#fff', boxShadow:'0 8px 24px rgba(26,23,38,0.25)' }}>
      <p style={{ color: '#6B6880' }}>{label}</p>
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
  const week  = stats?.lastWeek;   // API has no thisWeek/thisMonth — these always rendered "—"
  const month = stats?.lastMonth;

  const trendData = [
    { period:'Today',      calls:today?.totalCalls||0, incoming:today?.incoming||0, outgoing:today?.outgoing||0, missed:today?.missed||0 },
    { period:'Last 7 days',  calls:week?.totalCalls||0,  incoming:week?.incoming||0,  outgoing:week?.outgoing||0,  missed:week?.missed||0 },
    { period:'Last 30 days', calls:month?.totalCalls||0, incoming:month?.incoming||0, outgoing:month?.outgoing||0, missed:month?.missed||0 },
  ];

  const hourlyMap = {};
  (today?.callsPerHour||[]).forEach(({ hour, count }) => { hourlyMap[hour] = count; }); // IST hour buckets
  const hourlyData = Array.from({ length:24 }, (_, h) => ({ hour:`${h % 12 || 12}${h >= 12 ? 'p' : 'a'}`, calls:hourlyMap[h]||0 }));
  const peakHour   = hourlyData.reduce((a,b) => b.calls > a.calls ? b : a, { calls:0, hour:'—' });

  const empData  = (today?.topDialers||[]).slice(0,6).map(d => ({ name:d.name?.split(' ')[0]||'Agent', calls:d.count }));

  const connRate = today?.totalCalls ? Math.round(((today.connectedCalls||0)/today.totalCalls)*100) : 0;
  const avgDur   = today?.avgDuration || 0;
  const missRate = today?.totalCalls ? Math.round(((today.missed||0)/today.totalCalls)*100) : 0;
  const outRate  = today?.totalCalls ? Math.round(((today.outgoing||0)/today.totalCalls)*100) : 0;

  const effData = [
    { metric:'Connect Rate',  value:connRate, fill:'#079455' },
    { metric:'Outgoing Rate', value:outRate,  fill:'#7C3AED' },
    { metric:'Miss Rate',     value:missRate, fill:'#D92D20' },
  ];

  const kpis4 = (items) => (
    <div className="panel overflow-hidden grid grid-cols-2 md:grid-cols-4 [&>*]:border-line-2 [&>*]:border-b md:[&>*]:border-b-0 md:divide-x divide-line-2">
      {items.map(({label,value,sub})=>(
        <div key={label} className="px-5 py-4 min-w-0">
          <p className="stat-label truncate">{label}</p>
          <p className="stat-number mt-1">{typeof value === 'number' ? value.toLocaleString('en-IN') : (value ?? '—')}</p>
          {sub && <p className="text-xs text-ink-3 mt-1 truncate">{sub}</p>}
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
        <h2 className="page-title">Advanced Analytics</h2>
        <p className="page-subtitle">Deep dives into call trends, patterns, and efficiency metrics</p>
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
            { label:'Today',           value:today?.totalCalls },
            { label:'Last 7 days',     value:week?.totalCalls },
            { label:'Last 30 days',    value:month?.totalCalls },
            { label:'Unique contacts', value:month?.uniqueClients, sub:'last 30 days' },
          ])}

          <div className="page-card p-5">
            <h3 className="panel-title mb-5">Call Volume by Period</h3>
            <ResponsiveContainer width="100%" height={240}>
              {/* Separate periods, not a time series: grouped bars, never a line joining them. */}
              <BarChart data={trendData} barGap={3} barCategoryGap="30%">
                <CartesianGrid stroke="#F1F0F5" vertical={false}/>
                <XAxis dataKey="period" tick={{ fontSize:12 }} tickLine={false} axisLine={false}/>
                <YAxis tick={{ fontSize:11 }} tickLine={false} axisLine={false} allowDecimals={false} width={36}/>
                <Tooltip content={<ChartTip/>} cursor={{ fill: 'rgba(26,23,38,0.03)' }}/>
                <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize:12, color:'#4A4658' }}/>
                <Bar dataKey="outgoing" fill="#7C3AED" radius={[3,3,0,0]} name="Outgoing" isAnimationActive={false}/>
                <Bar dataKey="incoming" fill="#0E9384" radius={[3,3,0,0]} name="Incoming" isAnimationActive={false}/>
                <Bar dataKey="missed"   fill="#D92D20" radius={[3,3,0,0]} name="Missed"   isAnimationActive={false}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="page-card overflow-hidden">
            <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E9E7EF' }}>
              <h3 className="panel-title">Call Type Breakdown</h3>
            </div>
            <table className="data-table">
              <thead><tr>
                <th>Type</th>
                <th style={{ textAlign:'right' }}>Today</th>
                <th style={{ textAlign:'right' }}>Last 7 days</th>
                <th style={{ textAlign:'right' }}>Last 30 days</th>
              </tr></thead>
              <tbody>
                {[
                  { label:'Incoming', key:'incoming', color:'#0E9384' },
                  { label:'Outgoing', key:'outgoing', color:'#7C3AED' },
                  { label:'Missed',   key:'missed',   color:'#D92D20' },
                  { label:'Rejected', key:'rejected', color:'#B54708' },
                ].map(row=>(
                  <tr key={row.key}>
                    <td><span className="inline-flex items-center gap-2 text-ink-2"><span className="w-2 h-2 rounded-sm" style={{ background: row.color }} />{row.label}</span></td>
                    <td style={{ textAlign:'right', fontWeight:700, color:'#1A1726' }}>{today?.[row.key]??'—'}</td>
                    <td style={{ textAlign:'right', color:'#4A4658' }}>{week?.[row.key]??'—'}</td>
                    <td style={{ textAlign:'right', color:'#4A4658' }}>{month?.[row.key]??'—'}</td>
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
            { label:'Top Agent Calls',  value:today?.topDialers?.[0]?.count, color:'#7C3AED', sub:today?.topDialers?.[0]?.name },
            { label:'Unique Clients',   value:today?.uniqueClients,          color:'#079455', sub:'today' },
            { label:'Not Picked Up',    value:today?.notPickupByClient,      color:'#D92D20', sub:'no callback yet' },
          ])}

          <div className="page-card p-5">
            <h3 className="panel-title mb-5">Agent Performance — Top 6 Today</h3>
            {empData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm" style={{ color: '#6B6880' }}>No agent data for today</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={empData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F4F3F8" vertical={false}/>
                  <XAxis dataKey="name" tick={{ fontSize:11, fill:'#A19DB2' }} tickLine={false} axisLine={false}/>
                  <YAxis tick={{ fontSize:11, fill:'#A19DB2' }} tickLine={false} axisLine={false} allowDecimals={false} width={28}/>
                  <Tooltip content={<ChartTip/>}/>
                  <Bar dataKey="calls" fill="#7C3AED" radius={[6,6,0,0]}/>
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
            { label:'Peak Hour',       value:peakHour.hour,                                              color:'#7C3AED', sub:`${peakHour.calls} calls` },
            { label:'Calls This Hour', value:hourlyMap[new Date().getHours()]||0,                        color:'#079455' },
            { label:'Avg per Hour',    value:today?.totalCalls?Math.round(today.totalCalls/24):0,        color:'#B54708', sub:'today' },
          ])}

          <div className="page-card p-5">
            <h3 className="panel-title mb-4">Hourly Call Distribution (Today)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourlyData} barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F4F3F8" vertical={false}/>
                <XAxis dataKey="hour" tick={{ fontSize:9, fill:'#A19DB2' }} tickLine={false} axisLine={false} interval={3}/>
                <YAxis tick={{ fontSize:10, fill:'#A19DB2' }} tickLine={false} axisLine={false} allowDecimals={false} width={28}/>
                <Tooltip content={<ChartTip/>}/>
                <Bar dataKey="calls" fill="#7C3AED" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="page-card p-5">
            <h3 className="panel-title mb-4">Business Hours vs Off-Hours</h3>
            {(() => {
              const business = hourlyData.slice(9,19).reduce((s,h)=>s+h.calls,0);
              const off      = hourlyData.reduce((s,h)=>s+h.calls,0) - business;
              const total    = business + off || 1;
              return (
                <div className="space-y-4">
                  {[
                    { label:'Business hours (9 AM–7 PM)', value:business, color:'#1A1726' },
                    { label:'Off-Hours',                value:off,      color: '#6B6880' },
                  ].map(row=>(
                    <div key={row.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span style={{ color:'#524F63' }}>{row.label}</span>
                        <span className="font-bold" style={{ color:row.color }}>{row.value} ({Math.round(row.value/total*100)}%)</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background:'#E9E7EF' }}>
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
            { label:'Connect Rate',  value:`${connRate}%`, color:'#079455', sub:'calls connected' },
            { label:'Avg Duration',  value:formatDur(avgDur), color:'#7C3AED', sub:'per call today' },
            { label:'Miss Rate',     value:`${missRate}%`, color:'#D92D20', sub:'not answered' },
            { label:'Outgoing Rate', value:`${outRate}%`,  color:'#B54708', sub:'of total calls' },
          ])}

          <div className="page-card p-5">
            <h3 className="panel-title mb-4">Efficiency Breakdown (Today)</h3>
            <div className="space-y-5">
              {effData.map(({metric,value,fill})=>(
                <div key={metric} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium" style={{ color:'#524F63' }}>{metric}</span>
                    <span className="font-bold" style={{ color:fill }}>{value}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background:'#E9E7EF' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width:`${value}%`, background:fill }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="page-card p-5">
            <h3 className="panel-title mb-3">Never Attended Clients</h3>
            <div className="flex items-center gap-4 py-2">
              <div className="text-4xl font-black tabular-nums" style={{ color:'#D92D20' }}>{today?.neverAttended??'—'}</div>
              <div>
                <p className="text-sm font-medium" style={{ color:'#1A1726' }}>Clients with missed calls but no follow-up outgoing</p>
                <p className="text-xs mt-0.5" style={{ color: '#6B6880' }}>These contacts need immediate outreach attention</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
