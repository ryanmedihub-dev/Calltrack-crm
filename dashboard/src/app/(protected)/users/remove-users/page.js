'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '../../../../lib/api';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const SearchIco  = ({s=13}) => <Ico size={s}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>;
const TrashIco   = ({s=15}) => <Ico size={s}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></Ico>;
const PauseIco   = ({s=15}) => <Ico size={s}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></Ico>;
const XIco       = ({s=16}) => <Ico size={s}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Ico>;
const AlertIco   = ({s=24}) => <Ico size={s}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></Ico>;
const UsersIco   = ({s=20}) => <Ico size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Ico>;

const ROLE_COLORS = {
  admin:{ color:'#7C3AED', bg:'#F5F3FF' },
  manager:{ color:'#2563EB', bg:'#EFF6FF' },
  agent:{ color:'#16A34A', bg:'#F0FDF4' },
  supervisor:{ color:'#D97706', bg:'#FFFBEB' },
};

export default function RemoveUsersPage() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [role,    setRole]    = useState('');
  const [modal,   setModal]   = useState(null); // { user, action: 'deactivate'|'delete' }
  const [busy,    setBusy]    = useState(false);
  const [toast,   setToast]   = useState('');

  const load = useCallback(()=>{
    setLoading(true);
    api.get('/api/employees').then(r=>setUsers(r.data?.data||[])).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  useEffect(()=>{ load(); },[load]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(()=>setToast(''),3200);
  };

  const roles    = [...new Set(users.map(u=>u.role||'agent'))];
  const filtered = users.filter(u=>{
    const ms = !search||(u.name||'').toLowerCase().includes(search.toLowerCase())||(u.email||'').toLowerCase().includes(search.toLowerCase());
    const mr = !role||(u.role||'agent')===role;
    return ms&&mr;
  });

  const confirm = async () => {
    if (!modal) return;
    setBusy(true);
    try {
      if (modal.action==='deactivate') {
        await api.put(`/api/employees/${modal.user._id}`, { status:'inactive', workingStatus:'inactive' });
        showToast(`${modal.user.name} has been deactivated.`);
      } else {
        await api.delete(`/api/employees/${modal.user._id}`);
        showToast(`${modal.user.name} has been removed.`);
      }
      load();
    } catch(e) {
      showToast(e.response?.data?.error||'Action failed. Please try again.');
    }
    setBusy(false);
    setModal(null);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-fade-in px-5 py-3 rounded-xl text-sm font-semibold shadow-lg"
          style={{ background:'#0F172A', color:'#fff', minWidth:280 }}>
          {toast}
        </div>
      )}

      {/* Confirm Modal */}
      {modal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.45)' }}>
          <div className="page-card p-6 w-full max-w-sm animate-fade-in-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background:modal.action==='delete'?'#FFF1F2':'#FFFBEB', color:modal.action==='delete'?'#DC2626':'#D97706' }}>
                {modal.action==='delete'?<TrashIco s={18}/>:<PauseIco s={18}/>}
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color:'#0F172A' }}>
                  {modal.action==='delete'?'Delete User':'Deactivate User'}
                </p>
                <p className="text-xs" style={{ color:'#94A3B8' }}>{modal.user.name}</p>
              </div>
            </div>
            <div className="p-3 rounded-xl mb-4 flex gap-2" style={{ background:'#FFFBEB', border:'1px solid #FDE68A' }}>
              <AlertIco s={16}/>
              <p className="text-xs leading-relaxed" style={{ color:'#92400E' }}>
                {modal.action==='delete'
                  ? 'This will permanently remove the user and all associated data. This action cannot be undone.'
                  : 'The user will lose access to the system immediately but their data will be preserved.'}
              </p>
            </div>
            <div className="flex gap-3">
              <button disabled={busy} onClick={confirm}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
                style={{ background:modal.action==='delete'?'#DC2626':'#D97706', opacity:busy?0.7:1 }}>
                {busy?'Please wait…':modal.action==='delete'?'Yes, Delete':'Deactivate'}
              </button>
              <button disabled={busy} onClick={()=>setModal(null)} className="btn-secondary flex-1 py-2.5">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Remove Users</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Deactivate or permanently remove system users</p>
        </div>
      </div>

      {/* Warning banner */}
      <div className="rounded-xl p-4 flex items-start gap-3" style={{ background:'#FFF1F2', border:'1px solid #FECACA' }}>
        <AlertIco s={18}/>
        <div>
          <p className="text-sm font-bold" style={{ color:'#DC2626' }}>Proceed with caution</p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color:'#B91C1C' }}>
            Deactivating a user removes their access but keeps their data. Deleting is permanent and cannot be undone. Prefer deactivation unless absolutely sure.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'#94A3B8' }}><SearchIco/></span>
          <input className="form-input pl-8 text-xs" placeholder="Search by name or email…"
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
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{ textAlign:'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:6}).map((_,i)=>(
                  <tr key={i}>{Array.from({length:5}).map((_,j)=><td key={j}><div className="skeleton h-4 rounded"/></td>)}</tr>
                ))
              ) : filtered.length===0 ? (
                <tr><td colSpan={5}>
                  <div className="flex flex-col items-center py-14 gap-2">
                    <UsersIco s={28}/>
                    <p className="text-sm" style={{ color:'#94A3B8' }}>No users found</p>
                  </div>
                </td></tr>
              ) : filtered.map((u,i)=>{
                const r   = u.role||'agent';
                const c   = ROLE_COLORS[r]||{ color:'#64748B', bg:'#F1F5F9' };
                const ws  = u.workingStatus||u.status||'active';
                const isAdmin = r==='admin';
                return (
                  <tr key={u._id||i}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-black flex-shrink-0"
                          style={{ background:ws==='active'?'linear-gradient(135deg,#2563EB,#60A5FA)':'#CBD5E1' }}>
                          {(u.name||'?').slice(0,2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-xs" style={{ color:'#0F172A' }}>{u.name||'Unknown'}</p>
                          {u.phone && <p className="text-[10px] font-mono" style={{ color:'#94A3B8' }}>{u.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="text-xs" style={{ color:'#475569' }}>{u.email||'—'}</td>
                    <td><span className="badge capitalize" style={{ background:c.bg, color:c.color }}>{r}</span></td>
                    <td>
                      <span className="badge capitalize"
                        style={ws==='active'?{ background:'#F0FDF4', color:'#16A34A' }:{ background:'#F1F5F9', color:'#64748B' }}>
                        {ws}
                      </span>
                    </td>
                    <td>
                      {isAdmin ? (
                        <p className="text-center text-[11px] italic" style={{ color:'#CBD5E1' }}>Protected</p>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          {ws==='active' && (
                            <button
                              onClick={()=>setModal({ user:u, action:'deactivate' })}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80"
                              style={{ background:'#FFFBEB', color:'#D97706', border:'1px solid #FDE68A' }}>
                              <PauseIco s={11}/> Deactivate
                            </button>
                          )}
                          <button
                            onClick={()=>setModal({ user:u, action:'delete' })}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80"
                            style={{ background:'#FFF1F2', color:'#DC2626', border:'1px solid #FECACA' }}>
                            <TrashIco s={11}/> Delete
                          </button>
                        </div>
                      )}
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
