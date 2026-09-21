'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import api from '../../../../lib/api';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const SearchIco = ({s=13}) => <Ico size={s}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>;
const SaveIco   = ({s=14}) => <Ico size={s}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></Ico>;
const CheckIco  = ({s=14}) => <Ico size={s}><polyline points="20 6 9 17 4 12"/></Ico>;
const PlusIco   = ({s=14}) => <Ico size={s}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Ico>;
const UsersIco  = ({s=20}) => <Ico size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Ico>;
const EyeIco    = ({s=14}) => <Ico size={s}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></Ico>;
const EyeOffIco = ({s=14}) => <Ico size={s}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></Ico>;

// The User model's only status field is the boolean `isActive` — there is no
// `status`/`workingStatus` string on the backend, so reads must derive from
// `isActive` (not fall back to a hardcoded 'active') and writes must go
// through PATCH /:id/status (the only route that persists it).
const EMPTY = { name:'', email:'', phone:'', role:'employee', status:'active', password:'', confirmPassword:'', tlName:'', ryanEmployeeCode:'' };

export default function UpdateUsersPage() {
  const params   = useSearchParams();
  const editId   = params.get('id');

  const [users,    setUsers]    = useState([]);
  const [selected, setSelected] = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [search,   setSearch]   = useState('');
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState('');
  const [error,    setError]    = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [mode,     setMode]     = useState('edit'); // 'edit' | 'add'
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(()=>{
    setLoading(true);
    // Fetch all non-admin users: employees, managers, and TLs
    Promise.all([
      api.get('/api/employees').catch(()=>({ data: { data: [] } })),
      api.get('/api/users/hierarchy').catch(()=>({ data: { data: null } })),
    ]).then(([empRes, hierRes]) => {
      const employees = empRes.data?.data || [];
      // Extract managers and TLs from hierarchy
      const hier = hierRes.data?.data;
      const managers = (hier?.managers || []).map(m => m.manager).filter(Boolean);
      const tls = (hier?.managers || []).flatMap(m => (m.teamLeads || []).map(t => t.tl)).filter(Boolean);
      const unassignedTLs = (hier?.unassignedTLs || []).filter(Boolean);
      // Deduplicate by _id
      const seen = new Set();
      const list = [...employees, ...managers, ...tls, ...unassignedTLs].filter(u => {
        if (!u?._id || seen.has(u._id.toString())) return false;
        seen.add(u._id.toString());
        return true;
      });
      setUsers(list);
      if (editId) {
        const u = list.find(x=>x._id===editId);
        if (u) { setSelected(u); setForm({ name:u.name||'', email:u.email||'', phone:u.phone||'', role:u.role||'employee', status:u.isActive===false?'inactive':'active', password:'', confirmPassword:'', tlName:u.tlName||'', ryanEmployeeCode:u.ryanEmployeeCode||'' }); }
      }
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, [editId]);

  useEffect(()=>{ load(); },[load]);

  const filtered = users.filter(u=>!search||(u.name||'').toLowerCase().includes(search.toLowerCase())||(u.email||'').toLowerCase().includes(search.toLowerCase())||(u.ryanEmployeeCode||'').toLowerCase().includes(search.toLowerCase()));

  const selectUser = (u) => {
    setSelected(u); setMode('edit'); setError(''); setSuccess('');
    setForm({ name:u.name||'', email:u.email||'', phone:u.phone||'', role:u.role||'employee', status:u.isActive===false?'inactive':'active', password:'', confirmPassword:'', tlName:u.tlName||'', ryanEmployeeCode:u.ryanEmployeeCode||'' });
  };

  const startAdd = () => {
    setSelected(null); setMode('add'); setError(''); setSuccess('');
    setForm(EMPTY);
  };

  const setF = (k,v) => setForm(f=>({...f,[k]:v}));

  const submit = async (e) => {
    e.preventDefault();
    if (form.password && form.password!==form.confirmPassword) { setError('Passwords do not match.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const body = { name:form.name, email:form.email, phone:form.phone, role:form.role, tlName:form.tlName, ryanEmployeeCode:form.ryanEmployeeCode };
      if (form.password) body.password = form.password;
      if (mode==='edit' && selected) {
        // Build update body — only send fields the PUT endpoint supports
        const body = { name:form.name, phone:form.phone, tlName:form.tlName };
        if (form.password) body.password = form.password;
        await api.put(`/api/employees/${selected._id}`, body);
        // Status lives on a separate boolean field (isActive) and is only
        // persisted through this dedicated endpoint — PUT /:id ignores it.
        const wantActive = form.status === 'active';
        if (wantActive !== (selected.isActive !== false)) {
          await api.patch(`/api/employees/${selected._id}/status`, { isActive: wantActive });
        }
        setSuccess('User updated successfully.');
      } else {
        // Create: send full payload including role
        const body = { name:form.name, email:form.email, phone:form.phone, role:form.role, tlName:form.tlName };
        if (form.password) body.password = form.password;
        const roleLabel = form.role === 'tl' ? 'Team Lead' : form.role === 'employee' ? 'Agent' : form.role.charAt(0).toUpperCase()+form.role.slice(1);
        setSuccess(`${roleLabel} account created successfully.`);
      }
      load();
    } catch(e) {
      setError(e.response?.data?.error||'Operation failed. Please try again.');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Update Users</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Edit user details, roles, and passwords</p>
        </div>
        <button onClick={startAdd} className="btn-primary text-xs py-1.5 px-3"><PlusIco s={12}/> Add New User</button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* User list */}
        <div className="page-card overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom:'1px solid #E2E8F0' }}>
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color:'#94A3B8' }}><SearchIco/></span>
              <input className="form-input pl-8 text-xs py-1.5" placeholder="Search users…"
                value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight:480 }}>
            {loading ? (
              Array.from({length:6}).map((_,i)=>(
                <div key={i} className="px-4 py-3 flex items-center gap-3" style={{ borderBottom:'1px solid #F1F5F9' }}>
                  <div className="skeleton w-9 h-9 rounded-xl flex-shrink-0"/>
                  <div className="flex-1 space-y-1.5"><div className="skeleton h-3 rounded w-24"/><div className="skeleton h-2.5 rounded w-16"/></div>
                </div>
              ))
            ) : filtered.length===0 ? (
              <div className="flex flex-col items-center py-12 gap-2">
                <UsersIco s={28}/>
                <p className="text-sm" style={{ color:'#94A3B8' }}>No users found</p>
              </div>
            ) : filtered.map(u=>{
              const active = selected?._id===u._id;
              return (
                <button key={u._id} onClick={()=>selectUser(u)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                  style={{ borderBottom:'1px solid #F1F5F9', background:active?'#EFF6FF':'transparent' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[11px] font-black flex-shrink-0"
                    style={{ background:active?'#2563EB':'linear-gradient(135deg,#94A3B8,#CBD5E1)' }}>
                    {(u.name||'?').slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs truncate" style={{ color:active?'#2563EB':'#0F172A' }}>{u.name||'Unknown'}</p>
                    <p className="text-[10px] truncate capitalize" style={{ color:'#94A3B8' }}>{u.role||'agent'} · {u.isActive===false?'inactive':'active'}{u.ryanEmployeeCode ? ` · ${u.ryanEmployeeCode}` : ''}</p>
                  </div>
                  {active && <ChevronRight size={16} className="flex-shrink-0" style={{ color:'#2563EB' }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Edit form */}
        <div className="xl:col-span-2 page-card p-6">
          {!selected && mode==='edit' ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3" style={{ color:'#94A3B8' }}>
              <UsersIco s={36}/>
              <p className="text-sm">Select a user from the list to edit</p>
              <button onClick={startAdd} className="btn-primary text-xs py-1.5 px-4 mt-2"><PlusIco s={12}/> Or add a new user</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base" style={{ color:'#0F172A' }}>
                  {mode==='add'?'New User':selected?.name||'Edit User'}
                </h3>
                {mode==='edit' && selected && (
                  <span className="badge capitalize text-xs" style={{ background:'#F0FDF4', color:'#16A34A' }}>Editing</span>
                )}
              </div>

              {success && (
                <div className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold" style={{ background:'#F0FDF4', color:'#16A34A', border:'1px solid #BBF7D0' }}>
                  <CheckIco/>{success}
                </div>
              )}
              {error && (
                <div className="p-3 rounded-xl text-xs" style={{ background:'#FFF1F2', color:'#DC2626', border:'1px solid #FECACA' }}>{error}</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color:'#374151' }}>Full Name *</label>
                  <input required className="form-input text-sm" placeholder="e.g. Raj Sharma"
                    value={form.name} onChange={e=>setF('name',e.target.value)}/>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color:'#374151' }}>Email</label>
                  <input type="email" className="form-input text-sm" placeholder="raj@company.com"
                    value={form.email} onChange={e=>setF('email',e.target.value)}/>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color:'#374151' }}>Phone</label>
                  <input className="form-input text-sm font-mono" placeholder="+91 98765 43210"
                    value={form.phone} onChange={e=>setF('phone',e.target.value)}/>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color:'#374151' }}>Role *</label>
                  <select required className="form-input text-sm" value={form.role} onChange={e=>setF('role',e.target.value)}>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="tl">Team Lead</option>
                    <option value="employee">Agent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color:'#374151' }}>Status</label>
                  <select className="form-input text-sm" value={form.status} onChange={e=>setF('status',e.target.value)}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color:'#374151' }}>TL Name</label>
                  <input className="form-input text-sm" placeholder="e.g. Priya Singh"
                    value={form.tlName} onChange={e=>setF('tlName',e.target.value)}/>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color:'#374151' }}>Employee ID</label>
                  <input className="form-input text-sm" placeholder="e.g. RC-014"
                    value={form.ryanEmployeeCode} onChange={e=>setF('ryanEmployeeCode',e.target.value)}/>
                </div>
              </div>

              <div style={{ borderTop:'1px dashed #E2E8F0', paddingTop:'1.25rem' }}>
                <p className="text-xs font-bold mb-3" style={{ color:'#94A3B8' }}>
                  {mode==='add'?'Set Password':'Change Password (leave blank to keep current)'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color:'#374151' }}>
                      {mode==='add'?'Password *':'New Password'}
                    </label>
                    <div className="relative">
                      <input required={mode==='add'} type={showPwd?'text':'password'}
                        className="form-input text-sm pr-10" placeholder="Min 8 characters"
                        value={form.password} onChange={e=>setF('password',e.target.value)}/>
                      <button type="button" onClick={()=>setShowPwd(v=>!v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color:'#94A3B8' }}>
                        {showPwd?<EyeOffIco/>:<EyeIco/>}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color:'#374151' }}>Confirm Password</label>
                    <input required={!!form.password} type={showPwd?'text':'password'}
                      className="form-input text-sm" placeholder="Re-enter password"
                      value={form.confirmPassword} onChange={e=>setF('confirmPassword',e.target.value)}/>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="btn-primary flex items-center gap-2 px-6"
                  style={{ opacity:saving?0.7:1 }}>
                  {saving ? 'Saving…' : <><SaveIco/>{mode==='add'?'Create User':'Save Changes'}</>}
                </button>
                {mode==='add' && (
                  <button type="button" onClick={()=>setMode('edit')} className="btn-secondary px-4">Cancel</button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
