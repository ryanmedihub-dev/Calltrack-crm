'use client';
import { Field, Tabs } from '../../../components/report-shared';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../lib/api';
import useIsAdmin from '../../../lib/useIsAdmin';
import { getAllEmployeesSafe } from '../../../lib/employees';

const TABS = ['Profile', 'Security', 'Team', 'Preferences', 'About'];
const PREF_KEY = 'calltrack_prefs';
const DEFAULT_PREFS = {
  showLiveDot:    true,
  autoRefresh:    true,
  defaultPeriod:  'today',
  dateFormat:     'en-IN',
};
function loadPrefs()  { try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREF_KEY)) }; } catch { return DEFAULT_PREFS; } }
function savePrefs(p) { localStorage.setItem(PREF_KEY, JSON.stringify(p)); }

function Toggle({ checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="relative flex-shrink-0 transition-colors duration-200 focus:outline-none"
      style={{ width:40, height:24, borderRadius:9999, background: checked ? '#7C3AED' : '#E9E7EF' }}>
      <span className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(4px)' }} />
    </button>
  );
}

function Section({ title, desc, children }) {
  return (
    <div className="page-card p-6">
      <div className="mb-5 pb-4" style={{ borderBottom:'1px solid #F4F3F8' }}>
        <h3 className="font-semibold" style={{ color:'#1A1726' }}>{title}</h3>
        {desc && <p className="text-xs mt-0.5" style={{ color: '#6B6880' }}>{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function PrefRow({ label, desc, children }) {
  return (
    <div className="flex items-center justify-between py-3.5" style={{ borderBottom:'1px solid #FAF9FC' }}>
      <div className="min-w-0 mr-4">
        <p className="text-sm font-medium" style={{ color:'#1A1726' }}>{label}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color: '#6B6880' }}>{desc}</p>}
      </div>
      {children}
    </div>
  );
}

// One neutral avatar colour: colour is reserved for meaning, not identity.
const AVATAR_COLORS = ['#524F63'];

export default function SettingsPage() {
  const isAdmin = useIsAdmin();
  const [tab,       setTab]       = useState('Profile');
  const [user,      setUser]      = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [profile,   setProfile]   = useState({ name:'', phone:'' });
  const [pw,        setPw]        = useState({ current:'', next:'', confirm:'' });
  const [prefs,     setPrefs]     = useState(DEFAULT_PREFS);
  const [employees, setEmployees] = useState([]);
  const [newEmp,    setNewEmp]    = useState({ name:'', email:'', password:'', phone:'', deviceId:'', tlName:'', ryanEmployeeCode:'' });
  const [creatingEmp, setCreatingEmp] = useState(false);
  const [empSaving,   setEmpSaving]   = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
    api.get('/api/auth/me').then(res => {
      setUser(res.data.data);
      setProfile({ name:res.data.data.name||'', phone:res.data.data.phone||'' });
    }).catch(() => {});
    if (tab === 'Team') loadEmployees();
  }, []);

  useEffect(() => { if (tab === 'Team') loadEmployees(); }, [tab]);

  const loadEmployees = () => {
    getAllEmployeesSafe(api).then(setEmployees).catch(() => {});
  };

  const handleProfileSave = async () => {
    if (!profile.name.trim()) return toast.error('Name cannot be empty');
    setSaving(true);
    try { await api.patch('/api/auth/profile', profile); toast.success('Profile updated'); }
    catch { toast.error('Failed to update profile'); }
    finally { setSaving(false); }
  };

  const handlePasswordSave = async () => {
    if (!pw.current || !pw.next) return toast.error('Fill in all fields');
    if (pw.next !== pw.confirm)  return toast.error('Passwords do not match');
    if (pw.next.length < 6)      return toast.error('Password must be at least 6 characters');
    setSaving(true);
    try {
      await api.post('/api/auth/change-password', { currentPassword:pw.current, newPassword:pw.next });
      toast.success('Password changed'); setPw({ current:'', next:'', confirm:'' });
    } catch { toast.error('Incorrect current password'); }
    finally { setSaving(false); }
  };

  const handleCreateEmployee = async () => {
    if (!newEmp.name || !newEmp.email || !newEmp.password) return toast.error('Name, email, and password are required');
    setEmpSaving(true);
    try {
      await api.post('/api/employees', newEmp);
      toast.success('Employee created');
      setNewEmp({ name:'', email:'', password:'', phone:'', deviceId:'', tlName:'', ryanEmployeeCode:'' });
      setCreatingEmp(false); loadEmployees();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to create employee'); }
    finally { setEmpSaving(false); }
  };

  const toggleEmpStatus = async (emp) => {
    try {
      await api.patch(`/api/employees/${emp._id}/status`, { isActive:!emp.isActive });
      toast.success(`${emp.name} ${!emp.isActive?'activated':'deactivated'}`);
      loadEmployees();
    } catch { toast.error('Failed to update status'); }
  };

  const deleteEmployee = async (emp) => {
    if (!confirm(`Delete ${emp.name}? This cannot be undone.`)) return;
    try { await api.delete(`/api/employees/${emp._id}`); toast.success(`${emp.name} deleted`); loadEmployees(); }
    catch { toast.error('Failed to delete employee'); }
  };

  const updatePref = (key, val) => { const u = { ...prefs, [key]:val }; setPrefs(u); savePrefs(u); };
  const initials   = user?.name ? user.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : '?';

  return (
    <div className="space-y-5 max-w-2xl animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="page-title">Settings</h2>
        <p className="page-subtitle">Manage your account, team, and preferences</p>
      </div>

      {/* Tab strip */}
      <Tabs id="settings" value={tab} onChange={setTab}
        tabs={TABS.filter((t) => isAdmin || t !== 'Team').map((t) => ({ key: t, label: t }))} />

      {/* ── PROFILE ── */}
      {tab === 'Profile' && (
        <div className="space-y-4">
          <div className="page-card p-6 flex items-center gap-5">
            <div className="w-14 h-14 rounded-full bg-gray-100 text-ink-2 flex items-center justify-center text-lg font-semibold flex-shrink-0 select-none">
              {initials}
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color:'#1A1726' }}>{user?.name||'—'}</h3>
              <p className="page-subtitle">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="badge bg-[var(--blue-50)] text-[var(--blue)]">
                  {isAdmin ? 'Admin' : user?.role === 'tl' ? 'Team lead' : (user?.role || 'User').replace(/^./, (c) => c.toUpperCase())}
                </span>
                <span className="badge text-xs flex items-center gap-1"
                  style={{ background:'rgba(7,148,85,0.08)', color:'#079455', border:'1px solid rgba(7,148,85,0.22)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background:'#079455' }} /> Active
                </span>
              </div>
            </div>
          </div>

          <Section title="Personal Information" desc="Update your display name and phone number">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name">
                <input value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}
                  placeholder="Your full name" className="form-input"/>
              </Field>
              <Field label="Email" hint="Email cannot be changed">
                <input value={user?.email||''} readOnly className="form-input" style={{ background:'#F4F3F8', color: '#6B6880', cursor:'not-allowed' }}/>
              </Field>
              <Field label="Phone">
                <input value={profile.phone} onChange={e=>setProfile({...profile,phone:e.target.value})}
                  placeholder="10-digit phone" className="form-input"/>
              </Field>
              <Field label="Role">
                <input value={user?.role||''} readOnly className="form-input capitalize" style={{ background:'#F4F3F8', color: '#6B6880', cursor:'not-allowed' }}/>
              </Field>
            </div>
            <div className="flex justify-end mt-5">
              <button onClick={handleProfileSave} disabled={saving} className="btn-primary" style={{ opacity:saving?0.7:1 }}>
                {saving?'Saving…':'Save Changes'}
              </button>
            </div>
          </Section>
        </div>
      )}

      {/* ── SECURITY ── */}
      {tab === 'Security' && (
        <div className="space-y-4">
          <Section title="Change Password" desc="Use a strong password of at least 6 characters">
            <div className="space-y-4">
              {[
                { key:'current', label:'Current Password',  placeholder:'••••••••' },
                { key:'next',    label:'New Password',      placeholder:'Min 6 characters' },
                { key:'confirm', label:'Confirm Password',  placeholder:'Repeat new password' },
              ].map(({ key, label, placeholder }) => (
                <Field key={key} label={label}>
                  <input type="password" value={pw[key]} placeholder={placeholder}
                    onChange={e=>setPw({...pw,[key]:e.target.value})} className="form-input"/>
                </Field>
              ))}
              <div className="flex justify-end pt-1">
                <button onClick={handlePasswordSave} disabled={saving} className="btn-primary" style={{ opacity:saving?0.7:1 }}>
                  {saving?'Updating…':'Update Password'}
                </button>
              </div>
            </div>
          </Section>

          <Section title="Active Sessions">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:'#FAF9FC', border:'1px solid #E9E7EF', color: '#6B6880' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color:'#1A1726' }}>This browser</p>
                  <p className="text-xs" style={{ color: '#6B6880' }}>Current session · Active now</p>
                </div>
              </div>
              <span className="badge text-xs" style={{ background:'rgba(7,148,85,0.08)', color:'#079455', border:'1px solid rgba(7,148,85,0.22)' }}>
                Current
              </span>
            </div>
          </Section>
        </div>
      )}

      {/* ── TEAM ── */}
      {tab === 'Team' && isAdmin && (
        <div className="space-y-4">
          <Section title="Team Members" desc="Manage employee accounts">
            <div className="-mx-1">
              {employees.map((emp, i) => (
                <div key={emp._id} className="flex items-center gap-3 py-3 px-1 transition-colors rounded-xl"
                  style={{ borderBottom:'1px solid #FAF9FC' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#FAF9FC'}
                  onMouseLeave={e=>e.currentTarget.style.background=''}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold select-none flex-shrink-0"
                    style={{ background:AVATAR_COLORS[i%AVATAR_COLORS.length] }}>
                    {emp.name.slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color:'#1A1726' }}>{emp.name}</p>
                    <p className="text-xs" style={{ color: '#6B6880' }}>{emp.email}{emp.ryanEmployeeCode ? ` · ${emp.ryanEmployeeCode}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="badge text-xs"
                      style={emp.isActive !== false
                        ? { background:'rgba(7,148,85,0.08)', color:'#079455', border:'1px solid rgba(7,148,85,0.22)' }
                        : { background:'#F4F3F8', color:'#6B6880', border:'1px solid #E9E7EF' }}>
                      {emp.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                    <button onClick={()=>toggleEmpStatus(emp)}
                      className="text-xs px-2 py-1 rounded-lg transition-all"
                      style={{ border:'1px dashed #E9E7EF', color:'#6B6880' }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor='#EDE9FE';e.currentTarget.style.color='#7C3AED';}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor='#E9E7EF';e.currentTarget.style.color='#6B6880';}}>
                      {emp.isActive !== false ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={()=>deleteEmployee(emp)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: '#6B6880' }}
                      onMouseEnter={e=>{e.currentTarget.style.background='#FEF3F2';e.currentTarget.style.color='#D92D20';}}
                      onMouseLeave={e=>{e.currentTarget.style.background='';e.currentTarget.style.color='#A19DB2';}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
              {employees.length === 0 && <p className="text-sm py-4" style={{ color: '#6B6880' }}>No employees yet.</p>}
            </div>

            <div className="mt-4 pt-4" style={{ borderTop:'1px solid #F4F3F8' }}>
              {!creatingEmp ? (
                <button onClick={()=>setCreatingEmp(true)}
                  className="flex items-center gap-2 text-sm font-semibold transition-colors"
                  style={{ color:'#7C3AED' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add Employee
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold" style={{ color:'#1A1726' }}>New Employee</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key:'name',     label:'Full Name',  type:'text',     placeholder:'Jane Smith' },
                      { key:'email',    label:'Email',      type:'email',    placeholder:'jane@company.com' },
                      { key:'password', label:'Password',   type:'password', placeholder:'Min 6 chars' },
                      { key:'phone',    label:'Phone',      type:'text',     placeholder:'10-digit' },
                      { key:'deviceId', label:'Device ID',  type:'text',     placeholder:'Optional' },
                      { key:'tlName',   label:'TL Name',    type:'text',     placeholder:'Optional' },
                      { key:'ryanEmployeeCode', label:'Employee ID', type:'text',  placeholder:'e.g. RC-014' },
                    ].map(({ key, label, type, placeholder }) => (
                      <div key={key}>
                        <label className="block text-xs font-medium mb-1" style={{ color: '#6B6880' }}>{label}</label>
                        <input type={type} value={newEmp[key]} placeholder={placeholder}
                          onChange={e=>setNewEmp({...newEmp,[key]:e.target.value})} className="form-input"/>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={()=>setCreatingEmp(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                    <button onClick={handleCreateEmployee} disabled={empSaving} className="btn-primary flex-1 justify-center" style={{ opacity:empSaving?0.65:1 }}>
                      {empSaving ? 'Creating…' : 'Create Employee'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Section>
        </div>
      )}

      {tab === 'Team' && user?.role !== 'manager' && (
        <div className="page-card p-10 text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background:'#F5F3FF', color:'#7C3AED' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <p className="font-medium" style={{ color:'#1A1726' }}>Manager access required</p>
          <p className="text-sm mt-1" style={{ color: '#6B6880' }}>Team management is available to managers only.</p>
        </div>
      )}

      {/* ── PREFERENCES ── */}
      {tab === 'Preferences' && (
        <div className="space-y-4">
          <Section title="Display" desc="Customize your dashboard experience">
            <PrefRow label="Show Live Indicator" desc="Green 'Live' dot in the top bar">
              <Toggle checked={prefs.showLiveDot} onChange={v=>updatePref('showLiveDot',v)}/>
            </PrefRow>
            <PrefRow label="Auto-Refresh Dashboard" desc="Refresh stats every 30 seconds">
              <Toggle checked={prefs.autoRefresh} onChange={v=>updatePref('autoRefresh',v)}/>
            </PrefRow>
          </Section>

          <Section title="Defaults" desc="Set your preferred default filters">
            <PrefRow label="Default Period" desc="Period selected on dashboard load">
              <select value={prefs.defaultPeriod} onChange={e=>updatePref('defaultPeriod',e.target.value)}
                className="form-input" style={{ width:'auto' }}>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </PrefRow>
            <PrefRow label="Date Format" desc="How dates are displayed across the app">
              <select value={prefs.dateFormat} onChange={e=>updatePref('dateFormat',e.target.value)}
                className="form-input" style={{ width:'auto' }}>
                <option value="en-IN">en-IN (14 Jun 2026)</option>
                <option value="en-US">en-US (Jun 14, 2026)</option>
                <option value="en-GB">en-GB (14/06/2026)</option>
              </select>
            </PrefRow>
          </Section>

          <div className="flex justify-end">
            <button
              onClick={()=>{savePrefs(DEFAULT_PREFS);setPrefs(DEFAULT_PREFS);toast.success('Preferences reset');}}
              className="text-xs px-4 py-2 rounded-xl transition-all"
              style={{ border:'1px dashed #E9E7EF', color: '#6B6880' }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='#FEF3F2';e.currentTarget.style.color='#D92D20';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='#E9E7EF';e.currentTarget.style.color='#A19DB2';}}>
              Reset to Defaults
            </button>
          </div>
        </div>
      )}

      {/* ── ABOUT ── */}
      {tab === 'About' && (
        <div className="space-y-4">
          <div className="page-card p-6 flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background:'#7C3AED', boxShadow:'0 8px 24px rgba(124,58,237,0.28)' }}>
              <span className="text-white text-xl font-black">CT</span>
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color:'#1A1726' }}>CallTrack CRM</h3>
              <p className="page-subtitle">Call log management and analytics platform</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="badge text-xs" style={{ background:'#F5F3FF', color:'#7C3AED', border:'1px solid #EDE9FE' }}>v2.0.0</span>
                <span className="badge text-xs" style={{ background:'rgba(7,148,85,0.08)', color:'#079455', border:'1px solid rgba(7,148,85,0.22)' }}>Dashboard</span>
              </div>
            </div>
          </div>

          <Section title="System Information">
            <div className="space-y-0">
              {[
                { label:'Version',   value:'2.0.0' },
                { label:'Stack',     value:'Next.js 14 · Express · MongoDB · React Native' },
                { label:'Real-time', value:'Pusher WebSockets' },
                { label:'Auth',      value:'JWT · 7-day expiry' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between py-2.5" style={{ borderBottom:'1px solid #FAF9FC' }}>
                  <span className="text-xs font-medium w-28 flex-shrink-0" style={{ color: '#6B6880' }}>{label}</span>
                  <span className="text-xs font-medium text-right" style={{ color:'#1A1726' }}>{value}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Quick Links">
            <div className="grid grid-cols-2 gap-1">
              {[
                { label:'View Dashboard',     href:'/dashboard' },
                { label:'View Leaderboard',   href:'/employees/leaderboard' },
                { label:'Live Monitor',       href:'/calls/live' },
                { label:'Advanced Analytics', href:'/analytics/advanced' },
              ].map(({ label, href }) => (
                <a key={href} href={href}
                  className="flex items-center gap-1.5 text-sm font-medium p-2 rounded-xl transition-colors"
                  style={{ color:'#7C3AED' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#F5F3FF'}
                  onMouseLeave={e=>e.currentTarget.style.background=''}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  {label}
                </a>
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
