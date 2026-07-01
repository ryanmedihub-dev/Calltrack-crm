'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../../../../lib/api';
import { fmtDate } from '../../../../lib/timezone';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const SearchIco = ({s=13}) => <Ico size={s}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>;
const UsersIco  = ({s=20}) => <Ico size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Ico>;
const DownloadIco=({s=13})=><Ico size={s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Ico>;

const ROLE_COLORS = { admin:{ color:'#7C3AED', bg:'#F5F3FF' }, manager:{ color:'#2563EB', bg:'#EFF6FF' }, agent:{ color:'#16A34A', bg:'#F0FDF4' }, supervisor:{ color:'#D97706', bg:'#FFFBEB' } };

const fmt = fmtDate;

export default function UsersReportPage() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [role,    setRole]    = useState('');

  useEffect(() => {
    api.get('/api/employees').then(r=>{ setUsers(r.data?.data||[]); }).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const filtered = users.filter(u=>{
    const ms = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()) || u.phone?.includes(search);
    const mr = !role   || (u.role||'agent') === role;
    return ms && mr;
  });

  const roleCounts = users.reduce((acc,u)=>{ const r=u.role||'agent'; acc[r]=(acc[r]||0)+1; return acc; },{});
  const roles      = [...new Set(users.map(u=>u.role||'agent'))];

  const exportCSV = () => {
    const rows = [['Name','Email','Phone','Role','Status','Joined'],...filtered.map(u=>[u.name||'',u.email||'',u.phone||'',u.role||'agent',u.status||'active',fmt(u.createdAt)])];
    const csv  = rows.map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href=url; a.download='users-report.csv'; a.click();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Users Report</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>All system users with roles, contact details, and status</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-secondary text-xs py-1.5 px-3"><DownloadIco/> Export</button>
          <Link href="/users" className="btn-primary text-xs py-1.5 px-3">Manage Users</Link>
        </div>
      </div>

      {/* Role breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger">
        {roles.map((r,i)=>{
          const rc = ROLE_COLORS[r]||{ color:'#64748B', bg:'#F1F5F9' };
          return (
            <div key={r} className="page-card p-4 animate-fade-in-up" style={{ animationDelay:`${i*0.05}s`, borderLeft:`3px solid ${rc.color}` }}>
              <p className="stat-number text-2xl" style={{ color:rc.color }}>
                {loading?<span className="skeleton inline-block w-8 h-6 rounded"/>:roleCounts[r]||0}
              </p>
              <p className="stat-label text-xs capitalize font-semibold">{r}s</p>
            </div>
          );
        })}
        {!loading && roles.length===0 && (
          <div className="page-card p-4 col-span-4 flex items-center justify-center gap-2" style={{ color:'#94A3B8' }}>
            <UsersIco s={18}/><span className="text-sm">No users data</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="filter-bar flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'#94A3B8' }}><SearchIco/></span>
          <input className="form-input pl-8 text-xs" placeholder="Search by name, email, or phone…"
            value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="form-input text-xs w-36" value={role} onChange={e=>setRole(e.target.value)}>
          <option value="">All Roles</option>
          {roles.map(r=><option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="page-card overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid #E2E8F0' }}>
          <p className="font-semibold text-sm" style={{ color:'#0F172A' }}>{filtered.length} users</p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table" style={{ minWidth:620 }}>
            <thead><tr><th>User</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead>
            <tbody>
              {loading ? (
                Array.from({length:6}).map((_,i)=>(
                  <tr key={i}>{Array.from({length:6}).map((_,j)=><td key={j}><div className="skeleton h-4 rounded"/></td>)}</tr>
                ))
              ) : filtered.length===0 ? (
                <tr><td colSpan={6}>
                  <div className="flex flex-col items-center py-14 gap-2">
                    <UsersIco s={28}/>
                    <p className="text-sm" style={{ color:'#94A3B8' }}>No users found</p>
                  </div>
                </td></tr>
              ) : filtered.map((u,i)=>{
                const rc  = ROLE_COLORS[u.role||'agent']||{ color:'#64748B', bg:'#F1F5F9' };
                const ws  = u.workingStatus||u.status||'active';
                return (
                  <tr key={u._id||i}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                          style={{ background:'linear-gradient(135deg,#2563EB,#60A5FA)' }}>
                          {(u.name||'?').slice(0,2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-xs" style={{ color:'#0F172A' }}>{u.name||'Unknown'}</span>
                      </div>
                    </td>
                    <td className="text-xs" style={{ color:'#475569' }}>{u.email||'—'}</td>
                    <td className="font-mono text-xs" style={{ color:'#475569' }}>{u.phone||'—'}</td>
                    <td><span className="badge capitalize" style={{ background:rc.bg, color:rc.color }}>{u.role||'agent'}</span></td>
                    <td>
                      <span className="badge capitalize" style={ws==='active'?{ background:'#F0FDF4', color:'#16A34A' }:{ background:'#FFF1F2', color:'#DC2626' }}>
                        {ws}
                      </span>
                    </td>
                    <td className="text-xs" style={{ color:'#94A3B8' }}>{fmt(u.createdAt)}</td>
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
