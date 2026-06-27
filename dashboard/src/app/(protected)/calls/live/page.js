'use client';
import { useEffect, useState } from 'react';
import Pusher from 'pusher-js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../../../../lib/api';

function formatDur(sec) {
  if (!sec) return '0s';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  return `${Math.floor(diff/3600)}h ago`;
}

const TYPE_COLOR = { incoming:'#16A34A', outgoing:'#D97706', missed:'#DC2626', rejected:'#7C3AED' };
const TYPE_BG    = { incoming:'rgba(22,163,74,0.08)', outgoing:'rgba(217,119,6,0.08)', missed:'rgba(220,38,38,0.08)', rejected:'rgba(124,58,237,0.08)' };

function KpiCard({ label, value, sub, color = '#2563EB', bg = '#EFF6FF' }) {
  return (
    <div className="page-card p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background:bg, color }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </div>
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background:'#22C55E' }} />
      </div>
      <p className="text-2xl font-bold leading-none tabular-nums" style={{ color:'#0F172A', letterSpacing:'-0.03em' }}>{value ?? '—'}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider mt-1" style={{ color:'#94A3B8' }}>{label}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>{sub}</p>}
    </div>
  );
}

const AVATAR_COLORS = ['#2563EB','#16A34A','#D97706','#DC2626','#0D9488','#7C3AED'];

