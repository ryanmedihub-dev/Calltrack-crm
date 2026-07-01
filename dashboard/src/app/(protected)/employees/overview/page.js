'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../../../../lib/api';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const SearchIco  = () => <Ico size={13}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>;
const UsersIco   = ({s=16}) => <Ico size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Ico>;
const ChevronIco = () => <Ico size={13}><polyline points="9 18 15 12 9 6"/></Ico>;
const ChartTip   = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg px-3 py-2 text-xs" style={{ background:'#0F172A', color:'#fff', boxShadow:'0 8px 24px rgba(0,0,0,0.25)' }}>
    <p style={{ color:'#94A3B8' }}>{label}</p>
    {payload.map((p,i) => <p key={i} className="font-bold">{p.name}: {p.value}</p>)}
  </div>;
};

const STATUS_STYLES = {
  active:   { bg:'#F0FDF4', color:'#16A34A', border:'#BBF7D0' },
  inactive: { bg:'#FFF1F2', color:'#DC2626', border:'#FECACA' },
  on_leave: { bg:'#FFFBEB', color:'#D97706', border:'#FDE68A' },
};

export default function EmployeesOverviewPage() {
  const [employees, setEmployees] = useState([]);
  const [stats,     setStats]     = useState({});
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('');
  const [sort,      setSort]      = useState('calls');
  const [callStats, setCallStats] = useState(null);

  const filtered = employees.filter(e => {
    const matchSearch = !search || e.name?.toLowerCase().includes(search.toLowerCase()) || e.phone?.includes(search);
    const matchStatus = !status || (e.workingStatus || e.status || 'active') === status;
    return matchSearch && matchStatus;
  }).sort((a,b) => {
    if (sort==='name')  return (a.name||'').localeCompare(b.name||'');
    if (sort==='calls') return (stats[b._id]?.total||0) - (stats[a._id]?.total||0);
    return 0;
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [empRes, callRes] = await Promise.allSettled([
          api.get('/api/employees'),
          api.get('/api/calls/stats'),
        ]);
        if (empRes.status==='fulfilled') setEmployees(empRes.value.data?.data||[]);
        if (callRes.status==='fulfilled') setCallStats(callRes.value.data?.data);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const activeCount   = employees.filter(e => (e.workingStatus||e.status||'active') === 'active').length;
  const inactiveCount = employees.filter(e => (e.workingStatus||e.status) === 'inactive').length;

  const chartData = employees
    .map(e => ({ name: (e.name||'').split(' ')[0], calls: callStats?.today?.topDialers?.find(d=>d.employeeId===e._id)?.count || 0 }))
    .sort((a,b) => b.calls-a.calls).slice(0,10);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Employees Overview</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>All employees with call stats, lead counts, and status</p>
        </div>
        <Link href="/employees/leaderboard" className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
          <ChevronIco/> Leaderboard
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger">
        {[
          { label:'Total Employees', val:employees.length, color:'#2563EB', bg:'#EFF6FF' },
          { label:'Active',          val:activeCount,      color:'#16A34A', bg:'#F0FDF4' },
          { label:'Inactive',        val:inactiveCount,    color:'#DC2626', bg:'#FFF1F2' },
          { label:'Today Calls',     val:callStats?.today?.totalCalls??'—', color:'#7C3AED', bg:'#F5F3FF' },
        ].map((k,i) => (
          <div key={k.label} className="page-card p-4 animate-fade-in-up" style={{ animationDelay:`${i*0.05}s` }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background:k.bg, color:k.color }}>
              <UsersIco s={14}/>
            </div>
            <p className="stat-number text-2xl">{loading ? <span className="skeleton inline-block w-12 h-7 rounded"/> : k.val}</p>
            <p className="stat-label text-[10px] uppercase tracking-wider">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.some(d=>d.calls>0) && (
        <div className="page-card p-5">
          <h3 className="font-bold text-sm mb-4" style={{ color:'#0F172A' }}>Top 10 Employees by Today's Calls</h3>
          <ResponsiveContainer width="100%" height={Math.max(180, chartData.length*32)}>
            <BarChart data={chartData} barSize={20} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false}/>
              <XAxis type="number" tick={{ fontSize:10, fill:'#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false}/>
              <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'#475569', fontWeight:600 }} tickLine={false} axisLine={false} width={72}/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="calls" name="Calls" fill="#2563EB" radius={[0,5,5,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'#94A3B8' }}><SearchIco/></span>
          <input className="form-input pl-8 text-xs" placeholder="Search by name or phone…"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <select className="form-input text-xs w-36" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="on_leave">On Leave</option>
        </select>
        <select className="form-input text-xs w-32" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="calls">Sort: Calls</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      {/* Table */}
      <div className="page-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" style={{ minWidth:680 }}>
            <thead>
              <tr><th>Employee</th><th>Phone</th><th>Role</th><th>Today Calls</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:8}).map((_,i)=>(
                  <tr key={i}>{Array.from({length:6}).map((_,j)=><td key={j}><div className="skeleton h-4 rounded"/></td>)}</tr>
                ))
              ) : filtered.length===0 ? (
                <tr><td colSpan={6}>
                  <div className="flex flex-col items-center py-14 gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background:'#EFF6FF', color:'#2563EB' }}>
                      <UsersIco s={22}/>
                    </div>
                    <p className="text-sm" style={{ color:'#94A3B8' }}>No employees found</p>
                  </div>
                </td></tr>
              ) : filtered.map((e,i) => {
                const ws = e.workingStatus||e.status||'active';
                const ss = STATUS_STYLES[ws]||STATUS_STYLES.active;
                const todayCalls = callStats?.today?.topDialers?.find(d=>d.employeeId===e._id)?.count||0;
                return (
                  <tr key={e._id||i}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                          style={{ background:'linear-gradient(135deg,#2563EB,#60A5FA)' }}>
                          {(e.name||'?').slice(0,2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-xs" style={{ color:'#0F172A' }}>{e.name||'—'}</p>
                          <p className="text-[11px]" style={{ color:'#94A3B8' }}>{e.email||''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs" style={{ color:'#475569' }}>{e.phone||'—'}</td>
                    <td className="text-xs capitalize" style={{ color:'#64748B' }}>{e.role||'Agent'}</td>
                    <td>
                      <span className="font-bold tabular-nums text-sm" style={{ color: todayCalls>0?'#2563EB':'#94A3B8' }}>{todayCalls}</span>
                    </td>
                    <td>
                      <span className="badge capitalize" style={{ background:ss.bg, color:ss.color, border:`1px solid ${ss.border}` }}>
                        {ws.replace('_',' ')}
                      </span>
                    </td>
                    <td>
                      <Link href={`/employees/${e._id}`}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all"
                        style={{ background:'#EFF6FF', color:'#2563EB', border:'1px solid #BFDBFE' }}
                        onMouseEnter={ev=>{ev.currentTarget.style.background='#2563EB';ev.currentTarget.style.color='#fff';}}
                        onMouseLeave={ev=>{ev.currentTarget.style.background='#EFF6FF';ev.currentTarget.style.color='#2563EB';}}>
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
