'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../../../../lib/api';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const SearchIco  = ({s=13}) => <Ico size={s}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>;
const UsersIco   = ({s=20}) => <Ico size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Ico>;
const PhoneIco   = ({s=11}) => <Ico size={s}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.54a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></Ico>;

const ROLE_COLORS = {
  admin:{ color:'#7C3AED', bg:'#F5F3FF' },
  manager:{ color:'#2563EB', bg:'#EFF6FF' },
  agent:{ color:'#16A34A', bg:'#F0FDF4' },
  supervisor:{ color:'#D97706', bg:'#FFFBEB' },
};

export default function ActiveUsersPage() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [role,    setRole]    = useState('');
  const [now,     setNow]     = useState(new Date());

  useEffect(() => {
    api.get('/api/employees').then(r=>{ setUsers(r.data?.data||[]); }).catch(()=>{}).finally(()=>setLoading(false));
    const t = setInterval(()=>setNow(new Date()), 30000);
    return ()=>clearInterval(t);
  }, []);

  const active = users.filter(u=>(u.workingStatus||u.status||'active')==='active');
  const roles  = [...new Set(active.map(u=>u.role||'agent'))];

  const filtered = active.filter(u=>{
    const ms = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.phone?.includes(search);
    const mr = !role   || (u.role||'agent')===role;
    return ms&&mr;
  });

  const roleCounts = active.reduce((a,u)=>{ const r=u.role||'agent'; a[r]=(a[r]||0)+1; return a; },{});

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Active Users</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Users currently marked as active in the system</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background:'#F0FDF4', color:'#16A34A', border:'1px solid #BBF7D0' }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background:'#16A34A' }}/>
            {active.length} Online
          </div>
          <Link href="/users/overview" className="btn-secondary text-xs py-1.5 px-3">All Users</Link>
        </div>
      </div>

      {/* Live indicator banner */}
      <div className="rounded-xl p-4 flex items-center gap-3" style={{ background:'linear-gradient(135deg,#F0FDF4,#DCFCE7)', border:'1px solid #BBF7D0' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:'#16A34A', color:'#fff' }}>
          <UsersIco s={16}/>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold" style={{ color:'#15803D' }}>{loading?'Loading…':`${active.length} users active`}</p>
          <p className="text-xs" style={{ color:'#86EFAC' }}>Refreshed at {now.toLocaleTimeString('en-IN',{ hour:'2-digit',minute:'2-digit' })}</p>
        </div>
      </div>

      {/* Role breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger">
        {Object.entries(ROLE_COLORS).map(([r,c],i)=>(
          <div key={r} className="page-card p-4 animate-fade-in-up" style={{ animationDelay:`${i*0.05}s`, borderLeft:`3px solid ${c.color}` }}>
            <p className="stat-number text-2xl" style={{ color:c.color }}>{loading?<span className="skeleton inline-block w-8 h-6 rounded"/>:roleCounts[r]||0}</p>
            <p className="stat-label text-xs capitalize font-semibold">{r}s</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'#94A3B8' }}><SearchIco/></span>
          <input className="form-input pl-8 text-xs" placeholder="Search by name or phone…"
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
          <p className="font-semibold text-sm" style={{ color:'#0F172A' }}>{filtered.length} active users</p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table" style={{ minWidth:520 }}>
            <thead>
              <tr>
                <th>User</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:6}).map((_,i)=>(
                  <tr key={i}>{Array.from({length:5}).map((_,j)=><td key={j}><div className="skeleton h-4 rounded"/></td>)}</tr>
                ))
              ) : filtered.length===0 ? (
                <tr><td colSpan={5}>
                  <div className="flex flex-col items-center py-14 gap-3">
                    <UsersIco s={32}/>
                    <p className="text-sm" style={{ color:'#94A3B8' }}>No active users found</p>
                    <Link href="/users/overview" className="btn-secondary text-xs py-1.5 px-3">View All Users</Link>
                  </div>
                </td></tr>
              ) : filtered.map((u,i)=>{
                const r  = u.role||'agent';
                const c  = ROLE_COLORS[r]||{ color:'#64748B', bg:'#F1F5F9' };
                return (
                  <tr key={u._id||i}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="relative flex-shrink-0">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[11px] font-black"
                            style={{ background:'linear-gradient(135deg,#2563EB,#60A5FA)' }}>
                            {(u.name||'?').slice(0,2).toUpperCase()}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white" style={{ background:'#16A34A' }}/>
                        </div>
                        <div>
                          <p className="font-semibold text-xs" style={{ color:'#0F172A' }}>{u.name||'Unknown'}</p>
                          {u.email && <p className="text-[10px] truncate max-w-[140px]" style={{ color:'#94A3B8' }}>{u.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td>
                      {u.phone
                        ? <p className="font-mono text-xs flex items-center gap-1" style={{ color:'#475569' }}><PhoneIco/>{u.phone}</p>
                        : <span style={{ color:'#CBD5E1' }}>—</span>}
                    </td>
                    <td><span className="badge capitalize" style={{ background:c.bg, color:c.color }}>{r}</span></td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background:'#16A34A' }}/>
                        <span className="text-xs font-semibold" style={{ color:'#16A34A' }}>Active</span>
                      </div>
                    </td>
                    <td>
                      <Link href={`/users/update-users?id=${u._id}`} className="btn-secondary text-[11px] py-1 px-2.5">Edit</Link>
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