export default function LiveMonitorPage() {
  const [stats,     setStats]     = useState(null);
  const [liveFeed,  setLiveFeed]  = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const fetchStats = async () => {
    try { const res = await api.get('/api/calls/stats'); setStats(res.data.data); } catch {}
  };

  useEffect(() => {
    (async () => {
      await Promise.all([
        fetchStats(),
        api.get('/api/calls/realtime').then(r=>setLiveFeed((r.data.data||[]).slice(0,30))).catch(()=>{}),
        api.get('/api/employees').then(r=>setEmployees(r.data.data||[])).catch(()=>{}),
      ]);
      setLoading(false);
    })();

    const interval = setInterval(fetchStats, 30000);
    if (!process.env.NEXT_PUBLIC_PUSHER_KEY) return () => clearInterval(interval);

    const pusher  = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER||'ap2' });
    const channel = pusher.subscribe('managers');
    channel.bind('new_call_log', data => { setLiveFeed(prev=>[data,...prev].slice(0,30)); fetchStats(); });
    return () => { clearInterval(interval); channel.unbind_all(); pusher.unsubscribe('managers'); pusher.disconnect(); };
  }, []);

  const today  = stats?.today;
  const avgDur = today?.totalCalls ? Math.round((today.totalDuration||0)/today.totalCalls) : 0;

  const empLastCall = {};
  liveFeed.forEach(c => { if (!empLastCall[c.employeeId]) empLastCall[c.employeeId] = c; });

  const hourlyMap = {};
  (stats?.callsPerHour||[]).forEach(({hour,count}) => { hourlyMap[hour] = count; });
  const hourlyData = Array.from({length:24},(_,h) => ({ h:`${String(h).padStart(2,'0')}:00`, calls:hourlyMap[h]||0 }));

  const compRows = [
    { label:'Total Calls',     today:today?.totalCalls,    week:stats?.thisWeek?.totalCalls,    month:stats?.thisMonth?.totalCalls },
    { label:'Incoming',        today:today?.incoming,      week:stats?.thisWeek?.incoming,      month:stats?.thisMonth?.incoming },
    { label:'Outgoing',        today:today?.outgoing,      week:stats?.thisWeek?.outgoing,      month:stats?.thisMonth?.outgoing },
    { label:'Missed',          today:today?.missed,        week:stats?.thisWeek?.missed,        month:stats?.thisMonth?.missed },
    { label:'Unique Contacts', today:today?.uniqueClients, week:stats?.thisWeek?.uniqueClients, month:stats?.thisMonth?.uniqueClients },
  ];

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i=><div key={i} className="skeleton h-24 rounded-xl"/>)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2.5" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>
            Live Monitor
            <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background:'rgba(22,163,74,0.08)', color:'#16A34A', border:'1px solid rgba(22,163,74,0.20)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:'#22C55E' }} />
              LIVE
            </span>
          </h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Real-time call activity · auto-refreshes every 30s</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <KpiCard label="Calls Today"   value={today?.totalCalls}       color="#2563EB" bg="#EFF6FF" />
        <KpiCard label="Active Agents" value={employees.length}         color="#16A34A" bg="#F0FDF4" />
        <KpiCard label="Avg Duration"  value={formatDur(avgDur)} sub="per call" color="#D97706" bg="#FFFBEB" />
        <KpiCard label="Not Picked Up" value={today?.notPickedByClient} color="#DC2626" bg="#FFF1F2" />
      </div>

      {/* Feed + Team */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Live Feed */}
        <div className="xl:col-span-2 page-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
            <div>
              <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Live Call Feed</h3>
              <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>{liveFeed.length} recent events</p>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {liveFeed.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <p className="text-sm" style={{ color:'#94A3B8' }}>Waiting for live calls…</p>
              </div>
            ) : liveFeed.map((call,i)=>(
              <div key={call._id||i} className="flex items-center gap-3 px-5 py-3 transition-colors"
                style={{ borderBottom:'1px solid #F1F5F9' }}
                onMouseEnter={e=>e.currentTarget.style.background='#F8FAFC'}
                onMouseLeave={e=>e.currentTarget.style.background=''}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{ background:'#2563EB' }}>
                  {(call.employeeName||'U').slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate" style={{ color:'#0F172A' }}>{call.contactName||call.contactNumber}</span>
                    <span className="badge text-[10px]"
                      style={{ background:TYPE_BG[call.callType]||'#F1F5F9', color:TYPE_COLOR[call.callType]||'#64748B' }}>
                      {call.callType}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>{call.employeeName} · {formatDur(call.duration)}</p>
                </div>
                <p className="text-xs flex-shrink-0" style={{ color:'#94A3B8' }}>{timeAgo(call.timestamp)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Team Status */}
        <div className="page-card overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
            <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Team Status</h3>
            <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>{employees.length} agents</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {employees.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-sm" style={{ color:'#94A3B8' }}>No agents</div>
            ) : employees.map((emp,i)=>{
              const last   = empLastCall[emp._id?.toString()];
              const active = last && (Date.now() - new Date(last.timestamp)) < 60*60*1000;
              return (
                <div key={emp._id} className="flex items-center gap-3 px-5 py-3 transition-colors"
                  style={{ borderBottom:'1px solid #F1F5F9' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#F8FAFC'}
                  onMouseLeave={e=>e.currentTarget.style.background=''}>
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                      style={{ background:AVATAR_COLORS[i%AVATAR_COLORS.length] }}>
                      {emp.name.slice(0,2).toUpperCase()}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
                      style={{ background:active?'#22C55E':'#CBD5E1' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color:'#0F172A' }}>{emp.name}</p>
                    <p className="text-[11px]" style={{ color:'#94A3B8' }}>{last?timeAgo(last.timestamp):'No calls today'}</p>
                  </div>
                  {active && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background:'rgba(22,163,74,0.08)', color:'#16A34A', border:'1px solid rgba(22,163,74,0.22)' }}>
                      Active
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hourly chart */}
      <div className="page-card p-5">
        <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Calls by Hour (Today)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={hourlyData} barSize={8}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
            <XAxis dataKey="h" tick={{ fontSize:10, fill:'#94A3B8' }} interval={3} tickLine={false} axisLine={false}/>
            <YAxis tick={{ fontSize:10, fill:'#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} width={24}/>
            <Tooltip contentStyle={{ borderRadius:8, border:'1px solid #E2E8F0', fontSize:12 }} cursor={{ fill:'#F1F5F9' }}/>
            <Bar dataKey="calls" fill="#2563EB" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Period Comparison */}
      <div className="page-card overflow-hidden">
        <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
          <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Period Comparison</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr>
              <th>Metric</th>
              <th style={{ textAlign:'right', color:'#2563EB' }}>Today</th>
              <th style={{ textAlign:'right' }}>This Week</th>
              <th style={{ textAlign:'right' }}>This Month</th>
            </tr></thead>
            <tbody>
              {compRows.map(row=>(
                <tr key={row.label}>
                  <td className="font-medium" style={{ color:'#0F172A' }}>{row.label}</td>
                  <td style={{ textAlign:'right', fontWeight:700, color:'#2563EB' }}>{row.today??'—'}</td>
                  <td style={{ textAlign:'right', color:'#374151' }}>{row.week??'—'}</td>
                  <td style={{ textAlign:'right', color:'#374151' }}>{row.month??'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
