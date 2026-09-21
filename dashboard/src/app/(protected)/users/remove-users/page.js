'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '../../../../lib/api';
import { DataTable } from '../../../../components/report-shared';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const TrashIco   = ({s=15}) => <Ico size={s}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></Ico>;
const PauseIco   = ({s=15}) => <Ico size={s}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></Ico>;
const PlayIco    = ({s=15}) => <Ico size={s}><polygon points="5 3 19 12 5 21 5 3"/></Ico>;
const XIco       = ({s=16}) => <Ico size={s}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Ico>;
const AlertIco   = ({s=24}) => <Ico size={s}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></Ico>;
const SpinnerIco = ({s=15}) => <Ico size={s} className="animate-spin"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></Ico>;

const ROLE_COLORS = {
  admin:{ color:'#7C3AED', bg:'#F5F3FF' },
  manager:{ color:'#2563EB', bg:'#EFF6FF' },
  tl:{ color:'#D97706', bg:'#FFFBEB' },
  employee:{ color:'#16A34A', bg:'#F0FDF4' },
  agent:{ color:'#16A34A', bg:'#F0FDF4' },
  supervisor:{ color:'#D97706', bg:'#FFFBEB' },
};

export default function RemoveUsersPage() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  // modal: { user, action: 'deactivate'|'activate'|'delete', leadCount, choice: 'reassign'|'deleteLeads', reassignTo }
  const [modal,   setModal]   = useState(null);
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

  const roles = [...new Set(users.map(u=>u.role||'agent'))];

  const openDeleteModal = async (u) => {
    setModal({ user: u, action: 'delete', leadCount: null, choice: 'reassign', reassignTo: '' });
    try {
      const r = await api.get('/api/leads', { params: { assignedTo: u._id, limit: 1 } });
      const leadCount = r.data?.data?.total || 0;
      setModal((m) => (m && m.user._id === u._id ? { ...m, leadCount } : m));
    } catch {
      setModal((m) => (m && m.user._id === u._id ? { ...m, leadCount: 0 } : m));
    }
  };

  const confirm = async () => {
    if (!modal) return;
    setBusy(true);
    try {
      if (modal.action==='deactivate') {
        await api.patch(`/api/employees/${modal.user._id}/status`, { isActive: false });
        showToast(`${modal.user.name} has been deactivated.`);
      } else if (modal.action==='activate') {
        await api.patch(`/api/employees/${modal.user._id}/status`, { isActive: true });
        showToast(`${modal.user.name} has been reactivated.`);
      } else {
        if (modal.leadCount > 0 && modal.choice === 'reassign' && !modal.reassignTo) {
          showToast('Select an employee to reassign leads to.');
          setBusy(false);
          return;
        }
        const body = modal.leadCount > 0
          ? (modal.choice === 'reassign' ? { reassignTo: modal.reassignTo } : { deleteLeads: true })
          : {};
        await api.delete(`/api/employees/${modal.user._id}`, { data: body });
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
                {modal.action==='delete'?<TrashIco s={18}/>:modal.action==='activate'?<PlayIco s={18}/>:<PauseIco s={18}/>}
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color:'#0F172A' }}>
                  {modal.action==='delete'?'Delete User':modal.action==='activate'?'Reactivate User':'Deactivate User'}
                </p>
                <p className="text-xs" style={{ color:'#94A3B8' }}>{modal.user.name}</p>
              </div>
            </div>

            {modal.action!=='delete' && (
              <div className="p-3 rounded-xl mb-4 flex gap-2" style={{ background:'#FFFBEB', border:'1px solid #FDE68A' }}>
                <AlertIco s={16}/>
                <p className="text-xs leading-relaxed" style={{ color:'#92400E' }}>
                  {modal.action==='activate'
                    ? 'The user will regain access to the system immediately.'
                    : 'The user will lose access to the system immediately but their data will be preserved.'}
                </p>
              </div>
            )}

            {modal.action==='delete' && modal.leadCount===null && (
              <div className="flex items-center gap-2 py-6 justify-center text-xs" style={{ color:'#94A3B8' }}>
                <SpinnerIco s={14}/> Checking assigned leads…
              </div>
            )}

            {modal.action==='delete' && modal.leadCount===0 && (
              <div className="p-3 rounded-xl mb-4 flex gap-2" style={{ background:'#FFF1F2', border:'1px solid #FECACA' }}>
                <AlertIco s={16}/>
                <p className="text-xs leading-relaxed" style={{ color:'#B91C1C' }}>
                  This will permanently remove the user. This action cannot be undone.
                </p>
              </div>
            )}

            {modal.action==='delete' && modal.leadCount>0 && (
              <div className="mb-4 space-y-3">
                <div className="p-3 rounded-xl flex gap-2" style={{ background:'#FFF1F2', border:'1px solid #FECACA' }}>
                  <AlertIco s={16}/>
                  <p className="text-xs leading-relaxed" style={{ color:'#B91C1C' }}>
                    {modal.user.name} has <strong>{modal.leadCount}</strong> lead{modal.leadCount===1?'':'s'} assigned. Choose what to do with them before deleting.
                  </p>
                </div>
                <label className="flex items-start gap-2 p-2.5 rounded-lg cursor-pointer border" style={{ borderColor:modal.choice==='reassign'?'#93C5FD':'#E2E8F0', background:modal.choice==='reassign'?'#EFF6FF':'#fff' }}>
                  <input type="radio" className="mt-0.5" checked={modal.choice==='reassign'} onChange={()=>setModal(m=>({...m, choice:'reassign'}))}/>
                  <div className="flex-1">
                    <p className="text-xs font-semibold" style={{ color:'#0F172A' }}>Reassign leads to another employee</p>
                    {modal.choice==='reassign' && (
                      <select className="form-input text-xs w-full mt-2" value={modal.reassignTo}
                        onChange={(e)=>setModal(m=>({...m, reassignTo:e.target.value}))}>
                        <option value="">Select employee…</option>
                        {users.filter(u=>u._id!==modal.user._id && (u.role||'agent')!=='admin').map(u=>(
                          <option key={u._id} value={u._id}>{u.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </label>
                <label className="flex items-start gap-2 p-2.5 rounded-lg cursor-pointer border" style={{ borderColor:modal.choice==='deleteLeads'?'#FCA5A5':'#E2E8F0', background:modal.choice==='deleteLeads'?'#FFF1F2':'#fff' }}>
                  <input type="radio" className="mt-0.5" checked={modal.choice==='deleteLeads'} onChange={()=>setModal(m=>({...m, choice:'deleteLeads'}))}/>
                  <div className="flex-1">
                    <p className="text-xs font-semibold" style={{ color:'#0F172A' }}>Delete their leads too</p>
                    <p className="text-[11px] mt-0.5" style={{ color:'#94A3B8' }}>Permanently removes all {modal.leadCount} lead{modal.leadCount===1?'':'s'} along with the user.</p>
                  </div>
                </label>
              </div>
            )}

            <div className="flex gap-3">
              <button disabled={busy || (modal.action==='delete' && modal.leadCount===null)} onClick={confirm}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                style={{ background:modal.action==='delete'?'#DC2626':modal.action==='activate'?'#16A34A':'#D97706', opacity:busy?0.7:1 }}>
                {busy?'Please wait…':modal.action==='delete'?'Yes, Delete':modal.action==='activate'?'Reactivate':'Deactivate'}
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

      {/* Table */}
      <div className="page-card overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid #E2E8F0' }}>
          <p className="font-semibold text-sm" style={{ color:'#0F172A' }}>{users.length} users</p>
        </div>
        <div className="px-5 py-4">
          <DataTable
            loading={loading}
            rows={users}
            emptyTitle="No users found"
            columns={[
              {
                key: 'name', label: 'User',
                render: (u) => {
                  const ws = u.isActive===false ? 'inactive' : 'active';
                  return (
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
                  );
                },
              },
              { key: 'email', label: 'Email', render: (u) => <span className="text-xs" style={{ color:'#475569' }}>{u.email||'—'}</span> },
              { key: 'ryanEmployeeCode', label: 'Employee ID', render: (u) => <span className="text-xs font-mono" style={{ color:'#475569' }}>{u.ryanEmployeeCode||'—'}</span> },
              {
                key: 'role', label: 'Role', filterType: 'select', filterOptions: roles,
                filterValue: (u) => u.role||'agent',
                render: (u) => {
                  const r = u.role||'agent';
                  const c = ROLE_COLORS[r]||{ color:'#64748B', bg:'#F1F5F9' };
                  return <span className="badge capitalize" style={{ background:c.bg, color:c.color }}>{r}</span>;
                },
              },
              {
                key: 'status', label: 'Status', searchable: false,
                filterValue: (u) => (u.isActive===false ? 'inactive' : 'active'),
                render: (u) => {
                  const ws = u.isActive===false ? 'inactive' : 'active';
                  return (
                    <span className="badge capitalize"
                      style={ws==='active'?{ background:'#F0FDF4', color:'#16A34A' }:{ background:'#F1F5F9', color:'#64748B' }}>
                      {ws}
                    </span>
                  );
                },
              },
              {
                key: 'actions', label: 'Actions', align: 'right', sortable: false, searchable: false,
                render: (u) => {
                  const r = u.role||'agent';
                  const ws = u.isActive===false ? 'inactive' : 'active';
                  const isAdmin = r==='admin';
                  return isAdmin ? (
                    <p className="text-center text-[11px] italic" style={{ color:'#CBD5E1' }}>Protected</p>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      {ws==='active' ? (
                        <button
                          onClick={()=>setModal({ user:u, action:'deactivate' })}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80"
                          style={{ background:'#FFFBEB', color:'#D97706', border:'1px solid #FDE68A' }}>
                          <PauseIco s={11}/> Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={()=>setModal({ user:u, action:'activate' })}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80"
                          style={{ background:'#F0FDF4', color:'#16A34A', border:'1px solid #BBF7D0' }}>
                          <PlayIco s={11}/> Activate
                        </button>
                      )}
                      <button
                        onClick={()=>openDeleteModal(u)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80"
                        style={{ background:'#FFF1F2', color:'#DC2626', border:'1px solid #FECACA' }}>
                        <TrashIco s={11}/> Delete
                      </button>
                    </div>
                  );
                },
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
