'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../../../../lib/api';
import { fmtDate } from '../../../../lib/timezone';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const SearchIco  = ({s=13}) => <Ico size={s}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>;
const UsersIco   = ({s=20}) => <Ico size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Ico>;
const EditIco    = ({s=13}) => <Ico size={s}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></Ico>;
const PhoneIco   = ({s=11}) => <Ico size={s}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.54a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></Ico>;

const ROLE_COLORS = {
  admin:{ color:'#7C3AED', bg:'#F5F3FF' },
  manager:{ color:'#2563EB', bg:'#EFF6FF' },
  agent:{ color:'#16A34A', bg:'#F0FDF4' },
  supervisor:{ color:'#D97706', bg:'#FFFBEB' },
};

const fmt = fmtDate;

export default function UsersOverviewPage() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [role,    setRole]    = useState('');
  const [status,  setStatus]  = useState('');

  useEffect(() => {
    api.get('/api/employees').then(r=>{ setUsers(r.data?.data||[]); }).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const roles   = [...new Set(users.map(u=>u.role||'agent'))];
  const filtered = users.filter(u=>{
    const ms = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()) || u.phone?.includes(search) || u.ryanEmployeeCode?.toLowerCase().includes(search.toLowerCase());
    const mr = !role   || (u.role||'agent')===role;
    const mw = !status || (u.workingStatus||u.status||'active')===status;
    return ms&&mr&&mw;
  });

  const rc = users.reduce((a,u)=>{ const r=u.role||'agent'; a[r]=(a[r]||0)+1; return a; },{});

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Users Overview</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>All registered system users and their details</p>
        </div>
        <div className="flex gap-2">
          <Link href="/users/update-users" className="btn-primary text-xs py-1.5 px-3">+ Add User</Link>
        </div>
      </div>

      {/* Role breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger">
        {Object.entries(ROLE_COLORS).map(([r,c],i)=>(
          <div key={r} className="page-card p-4 animate-fade-in-up" style={{ animationDelay:`${i*0.05}s`, borderLeft:`3px solid ${c.color}` }}>
            <p className="stat-number text-2xl" style={{ color:c.color }}>{loading?<span className="skeleton inline-block w-8 h-6 rounded"/>:rc[r]||0}</p>
            <p className="stat-label text-xs capitalize font-semibold">{r}s</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'#94A3B8' }}><SearchIco/></span>
          <input className="form-input pl-8 text-xs" placeholder="Search by name, email, phone, or employee ID…"
            value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="form-input text-xs w-36" value={role} onChange={e=>setRole(e.target.value)}>
          <option value="">All Roles</option>
          {roles.map(r=><option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
        </select>
        <select className="form-input text-xs w-32" value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({length:6}).map((_,i)=>(
            <div key={i} className="page-card p-5"><div className="skeleton h-24 rounded-lg"/></div>
          ))}
        </div>
      ) : filtered.length===0 ? (
        <div className="page-card flex flex-col items-center py-20 gap-3">
          <UsersIco s={36}/>
          <p className="text-sm" style={{ color:'#94A3B8' }}>No users match your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
          {filtered.map((u,i)=>{
            const r   = u.role||'agent';
            const c   = ROLE_COLORS[r]||{ color:'#64748B', bg:'#F1F5F9' };
            const ws  = u.workingStatus||u.status||'active';
            return (
              <div key={u._id||i} className="page-card p-5 animate-fade-in-up hover:shadow-md transition-all" style={{ animationDelay:`${i*0.03}s` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black flex-shrink-0"
                      style={{ background:'linear-gradient(135deg,#2563EB,#60A5FA)' }}>
                      {(u.name||'?').slice(0,2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color:'#0F172A' }}>{u.name||'Unknown'}</p>
                      <span className="badge capitalize text-[10px]" style={{ background:c.bg, color:c.color }}>{r}</span>
                      {u.ryanEmployeeCode && <span className="text-[10px] ml-1.5" style={{ color:'#94A3B8' }}>{u.ryanEmployeeCode}</span>}
                    </div>
                  </div>
                  <span className={`badge text-[10px] ${ws==='active'?'':'opacity-60'}`}
                    style={ws==='active'?{ background:'#F0FDF4', color:'#16A34A' }:{ background:'#F1F5F9', color:'#64748B' }}>
                    {ws}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {u.email && <p className="text-xs truncate" style={{ color:'#475569' }}>{u.email}</p>}
                  {u.phone && (
                    <p className="text-xs flex items-center gap-1.5" style={{ color:'#475569' }}>
                      <PhoneIco/>{u.phone}
                    </p>
                  )}
                  <p className="text-[10px]" style={{ color:'#94A3B8' }}>Joined {fmt(u.createdAt)}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <Link href={`/users/update-users?id=${u._id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                    style={{ background:c.bg, color:c.color }}>
                    <EditIco s={11}/> Edit
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-right" style={{ color:'#94A3B8' }}>{filtered.length} of {users.length} users</p>
    </div>
  );
}
