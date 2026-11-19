'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '../../../../lib/api';
import { getAllEmployeesSafe } from '../../../../lib/employees';
import { DataTable } from '../../../../components/report-shared';
import MultiSelect from '../../../../components/MultiSelect';

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
  admin:{ color:'#524F63', bg:'#F4F3F8' },
  manager:{ color:'#7C3AED', bg:'#F5F3FF' },
  tl:{ color:'#B54708', bg:'#FFFAEB' },
  employee:{ color:'#079455', bg:'#ECFDF3' },
  agent:{ color:'#079455', bg:'#ECFDF3' },
  supervisor:{ color:'#B54708', bg:'#FFFAEB' },
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
    getAllEmployeesSafe(api).then(emps=>setUsers(emps||[])).catch(()=>{}).finally(()=>setLoading(false));
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
          style={{ background:'#1A1726', color:'#fff', minWidth:280 }}>
          {toast}
        </div>
      )}

      {/* Confirm Modal */}
      {modal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background:'rgba(26,23,38,0.45)' }}>
          <div className="page-card p-6 w-full max-w-sm animate-fade-in-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background:modal.action==='delete'?'#FEF3F2':'#FFFAEB', color:modal.action==='delete'?'#D92D20':'#B54708' }}>
                {modal.action==='delete'?<TrashIco s={18}/>:modal.action==='activate'?<PlayIco s={18}/>:<PauseIco s={18}/>}
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color:'#1A1726' }}>
                  {modal.action==='delete'?'Delete User':modal.action==='activate'?'Reactivate User':'Deactivate User'}
                </p>
                <p className="text-xs" style={{ color: '#6B6880' }}>{modal.user.name}</p>
              </div>
            </div>

            {modal.action!=='delete' && (
              <div className="p-3 rounded-xl mb-4 flex gap-2" style={{ background:'#FFFAEB', border:'1px solid #FFFAEB' }}>
                <AlertIco s={16}/>
                <p className="text-xs leading-relaxed" style={{ color:'#B54708' }}>
                  {modal.action==='activate'
                    ? 'The user will regain access to the system immediately.'
                    : 'The user will lose access to the system immediately but their data will be preserved.'}
                </p>
              </div>
            )}

            {modal.action==='delete' && modal.leadCount===null && (
              <div className="flex items-center gap-2 py-6 justify-center text-xs" style={{ color: '#6B6880' }}>
                <SpinnerIco s={14}/> Checking assigned leads…
              </div>
            )}

            {modal.action==='delete' && modal.leadCount===0 && (
              <div className="p-3 rounded-xl mb-4 flex gap-2" style={{ background:'#FEF3F2', border:'1px solid #FEF3F2' }}>
                <AlertIco s={16}/>
                <p className="text-xs leading-relaxed" style={{ color:'#D92D20' }}>
                  This will permanently remove the user. This action cannot be undone.
                </p>
              </div>
            )}

            {modal.action==='delete' && modal.leadCount>0 && (
              <div className="mb-4 space-y-3">
                <div className="p-3 rounded-xl flex gap-2" style={{ background:'#FEF3F2', border:'1px solid #FEF3F2' }}>
                  <AlertIco s={16}/>
                  <p className="text-xs leading-relaxed" style={{ color:'#D92D20' }}>
                    {modal.user.name} has <strong>{modal.leadCount}</strong> lead{modal.leadCount===1?'':'s'} assigned. Choose what to do with them before deleting.
                  </p>
                </div>
                <label className="flex items-start gap-2 p-2.5 rounded-lg cursor-pointer border" style={{ borderColor:modal.choice==='reassign'?'#EDE9FE':'#E9E7EF', background:modal.choice==='reassign'?'#F5F3FF':'#fff' }}>
                  <input type="radio" className="mt-0.5" checked={modal.choice==='reassign'} onChange={()=>setModal(m=>({...m, choice:'reassign'}))}/>
                  <div className="flex-1">
                    <p className="text-xs font-semibold" style={{ color:'#1A1726' }}>Reassign leads to another employee</p>
                    {modal.choice==='reassign' && (
                      <div className="mt-2">
                        <MultiSelect multiple={false} placeholder="Select employee…" ariaLabel="Reassign leads to"
                          value={modal.reassignTo} onChange={(v)=>setModal(m=>({...m, reassignTo:v}))}
                          options={users.filter(u=>u._id!==modal.user._id && (u.role||'agent')!=='admin').map((u)=>[u._id, u.name])} />
                      </div>
                    )}
                  </div>
                </label>
                <label className="flex items-start gap-2 p-2.5 rounded-lg cursor-pointer border" style={{ borderColor:modal.choice==='deleteLeads'?'#FBD5D0':'#E9E7EF', background:modal.choice==='deleteLeads'?'#FEF3F2':'#fff' }}>
                  <input type="radio" className="mt-0.5" checked={modal.choice==='deleteLeads'} onChange={()=>setModal(m=>({...m, choice:'deleteLeads'}))}/>
                  <div className="flex-1">
                    <p className="text-xs font-semibold" style={{ color:'#1A1726' }}>Delete their leads too</p>
                    <p className="text-xs mt-0.5" style={{ color: '#6B6880' }}>Permanently removes all {modal.leadCount} lead{modal.leadCount===1?'':'s'} along with the user.</p>
                  </div>
                </label>
              </div>
            )}

            <div className="flex gap-3">
              <button disabled={busy || (modal.action==='delete' && modal.leadCount===null)} onClick={confirm}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                style={{ background:modal.action==='delete'?'#D92D20':modal.action==='activate'?'#079455':'#B54708', opacity:busy?0.7:1 }}>
                {busy?'Please wait…':modal.action==='delete'?'Yes, Delete':modal.action==='activate'?'Reactivate':'Deactivate'}
              </button>
              <button disabled={busy} onClick={()=>setModal(null)} className="btn-secondary flex-1 py-2.5">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="page-title">Remove Users</h2>
          <p className="page-subtitle">Deactivate or permanently remove system users</p>
        </div>
      </div>

      {/* Warning banner */}
      <div className="rounded-xl p-4 flex items-start gap-3" style={{ background:'#FEF3F2', border:'1px solid #FEF3F2' }}>
        <AlertIco s={18}/>
        <div>
          <p className="text-sm font-bold" style={{ color:'#D92D20' }}>Proceed with caution</p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color:'#D92D20' }}>
            Deactivating a user removes their access but keeps their data. Deleting is permanent and cannot be undone. Prefer deactivation unless absolutely sure.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="page-card overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid #E9E7EF' }}>
          <p className="font-semibold text-sm" style={{ color:'#1A1726' }}>{users.length} users</p>
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
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                        style={{ background:ws==='active'?'#7C3AED':'#D5D2DE' }}>
                        {(u.name||'?').slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-xs" style={{ color:'#1A1726' }}>{u.name||'Unknown'}</p>
                        {u.phone && <p className="text-xs tabular-nums" style={{ color: '#6B6880' }}>{u.phone}</p>}
                      </div>
                    </div>
                  );
                },
              },
              { key: 'email', label: 'Email', render: (u) => <span className="text-xs" style={{ color:'#524F63' }}>{u.email||'—'}</span> },
              { key: 'ryanEmployeeCode', label: 'Employee ID', render: (u) => <span className="text-xs tabular-nums" style={{ color:'#524F63' }}>{u.ryanEmployeeCode||'—'}</span> },
              {
                key: 'role', label: 'Role', filterType: 'select', filterOptions: roles,
                filterValue: (u) => u.role||'agent',
                render: (u) => {
                  const r = u.role||'agent';
                  const c = ROLE_COLORS[r]||{ color:'#6B6880', bg:'#F4F3F8' };
                  return <span className="text-[13px] text-ink-2">{r === 'tl' ? 'Team lead' : r === 'employee' || r === 'agent' ? 'Agent' : r[0].toUpperCase() + r.slice(1)}</span>;
                },
              },
              {
                key: 'status', label: 'Status', searchable: false,
                filterValue: (u) => (u.isActive===false ? 'inactive' : 'active'),
                render: (u) => {
                  const ws = u.isActive===false ? 'inactive' : 'active';
                  return (
                    <span className="inline-flex items-center gap-1.5 text-[13px]">
                      <span className={`w-1.5 h-1.5 rounded-full ${ws==='active' ? 'bg-[var(--met)]' : 'bg-gray-300'}`} />
                      <span className={ws==='active' ? 'text-ink-2' : 'text-ink-3'}>{ws==='active' ? 'Active' : 'Inactive'}</span>
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
                    <p className="text-right text-xs text-ink-4">Protected</p>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      {ws==='active' ? (
                        <button
                          onClick={()=>setModal({ user:u, action:'deactivate' })}
                          className="btn-ghost btn-sm">
                          <PauseIco s={12}/> Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={()=>setModal({ user:u, action:'activate' })}
                          className="btn-ghost btn-sm">
                          <PlayIco s={12}/> Reactivate
                        </button>
                      )}
                      <button
                        onClick={()=>openDeleteModal(u)}
                        aria-label={`Delete ${u.name || 'user'}`} title="Delete permanently"
                        className="btn-ghost btn-sm btn-icon w-8 ml-2 hover:!text-behind hover:!bg-[var(--behind-50)]">
                        <TrashIco s={14}/>
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
