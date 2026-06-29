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

/* Convert UTC hour array from API to IST (UTC+5:30) hour buckets */
function buildISTHourlyData(callsPerHour) {
  const istMap = {};
  for (let h = 0; h < 24; h++) istMap[h] = 0;
  (callsPerHour || []).forEach(({ hour, count }) => {
    const d = new Date(Date.UTC(2024, 0, 1, hour, 30, 0));
    const istHour = parseInt(
      d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false })
    ) % 24;
    istMap[istHour] = (istMap[istHour] || 0) + count;
  });
  return Array.from({ length: 24 }, (_, h) => ({
    h: `${String(h).padStart(2, '0')}:00`,
    calls: istMap[h] || 0,
  }));
}

const TYPE_COLOR = { incoming:'#16A34A', outgoing:'#D97706', missed:'#DC2626', rejected:'#7C3AED' };
const TYPE_BG    = { incoming:'rgba(22,163,74,0.08)', outgoing:'rgba(217,119,6,0.08)', missed:'rgba(220,38,38,0.08)', rejected:'rgba(124,58,237,0.08)' };
const AVATAR_COLORS = ['#2563EB','#16A34A','#D97706','#DC2626','#0D9488','#7C3AED'];

function Ico({ size = 16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

function KpiCard({ label, value, sub, color = '#2563EB', bg = '#EFF6FF', icon }) {
  return (
    <div className="page-card p-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background:bg, color }}>
          {icon}
        </div>
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background:'#22C55E' }} />
      </div>
      <p className="text-2xl font-bold leading-none tabular-nums" style={{ color:'#0F172A', letterSpacing:'-0.03em' }}>{value ?? '—'}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color:'#94A3B8' }}>{label}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>{sub}</p>}
    </div>
  );
}

