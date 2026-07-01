'use client';
import { useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../../../../lib/api';
import { fmtDateTime, parseUTC } from '../../../../lib/timezone';

function Ico({ size = 16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const SearchIco = ({s=16}) => <Ico size={s}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>;
const PhoneIco  = ({s=16}) => <Ico size={s}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></Ico>;
const UserIco   = ({s=16}) => <Ico size={s}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Ico>;

const TYPE_STYLES = {
  incoming: { bg:'#F0FDF4', color:'#16A34A', border:'#BBF7D0' },
  outgoing: { bg:'#FFFBEB', color:'#D97706', border:'#FDE68A' },
  missed:   { bg:'#FFF1F2', color:'#DC2626', border:'#FECACA' },
  rejected: { bg:'#F5F3FF', color:'#7C3AED', border:'#DDD6FE' },
};
function TypeBadge({ type }) {
  const s = TYPE_STYLES[type?.toLowerCase()] || { bg:'#F1F5F9', color:'#64748B', border:'#CBD5E1' };
  return <span className="badge capitalize" style={{ background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>{type||'—'}</span>;
}

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background:'#0F172A', color:'#fff', boxShadow:'0 8px 24px rgba(0,0,0,0.25)' }}>
      <p style={{ color:'#94A3B8' }}>{label}</p>
      {payload.map((p,i) => <p key={i} className="font-bold">{p.name}: {p.value}</p>)}
    </div>
  );
};

const fmt = fmtDateTime;
const dur = s => s ? `${Math.floor(s/60)}m ${s%60}s` : '—';

export default function ClientReportPage() {
  const [query,   setQuery]   = useState('');
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [searched,setSearched]= useState(false);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(''); setSearched(true);
    try {
      const r = await api.get('/api/calls', { params: { search: query.trim(), limit: 100 } });
      const calls = r.data?.data?.calls || r.data?.data || [];
      if (!calls.length) { setResult(null); setLoading(false); return; }

      const totalCalls    = calls.length;
      const incoming      = calls.filter(c => c.callType === 'incoming').length;
      const outgoing      = calls.filter(c => c.callType === 'outgoing').length;
      const missed        = calls.filter(c => c.callType === 'missed').length;
      const connected     = calls.filter(c => c.isConnected || c.duration > 0).length;
      const totalDuration = calls.reduce((s,c) => s+(c.duration||0), 0);
      const avgDuration   = totalCalls ? Math.round(totalDuration/totalCalls) : 0;

      const employees = [...new Set(calls.map(c => c.employeeName).filter(Boolean))];

      const byDate = {};
      calls.forEach(c => {
        const d = parseUTC(c.timestamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        byDate[d] = (byDate[d]||0) + 1;
      });
      const chartData = Object.entries(byDate).sort(([a],[b])=>a>b?1:-1).map(([date,count]) => ({
        date: new Date(date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', timeZone: 'UTC' }),
        count,
      }));

      const name = calls.find(c => c.contactName && c.contactName !== 'Unknown')?.contactName || query;

      setResult({ calls, totalCalls, incoming, outgoing, missed, connected, totalDuration, avgDuration, employees, chartData, name });
    } catch { setError('Failed to fetch call data. Please try again.'); }
    setLoading(false);
  }, [query]);

  const handleKey = e => { if (e.key === 'Enter') search(); };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Client Report</h2>
        <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Track all calls for any contact by name or phone number</p>
      </div>

      {/* Search */}
      <div className="page-card p-6">
        <p className="text-sm font-semibold mb-3" style={{ color:'#0F172A' }}>Search Client</p>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color:'#94A3B8' }}><SearchIco s={16}/></span>
            <input className="form-input pl-10" placeholder="Enter name or phone number (e.g. +91 98765 43210)…"
              value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKey}/>
          </div>
          <button onClick={search} disabled={!query.trim()||loading} className="btn-primary px-6"
            style={{ opacity: !query.trim()||loading ? 0.7 : 1 }}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
        {error && <p className="text-xs mt-2" style={{ color:'#DC2626' }}>{error}</p>}
      </div>

      {/* Results */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1,2,3,4].map(i=><div key={i} className="skeleton h-24 rounded-xl"/>)}
          </div>
          <div className="skeleton h-48 rounded-xl"/>
        </div>
      )}

      {!loading && searched && !result && (
        <div className="page-card p-16 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background:'#F1F5F9', color:'#94A3B8' }}>
            <UserIco s={28}/>
          </div>
          <p className="font-bold text-sm" style={{ color:'#0F172A' }}>No records found</p>
          <p className="text-xs mt-1" style={{ color:'#94A3B8' }}>No calls found for "{query}". Try a different number or name.</p>
        </div>
      )}

      {result && (
        <>
          {/* Client card */}
          <div className="page-card p-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black flex-shrink-0"
                style={{ background:'linear-gradient(135deg,#2563EB,#60A5FA)' }}>
                {result.name[0]?.toUpperCase()||'?'}
              </div>
              <div>
                <p className="font-bold text-base" style={{ color:'#0F172A' }}>{result.name}</p>
                <p className="text-sm mt-0.5 font-mono" style={{ color:'#64748B' }}>{query}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {result.employees.map(e => (
                    <span key={e} className="badge" style={{ background:'#EFF6FF', color:'#2563EB', border:'1px solid #BFDBFE' }}>
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 stagger">
            {[
              { label:'Total Calls',   val:result.totalCalls,    color:'#2563EB', bg:'#EFF6FF' },
              { label:'Incoming',      val:result.incoming,      color:'#16A34A', bg:'#F0FDF4' },
              { label:'Outgoing',      val:result.outgoing,      color:'#D97706', bg:'#FFFBEB' },
              { label:'Missed',        val:result.missed,        color:'#DC2626', bg:'#FFF1F2' },
              { label:'Connected',     val:result.connected,     color:'#0D9488', bg:'#F0FDFA' },
              { label:'Avg Duration',  val:dur(result.avgDuration), color:'#7C3AED', bg:'#F5F3FF' },
            ].map((k,i) => (
              <div key={k.label} className="page-card p-4 animate-fade-in-up" style={{ animationDelay:`${i*0.04}s` }}>
                <div className="w-1.5 h-6 rounded-full mb-2" style={{ background:k.color }}/>
                <p className="stat-number text-xl">{k.val}</p>
                <p className="stat-label text-[10px] uppercase tracking-wider">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          {result.chartData.length > 1 && (
            <div className="page-card p-5">
              <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Call Activity Over Time</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={result.chartData}>
                  <defs>
                    <linearGradient id="clG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity={0.2}/>
                      <stop offset="100%" stopColor="#2563EB" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                  <XAxis dataKey="date" tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false} width={24} allowDecimals={false}/>
                  <Tooltip content={<ChartTip/>}/>
                  <Line type="monotone" dataKey="count" name="Calls" stroke="#2563EB" strokeWidth={2.5} dot={{ fill:'#2563EB', r:3 }} activeDot={{ r:5 }}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Call history table */}
          <div className="page-card overflow-hidden">
            <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
              <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Call History ({result.totalCalls})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table" style={{ minWidth:560 }}>
                <thead><tr><th>Date & Time</th><th>Employee</th><th>Type</th><th>Duration</th><th>Connected</th></tr></thead>
                <tbody>
                  {result.calls.map((c,i) => (
                    <tr key={c._id||i}>
                      <td className="text-xs" style={{ color:'#475569' }}>{fmt(c.timestamp)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                            style={{ background:'#2563EB' }}>{(c.employeeName||'?')[0].toUpperCase()}</div>
                          <span className="text-xs font-medium" style={{ color:'#0F172A' }}>{c.employeeName||'—'}</span>
                        </div>
                      </td>
                      <td><TypeBadge type={c.callType}/></td>
                      <td className="text-xs tabular-nums" style={{ color:'#475569' }}>{dur(c.duration)}</td>
                      <td>
                        <span className="badge" style={c.isConnected||c.duration>0
                          ?{background:'#F0FDF4',color:'#16A34A',border:'1px solid #BBF7D0'}
                          :{background:'#F8FAFC',color:'#94A3B8',border:'1px solid #E2E8F0'}}>
                          {c.isConnected||c.duration>0?'Yes':'No'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
