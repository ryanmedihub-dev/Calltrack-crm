'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts';
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

function pct(num, den) { return den ? Math.round((num / den) * 100) : 0; }

const AVATAR_COLORS = ['#2563EB','#16A34A','#D97706','#DC2626','#0D9488','#7C3AED','#0891B2','#BE185D'];
const MEDAL = ['#F59E0B','#94A3B8','#B45309'];
const MEDAL_BG = ['rgba(245,158,11,0.12)','rgba(148,163,184,0.12)','rgba(180,83,9,0.12)'];

export default function AgentReportsPage() {
  const [stats,     setStats]     = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [sortBy,    setSortBy]    = useState('calls');

  useEffect(() => {
    Promise.all([api.get('/api/calls/stats'), api.get('/api/employees')])
      .then(([s,e]) => { setStats(s.data.data); setEmployees(e.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = stats?.today;
  const totalCalls = today?.totalCalls || 0;

  const agentData = employees.map((emp, i) => {
    const dialer = stats?.topDialers?.find(d => d.employeeId === emp._id);
    const calls  = dialer?.count || 0;
    const missed = dialer?.missed || 0;
    const conn   = dialer?.connected || 0;
    return {
      id:       emp._id,
      name:     emp.name,
      role:     emp.role,
      calls,
      missed,
      connected:  conn,
      connRate:   pct(conn, calls),
      missRate:   pct(missed, calls),
      share:      pct(calls, totalCalls),
      avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
      isActive:   emp.isActive,
    };
  }).sort((a, b) => {
    if (sortBy === 'calls')    return b.calls    - a.calls;
    if (sortBy === 'connRate') return b.connRate - a.connRate;
    if (sortBy === 'missed')   return b.missed   - a.missed;
    return 0;
  });

  const barData = agentData.slice(0, 10).map(a => ({
    name:  a.name.split(' ')[0],
    full:  a.name,
    calls: a.calls,
  }));

  const topAgent = agentData[0];
  const bestConn = [...agentData].sort((a,b)=>b.connRate-a.connRate)[0];

  if (loading) return (
    <div className="space-y-5">
      <div className="skeleton h-8 w-56 rounded-xl" />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[1,2,3,4].map(i=><div key={i} className="skeleton h-24 rounded-xl"/>)}
      </div>
      <div className="skeleton h-64 rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Agent Reports</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Per-agent performance breakdown · Today</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background:'#F1F5F9' }}>
          {[['calls','By Calls'],['connRate','By Conn. Rate'],['missed','By Missed']].map(([v,l])=>(
            <button key={v} onClick={()=>setSortBy(v)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={sortBy===v
                ? { background:'#fff', color:'#0F172A', boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }
                : { color:'#64748B' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Highlight cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger">
        {[
          { label:'Total Agents',   value:employees.length,       sub:'In system',          color:'#2563EB', bg:'#EFF6FF' },
          { label:'Active Today',   value:agentData.filter(a=>a.calls>0).length, sub:'Made at least 1 call', color:'#16A34A', bg:'#F0FDF4' },
          { label:'Top Dialer',     value:topAgent?.calls||'—',  sub:topAgent?.name||'No data', color:'#D97706', bg:'#FFFBEB' },
          { label:'Best Conn. Rate',value:bestConn?.connRate!=null?`${bestConn.connRate}%`:'—', sub:bestConn?.name||'No data', color:'#7C3AED', bg:'#F5F3FF' },
        ].map((c,i)=>(
          <div key={c.label} className="page-card p-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background:c.bg, color:c.color }}>
              <Ico size={16}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Ico>
            </div>
            <p className="text-2xl font-extrabold leading-none tabular-nums" style={{ color:'#0F172A', letterSpacing:'-0.03em' }}>{c.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color:'#94A3B8' }}>{c.label}</p>
            <p className="text-[11px] mt-0.5 truncate" style={{ color:'#94A3B8' }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="page-card p-5">
        <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Agent Call Volume (Top 10)</h3>
        {barData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm" style={{ color:'#94A3B8' }}>No call data today</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} barCategoryGap="35%">
              <defs>
                <linearGradient id="agG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9}/>
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.4}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
              <XAxis dataKey="name" tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false} width={28} allowDecimals={false}/>
              <Tooltip content={<ChartTip />} formatter={(v,n,p)=>[v, p.payload.full]}/>
              <Bar dataKey="calls" name="Calls" fill="url(#agG)" radius={[5,5,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Detailed table */}
      <div className="page-card overflow-hidden">
        <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
          <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Agent Breakdown</h3>
          <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>All agents · Today's metrics</p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table" style={{ minWidth:720 }}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Agent</th>
                <th style={{ textAlign:'right' }}>Calls</th>
                <th style={{ textAlign:'right' }}>Connected</th>
                <th style={{ textAlign:'right' }}>Conn. Rate</th>
                <th style={{ textAlign:'right' }}>Missed</th>
                <th style={{ textAlign:'right' }}>Miss Rate</th>
                <th style={{ textAlign:'right' }}>Share</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {agentData.map((a, i) => (
                <tr key={a.id}>
                  <td>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold"
                      style={{ background:i<3?MEDAL_BG[i]:'#F1F5F9', color:i<3?MEDAL[i]:'#94A3B8' }}>
                      {i+1}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: a.avatarColor }}>
                        {a.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold" style={{ color:'#0F172A' }}>{a.name}</p>
                        <p className="text-[10px] capitalize" style={{ color:'#94A3B8' }}>{a.role}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign:'right' }}>
                    <span className="font-bold tabular-nums" style={{ color:a.calls>0?'#2563EB':'#CBD5E1', fontSize:15 }}>{a.calls}</span>
                  </td>
                  <td style={{ textAlign:'right' }}>
                    <span className="text-sm font-semibold" style={{ color:'#0D9488' }}>{a.connected}</span>
                  </td>
                  <td style={{ textAlign:'right' }}>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: a.connRate >= 70 ? 'rgba(22,163,74,0.1)' : a.connRate >= 40 ? 'rgba(217,119,6,0.1)' : 'rgba(220,38,38,0.1)',
                        color:      a.connRate >= 70 ? '#16A34A' : a.connRate >= 40 ? '#D97706' : '#DC2626',
                      }}>
                      {a.connRate}%
                    </span>
                  </td>
                  <td style={{ textAlign:'right' }}>
                    <span className="text-sm font-semibold" style={{ color:'#DC2626' }}>{a.missed}</span>
                  </td>
                  <td style={{ textAlign:'right' }}>
                    <span className="text-xs" style={{ color:'#94A3B8' }}>{a.missRate}%</span>
                  </td>
                  <td style={{ textAlign:'right' }}>
                    <div className="flex items-center justify-end gap-2">
                      <div className="flex-1 max-w-16 h-1.5 rounded-full overflow-hidden" style={{ background:'#F1F5F9' }}>
                        <div className="h-full rounded-full" style={{ width:`${a.share}%`, background:'#2563EB' }}/>
                      </div>
                      <span className="text-[11px]" style={{ color:'#94A3B8' }}>{a.share}%</span>
                    </div>
                  </td>
                  <td>
                    <span className="badge text-[11px]"
                      style={a.isActive
                        ? { background:'rgba(22,163,74,0.08)', color:'#16A34A', border:'1px solid rgba(22,163,74,0.22)' }
                        : { background:'#F1F5F9', color:'#64748B', border:'1px solid #E2E8F0' }}>
                      {a.isActive?'Active':'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {agentData.length===0&&<tr><td colSpan={9} className="py-10 text-center text-sm" style={{ color:'#94A3B8' }}>No agent data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