const PhoneIco    = () => <Ico><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></Ico>;
const CheckIco    = () => <Ico><polyline points="20 6 9 17 4 12"/></Ico>;
const MissedIco   = () => <Ico><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/></Ico>;
const RejectIco   = () => <Ico><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></Ico>;
const UsersIco    = () => <Ico><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Ico>;
const InIco       = () => <Ico><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></Ico>;
const OutIco      = () => <Ico><polyline points="1 6 10.5 15.5 15.5 10.5 23 18"/><polyline points="7 6 1 6 1 12"/></Ico>;
const ClockIco    = () => <Ico><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Ico>;

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
  const activeAgents = employees.filter(emp => {
    const last = liveFeed.find(c => c.employeeId === emp._id?.toString());
    return last && (Date.now() - new Date(last.timestamp)) < 60*60*1000;
  }).length;

  const empLastCall = {};
  liveFeed.forEach(c => { if (!empLastCall[c.employeeId]) empLastCall[c.employeeId] = c; });

  const hourlyData = buildISTHourlyData(stats?.callsPerHour);

  const compRows = [
    { label:'Total Calls',     today:today?.totalCalls,    week:stats?.thisWeek?.totalCalls,    month:stats?.thisMonth?.totalCalls },
    { label:'Incoming',        today:today?.incoming,      week:stats?.thisWeek?.incoming,      month:stats?.thisMonth?.incoming },
    { label:'Outgoing',        today:today?.outgoing,      week:stats?.thisWeek?.outgoing,      month:stats?.thisMonth?.outgoing },
    { label:'Missed',          today:today?.missed,        week:stats?.thisWeek?.missed,        month:stats?.thisMonth?.missed },
    { label:'Connected',       today:today?.connectedCalls,week:stats?.thisWeek?.connectedCalls,month:stats?.thisMonth?.connectedCalls },
    { label:'Unique Contacts', today:today?.uniqueClients, week:stats?.thisWeek?.uniqueClients, month:stats?.thisMonth?.uniqueClients },
  ];

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i=><div key={i} className="skeleton h-24 rounded-xl"/>)}
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
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Real-time call activity · auto-refreshes every 30s · IST timezone</p>
        </div>
      </div>

      {/* KPI row 1 - call volume stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <KpiCard label="Calls Today"   value={today?.totalCalls}  color="#2563EB" bg="#EFF6FF"
          icon={<PhoneIco />} />
        <KpiCard label="Connected"     value={today?.connectedCalls} color="#16A34A" bg="#F0FDF4"
          sub={today?.totalCalls ? `${Math.round((today.connectedCalls||0)/today.totalCalls*100)}% rate` : undefined}
          icon={<CheckIco />} />
        <KpiCard label="Incoming"      value={today?.incoming}    color="#0D9488" bg="#F0FDFA"
          icon={<InIco />} />
        <KpiCard label="Outgoing"      value={today?.outgoing}    color="#D97706" bg="#FFFBEB"
          icon={<OutIco />} />
      </div>

      {/* KPI row 2 - failure + team stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <KpiCard label="Missed"        value={today?.missed}      color="#DC2626" bg="#FFF1F2"
          sub={today?.totalCalls ? `${Math.round((today.missed||0)/today.totalCalls*100)}% of calls` : undefined}
          icon={<MissedIco />} />
        <KpiCard label="Rejected"      value={today?.rejected||today?.notPickedByClient} color="#7C3AED" bg="#F5F3FF"
          icon={<RejectIco />} />
        <KpiCard label="Active Agents" value={activeAgents}       color="#0891B2" bg="#EFF6FF"
          sub={`of ${employees.length} total`}
          icon={<UsersIco />} />
        <KpiCard label="Avg Duration"  value={formatDur(avgDur)}  color="#D97706" bg="#FFFBEB"
          sub="per call today"
          icon={<ClockIco />} />
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
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs" style={{ color:'#94A3B8' }}>{timeAgo(call.timestamp)}</p>
                  <p className="text-[11px] mt-0.5" style={{ color:'#94A3B8' }}>
                    {new Date(call.timestamp).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'})}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Status */}
        <div className="page-card overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
            <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Team Status</h3>
            <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>{employees.length} agents · {activeAgents} active</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {employees.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-sm" style={{ color:'#94A3B8' }}>No agents</div>
            ) : employees.map((emp,i)=>{
              const last   = empLastCall[emp._id?.toString()];
              const active = last && (Date.now() - new Date(last.timestamp)) < 60*60*1000;
              const lastType = last?.callType;
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
                  {active && lastType && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 capitalize"
                      style={{ background:TYPE_BG[lastType]||'#F1F5F9', color:TYPE_COLOR[lastType]||'#64748B' }}>
                      {lastType}
                    </span>
                  )}
                  {!active && last && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background:'#F1F5F9', color:'#94A3B8' }}>
                      Idle
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hourly chart (IST) */}
      <div className="page-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Calls by Hour (IST)</h3>
            <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>Hourly distribution in Indian Standard Time</p>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background:'rgba(22,163,74,0.08)', color:'#16A34A', border:'1px solid rgba(22,163,74,0.20)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:'#22C55E' }} />
            Today
          </span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={hourlyData} barSize={10}>
            <defs>
              <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9}/>
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.4}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
            <XAxis dataKey="h" tick={{ fontSize:9, fill:'#94A3B8' }} interval={2} tickLine={false} axisLine={false}/>
            <YAxis tick={{ fontSize:10, fill:'#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} width={24}/>
            <Tooltip
              contentStyle={{ borderRadius:8, border:'1px solid #E2E8F0', fontSize:12, boxShadow:'0 4px 16px rgba(0,0,0,0.08)' }}
              cursor={{ fill:'rgba(37,99,235,0.05)' }}
              formatter={(v)=>[v,'Calls']}
            />
            <Bar dataKey="calls" fill="url(#hrGrad)" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Period Comparison */}
      <div className="page-card overflow-hidden">
        <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
          <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Period Comparison</h3>
          <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>Today · This Week · This Month</p>
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
