'use client';
import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import api from '../../../../lib/api';
import { fmtDateTime } from '../../../../lib/timezone';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const SearchIco   = ({s=13}) => <Ico size={s}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>;
const DownloadIco = ({s=13}) => <Ico size={s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Ico>;

const TYPE_STYLES = {
  incoming:{ bg:'#F0FDF4', color:'#16A34A', border:'#BBF7D0' },
  outgoing:{ bg:'#FFFBEB', color:'#D97706', border:'#FDE68A' },
  missed:  { bg:'#FFF1F2', color:'#DC2626', border:'#FECACA' },
  rejected:{ bg:'#F5F3FF', color:'#7C3AED', border:'#DDD6FE' },
};
function TypeBadge({ type }) {
  const s = TYPE_STYLES[type?.toLowerCase()]||{ bg:'#F1F5F9', color:'#64748B', border:'#CBD5E1' };
  return <span className="badge capitalize" style={{ background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>{type||'—'}</span>;
}

const PERIODS = [{ k:'today',l:'Today' },{ k:'week',l:'This Week' },{ k:'month',l:'This Month' }];
const fmt = fmtDateTime;
const dur = s  => s  ? `${Math.floor(s/60)}m ${s%60}s` : '—';

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg px-3 py-2 text-xs" style={{ background:'#0F172A', color:'#fff' }}>
    <p style={{ color:'#94A3B8' }}>{label}</p>
    {payload.map((p,i)=><p key={i} className="font-bold">{p.name}: {p.value}</p>)}
  </div>;
};

export default function CallLogsReportPage() {
  const [period,    setPeriod]    = useState('week');
  const [stats,     setStats]     = useState(null);
  const [calls,     setCalls]     = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filters,   setFilters]   = useState({ search:'', callType:'', employee:'' });
  const [page,      setPage]      = useState(1);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState('summary');
  const PER_PAGE = 25;

  const setF = (k,v) => { setFilters(f=>({...f,[k]:v})); setPage(1); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, callsRes] = await Promise.allSettled([
        api.get('/api/calls/stats'),
        api.get('/api/calls', { params:{ page, limit:PER_PAGE, search:filters.search||undefined, callType:filters.callType||undefined, employee:filters.employee||undefined } }),
      ]);
      if (statsRes.status==='fulfilled') setStats(statsRes.value.data?.data);
      if (callsRes.status==='fulfilled') {
        setCalls(callsRes.value.data?.data?.calls||callsRes.value.data?.data||[]);
        setTotal(callsRes.value.data?.data?.total||0);
      }
    } catch {}
    setLoading(false);
  }, [period, page, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/api/employees').then(r=>setEmployees(r.data?.data||[])).catch(()=>{}); }, []);

  const periodData = period==='today'?stats?.today:period==='week'?stats?.lastWeek:stats?.lastMonth;
  const totalPages = Math.ceil(total/PER_PAGE);

  const exportCSV = () => {
    const head = ['Employee','Contact','Type','Duration','Date','Connected'];
    const rows = calls.map(c=>[c.employeeName||'',c.contactNumber||'',c.callType||'',dur(c.duration),fmt(c.timestamp),c.isConnected||c.duration>0?'Yes':'No']);
    const csv  = [head,...rows].map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href=url; a.download='call-logs-report.csv'; a.click();
  };

  const kpis = [
    { label:'Total Calls',   val:periodData?.totalCalls,    color:'#2563EB' },
    { label:'Incoming',      val:periodData?.incoming,      color:'#16A34A' },
    { label:'Outgoing',      val:periodData?.outgoing,      color:'#D97706' },
    { label:'Missed',        val:periodData?.missed,        color:'#DC2626' },
    { label:'Connected',     val:periodData?.connectedCalls,color:'#0D9488' },
    { label:'Unique Clients',val:periodData?.uniqueClients, color:'#7C3AED' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Call Logs Report</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Detailed call logs with filters, metrics, and trends</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 p-1 rounded-xl" style={{ background:'#fff', border:'1px solid #E2E8F0' }}>
            {PERIODS.map(p=>(
              <button key={p.k} onClick={()=>setPeriod(p.k)}
                className="px-3 h-7 flex items-center rounded-lg text-xs font-semibold transition-all"
                style={period===p.k?{background:'#2563EB',color:'#fff',boxShadow:'0 2px 6px rgba(37,99,235,0.25)'}:{color:'#94A3B8'}}>
                {p.l}
              </button>
            ))}
          </div>
          <button onClick={exportCSV} className="btn-secondary text-xs py-1.5 px-3"><DownloadIco/> Export</button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 stagger">
        {kpis.map((k,i)=>(
          <div key={k.label} className="page-card p-4 animate-fade-in-up" style={{ animationDelay:`${i*0.04}s` }}>
            <div className="w-2 h-5 rounded-full mb-2" style={{ background:k.color }}/>
            <p className="stat-number text-xl">{loading?<span className="skeleton inline-block w-10 h-5 rounded"/>:k.val??'—'}</p>
            <p className="stat-label text-[10px] uppercase tracking-wider">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tab-nav">
        {[{k:'summary',l:'Summary'},{k:'logs',l:'Call Logs'},{k:'chart',l:'Charts'}].map(t=>(
          <button key={t.k} className={`tab-item${tab===t.k?' active':''}`} onClick={()=>setTab(t.k)}>{t.l}</button>
        ))}
      </div>

      {tab==='chart' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="page-card p-5">
            <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Calls Per Hour (Today)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats?.callsPerHour||[]} barCategoryGap="38%">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                <XAxis dataKey="hour" tick={{ fill:'#94A3B8', fontSize:10 }} tickFormatter={h=>`${h}h`} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false} width={24} allowDecimals={false}/>
                <Tooltip content={<ChartTip/>}/>
                <Bar dataKey="count" name="Calls" fill="#2563EB" radius={[5,5,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="page-card p-5">
            <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Period Comparison</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { name:'Today',     calls:stats?.today?.totalCalls||0 },
                { name:'Yesterday', calls:stats?.yesterday?.totalCalls||0 },
                { name:'Last Week', calls:stats?.lastWeek?.totalCalls||0 },
              ]} barCategoryGap="40%">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                <XAxis dataKey="name" tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false} width={28} allowDecimals={false}/>
                <Tooltip content={<ChartTip/>}/>
                <Bar dataKey="calls" name="Calls" fill="#2563EB" radius={[6,6,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab==='summary' && (
        <div className="page-card overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
            <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Summary by Type</h3>
          </div>
          <table className="data-table">
            <thead><tr><th>Metric</th><th style={{ textAlign:'right' }}>Value</th></tr></thead>
            <tbody>
              {[
                { l:'Total Calls',   v:periodData?.totalCalls,    c:'#2563EB' },
                { l:'Incoming',      v:periodData?.incoming,      c:'#16A34A' },
                { l:'Outgoing',      v:periodData?.outgoing,      c:'#D97706' },
                { l:'Missed',        v:periodData?.missed,        c:'#DC2626' },
                { l:'Rejected',      v:periodData?.rejected,      c:'#7C3AED' },
                { l:'Connected',     v:periodData?.connectedCalls,c:'#0D9488' },
                { l:'Unique Clients',v:periodData?.uniqueClients, c:'#475569' },
                { l:'Working Hours', v:periodData?.workingHours,  c:'#475569' },
                { l:'Total Duration',v:periodData?.callDuration,  c:'#475569' },
              ].map(r=>(
                <tr key={r.l}>
                  <td className="text-xs font-medium" style={{ color:'#374151' }}>
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background:r.c }}/>{r.l}</div>
                  </td>
                  <td style={{ textAlign:'right', fontWeight:700, color:r.c }}>{loading?'…':r.v??'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==='logs' && (
        <>
          <div className="filter-bar flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'#94A3B8' }}><SearchIco/></span>
              <input className="form-input pl-8 text-xs" placeholder="Search number or name…"
                value={filters.search} onChange={e=>setF('search',e.target.value)}/>
            </div>
            <select className="form-input text-xs w-32" value={filters.callType} onChange={e=>setF('callType',e.target.value)}>
              <option value="">All Types</option>
              <option value="incoming">Incoming</option>
              <option value="outgoing">Outgoing</option>
              <option value="missed">Missed</option>
              <option value="rejected">Rejected</option>
            </select>
            <select className="form-input text-xs w-40" value={filters.employee} onChange={e=>setF('employee',e.target.value)}>
              <option value="">All Employees</option>
              {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div className="page-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table" style={{ minWidth:640 }}>
                <thead><tr><th>Employee</th><th>Contact</th><th>Type</th><th>Duration</th><th>Date & Time</th></tr></thead>
                <tbody>
                  {loading ? (
                    Array.from({length:8}).map((_,i)=>(
                      <tr key={i}>{Array.from({length:5}).map((_,j)=><td key={j}><div className="skeleton h-4 rounded"/></td>)}</tr>
                    ))
                  ) : calls.length===0 ? (
                    <tr><td colSpan={5}><div className="flex items-center justify-center py-14"><p className="text-sm" style={{ color:'#94A3B8' }}>No calls found</p></div></td></tr>
                  ) : calls.map((c,i)=>(
                    <tr key={c._id||i}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background:'#2563EB' }}>
                            {(c.employeeName||'?')[0].toUpperCase()}
                          </div>
                          <span className="text-xs font-semibold" style={{ color:'#0F172A' }}>{c.employeeName||'—'}</span>
                        </div>
                      </td>
                      <td>
                        <p className="font-mono text-xs" style={{ color:'#374151' }}>{c.contactNumber||'—'}</p>
                        {c.contactName&&c.contactName!=='Unknown'&&<p className="text-[11px]" style={{ color:'#94A3B8' }}>{c.contactName}</p>}
                      </td>
                      <td><TypeBadge type={c.callType}/></td>
                      <td className="text-xs tabular-nums" style={{ color:'#475569' }}>{dur(c.duration)}</td>
                      <td className="text-xs" style={{ color:'#94A3B8' }}>{fmt(c.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages>1 && (
              <div className="flex items-center justify-between px-4 py-3" style={{ borderTop:'1px solid #F1F5F9' }}>
                <span className="text-xs" style={{ color:'#94A3B8' }}>Page {page} of {totalPages} · {total} records</span>
                <div className="flex gap-1">
                  <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1.5 text-xs rounded-lg font-medium disabled:opacity-40" style={{ background:'#F1F5F9', color:'#374151' }}>Prev</button>
                  <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1.5 text-xs rounded-lg font-medium disabled:opacity-40" style={{ background:'#F1F5F9', color:'#374151' }}>Next</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
