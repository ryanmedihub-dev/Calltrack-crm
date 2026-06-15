'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../lib/api';

const TABS = ['Profile', 'Security', 'Team', 'Preferences', 'About'];

const PREF_KEY = 'calltrack_prefs';
const DEFAULT_PREFS = {
  darkMode:      false,
  compactSidebar: false,
  showLiveDot:   true,
  autoRefresh:   true,
  defaultPeriod: 'today',
  dateFormat:    'en-IN',
};

function loadPrefs()  { try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREF_KEY)) }; } catch { return DEFAULT_PREFS; } }
function savePrefs(p) { localStorage.setItem(PREF_KEY, JSON.stringify(p)); }

function Toggle({ checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none ${checked ? 'bg-primary' : 'bg-gray-200'}`}>
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  );
}

function Section({ title, desc, children }) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card p-6">
      <div className="mb-5 pb-4 border-b border-border">
        <h3 className="font-semibold text-textPrimary">{title}</h3>
        {desc && <p className="text-xs text-textMuted mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wide mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-textMuted text-xs mt-1">{hint}</p>}
    </div>
  );
}

function PrefRow({ label, desc, children }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-0">
      <div className="min-w-0 mr-4">
        <p className="text-sm font-medium text-textPrimary">{label}</p>
        {desc && <p className="text-xs text-textMuted mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

const inputCls    = 'w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';
const disabledCls = 'w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-textMuted cursor-not-allowed';

export default function SettingsPage() {
  const [tab,     setTab]     = useState('Profile');
  const [user,    setUser]    = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [pw,      setPw]      = useState({ current: '', next: '', confirm: '' });
  const [prefs,   setPrefs]   = useState(DEFAULT_PREFS);
  const [employees, setEmployees] = useState([]);
  const [newEmp,  setNewEmp]  = useState({ name: '', email: '', password: '', phone: '', deviceId: '' });
  const [creatingEmp, setCreatingEmp] = useState(false);
  const [empSaving,   setEmpSaving]   = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
    api.get('/api/auth/me').then(res => {
      setUser(res.data.data);
      setProfile({ name: res.data.data.name || '', phone: res.data.data.phone || '' });
    }).catch(() => {});
    if (tab === 'Team') loadEmployees();
  }, []);

  useEffect(() => {
    if (tab === 'Team') loadEmployees();
  }, [tab]);

  const loadEmployees = () => {
    api.get('/api/employees').then(r => setEmployees(r.data.data || [])).catch(() => {});
  };

  const handleProfileSave = async () => {
    if (!profile.name.trim()) return toast.error('Name cannot be empty');
    setSaving(true);
    try {
      await api.patch('/api/auth/profile', profile);
      toast.success('Profile updated');
    } catch { toast.error('Failed to update profile'); }
    finally { setSaving(false); }
  };

  const handlePasswordSave = async () => {
    if (!pw.current || !pw.next) return toast.error('Fill in all fields');
    if (pw.next !== pw.confirm)  return toast.error('Passwords do not match');
    if (pw.next.length < 6)      return toast.error('Password must be at least 6 characters');
    setSaving(true);
    try {
      await api.post('/api/auth/change-password', { currentPassword: pw.current, newPassword: pw.next });
      toast.success('Password changed');
      setPw({ current: '', next: '', confirm: '' });
    } catch { toast.error('Incorrect current password'); }
    finally { setSaving(false); }
  };

  const handleCreateEmployee = async () => {
    if (!newEmp.name || !newEmp.email || !newEmp.password) return toast.error('Name, email, and password are required');
    setEmpSaving(true);
    try {
      await api.post('/api/employees', newEmp);
      toast.success('Employee created');
      setNewEmp({ name: '', email: '', password: '', phone: '', deviceId: '' });
      setCreatingEmp(false);
      loadEmployees();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to create employee'); }
    finally { setEmpSaving(false); }
  };

  const toggleEmpStatus = async (emp) => {
    try {
      await api.patch(`/api/employees/${emp._id}/status`, { isActive: !emp.isActive });
      toast.success(`${emp.name} ${!emp.isActive ? 'activated' : 'deactivated'}`);
      loadEmployees();
    } catch { toast.error('Failed to update status'); }
  };

  const deleteEmployee = async (emp) => {
    if (!confirm(`Delete ${emp.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/employees/${emp._id}`);
      toast.success(`${emp.name} deleted`);
      loadEmployees();
    } catch { toast.error('Failed to delete employee'); }
  };

  const updatePref = (key, val) => {
    const updated = { ...prefs, [key]: val };
    setPrefs(updated);
    savePrefs(updated);
  };

  const initials = user?.name ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-textPrimary">Settings</h2>
        <p className="text-textMuted text-sm mt-0.5">Manage your account, team, and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-border rounded-xl p-1 w-fit shadow-card flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-primary text-white shadow-sm' : 'text-textMuted hover:text-textSecondary'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── PROFILE ── */}
      {tab === 'Profile' && (
        <div className="space-y-4">
          {/* Avatar card */}
          <div className="bg-white rounded-2xl border border-border shadow-card p-6 flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-card-md select-none">
              {initials}
            </div>
            <div>
              <h3 className="text-lg font-bold text-textPrimary">{user?.name || '—'}</h3>
              <p className="text-textMuted text-sm">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="bg-primaryLt text-primary text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize">{user?.role || 'User'}</span>
                <span className="bg-successLt text-success text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-success rounded-full" /> Active
                </span>
              </div>
            </div>
          </div>

          <Section title="Personal Information" desc="Update your display name and phone number">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name">
                <input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })}
                  className={inputCls} placeholder="Your full name" />
              </Field>
              <Field label="Email" hint="Email cannot be changed">
                <input value={user?.email || ''} readOnly className={disabledCls} />
              </Field>
              <Field label="Phone">
                <input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })}
                  className={inputCls} placeholder="10-digit phone" />
              </Field>
              <Field label="Role">
                <input value={user?.role || ''} readOnly className={`${disabledCls} capitalize`} />
              </Field>
            </div>
            <div className="flex justify-end mt-5">
              <button onClick={handleProfileSave} disabled={saving}
                className="bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primaryDk disabled:opacity-60 transition-colors">
                {saving ? 'Saving…' : 'Save Changes'}
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
                { key: 'current', label: 'Current Password',  placeholder: '••••••••' },
                { key: 'next',    label: 'New Password',      placeholder: 'Min 6 characters' },
                { key: 'confirm', label: 'Confirm Password',  placeholder: 'Repeat new password' },
              ].map(({ key, label, placeholder }) => (
                <Field key={key} label={label}>
                  <input type="password" value={pw[key]} placeholder={placeholder}
                    onChange={e => setPw({ ...pw, [key]: e.target.value })}
                    className={inputCls} />
                </Field>
              ))}
              <div className="flex justify-end pt-1">
                <button onClick={handlePasswordSave} disabled={saving}
                  className="bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primaryDk disabled:opacity-60 transition-colors">
                  {saving ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </div>
          </Section>

          <Section title="Active Sessions">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-bg border border-border flex items-center justify-center text-textMuted">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-textPrimary">This browser</p>
                  <p className="text-xs text-textMuted">Current session · Active now</p>
                </div>
              </div>
              <span className="text-xs bg-successLt text-success border border-green-200 px-2.5 py-0.5 rounded-full font-medium">Current</span>
            </div>
          </Section>
        </div>
      )}

      {/* ── TEAM ── */}
      {tab === 'Team' && user?.role === 'manager' && (
        <div className="space-y-4">
          <Section title="Team Members" desc="Manage employee accounts">
            <div className="divide-y divide-border -mt-2">
              {employees.map(emp => (
                <div key={emp._id} className="flex items-center gap-3 py-3.5">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold select-none flex-shrink-0">
                    {emp.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-textPrimary truncate">{emp.name}</p>
                    <p className="text-xs text-textMuted">{emp.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${emp.isActive !== false ? 'bg-successLt text-success border border-green-200' : 'bg-gray-100 text-textMuted border border-gray-200'}`}>
                      {emp.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                    <button onClick={() => toggleEmpStatus(emp)}
                      className="text-xs text-textMuted hover:text-primary transition-colors border border-dashed border-border hover:border-primary px-2 py-1 rounded-lg">
                      {emp.isActive !== false ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => deleteEmployee(emp)}
                      className="text-xs text-textMuted hover:text-danger transition-colors p-1.5 rounded-lg hover:bg-dangerLt">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
              {employees.length === 0 && <p className="text-sm text-textMuted py-4">No employees yet.</p>}
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              {!creatingEmp ? (
                <button onClick={() => setCreatingEmp(true)}
                  className="flex items-center gap-2 text-sm text-primary font-semibold hover:underline">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add Employee
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-textPrimary">New Employee</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'name',     label: 'Full Name',    type: 'text',     placeholder: 'Jane Smith' },
                      { key: 'email',    label: 'Email',        type: 'email',    placeholder: 'jane@company.com' },
                      { key: 'password', label: 'Password',     type: 'password', placeholder: 'Min 6 chars' },
                      { key: 'phone',    label: 'Phone',        type: 'text',     placeholder: '10-digit' },
                      { key: 'deviceId', label: 'Device ID',    type: 'text',     placeholder: 'Optional' },
                    ].map(({ key, label, type, placeholder }) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-textMuted mb-1">{label}</label>
                        <input type={type} value={newEmp[key]} placeholder={placeholder}
                          onChange={e => setNewEmp({ ...newEmp, [key]: e.target.value })}
                          className={inputCls} />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setCreatingEmp(false)}
                      className="flex-1 border border-border text-textSecondary py-2 rounded-xl text-sm font-medium hover:border-danger hover:text-danger transition-colors">
                      Cancel
                    </button>
                    <button onClick={handleCreateEmployee} disabled={empSaving}
                      className="flex-1 bg-primary text-white py-2 rounded-xl text-sm font-semibold hover:bg-primaryDk disabled:opacity-60 transition-colors">
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
        <div className="bg-white border border-border rounded-2xl p-10 text-center shadow-card">
          <p className="text-textMuted">Team management is available to managers only.</p>
        </div>
      )}

      {/* ── PREFERENCES ── */}
      {tab === 'Preferences' && (
        <div className="space-y-4">
          <Section title="Display" desc="Customize your dashboard experience">
            <PrefRow label="Show Live Indicator" desc="Green 'Live' dot in the top bar">
              <Toggle checked={prefs.showLiveDot} onChange={v => updatePref('showLiveDot', v)} />
            </PrefRow>
            <PrefRow label="Auto-Refresh Dashboard" desc="Refresh stats every 30 seconds">
              <Toggle checked={prefs.autoRefresh} onChange={v => updatePref('autoRefresh', v)} />
            </PrefRow>
          </Section>

          <Section title="Defaults" desc="Set your preferred default filters">
            <PrefRow label="Default Period" desc="Period selected on dashboard load">
              <select value={prefs.defaultPeriod} onChange={e => updatePref('defaultPeriod', e.target.value)}
                className="border border-border rounded-xl px-3 py-2 text-sm bg-bg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </PrefRow>
            <PrefRow label="Date Format" desc="How dates are displayed across the app">
              <select value={prefs.dateFormat} onChange={e => updatePref('dateFormat', e.target.value)}
                className="border border-border rounded-xl px-3 py-2 text-sm bg-bg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                <option value="en-IN">en-IN (14 Jun 2026)</option>
                <option value="en-US">en-US (Jun 14, 2026)</option>
                <option value="en-GB">en-GB (14/06/2026)</option>
              </select>
            </PrefRow>
          </Section>

          <div className="flex justify-end">
            <button onClick={() => { savePrefs(DEFAULT_PREFS); setPrefs(DEFAULT_PREFS); toast.success('Preferences reset'); }}
              className="text-xs text-textMuted hover:text-danger transition-colors border border-dashed border-border hover:border-danger px-4 py-2 rounded-xl">
              Reset to Defaults
            </button>
          </div>
        </div>
      )}

      {/* ── ABOUT ── */}
      {tab === 'About' && (
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-2xl p-6 shadow-card flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center shadow-card-md flex-shrink-0">
              <span className="text-white text-xl font-black">CT</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-textPrimary">CallTrack CRM</h3>
              <p className="text-textMuted text-sm mt-0.5">Call log management and analytics platform</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="bg-primaryLt text-primary text-xs px-2.5 py-0.5 rounded-full font-semibold">v2.0.0</span>
                <span className="bg-successLt text-success text-xs px-2.5 py-0.5 rounded-full font-semibold">Dashboard</span>
              </div>
            </div>
          </div>

          <Section title="System Information">
            <div className="space-y-3 text-sm">
              {[
                { label: 'Version',    value: '2.0.0' },
                { label: 'Stack',      value: 'Next.js 14 · Express · MongoDB · React Native' },
                { label: 'Real-time',  value: 'Pusher WebSockets' },
                { label: 'Auth',       value: 'JWT · 7-day expiry' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between py-2 border-b border-border last:border-0">
                  <span className="text-textMuted font-medium w-28 flex-shrink-0">{label}</span>
                  <span className="text-textPrimary font-medium text-right">{value}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Quick Links">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'View Dashboard',      href: '/dashboard' },
                { label: 'View Leaderboard',    href: '/employees/leaderboard' },
                { label: 'Live Monitor',        href: '/calls/live' },
                { label: 'Advanced Analytics',  href: '/analytics/advanced' },
              ].map(({ label, href }) => (
                <a key={href} href={href}
                  className="flex items-center gap-2 text-sm text-primary hover:underline font-medium p-2 rounded-xl hover:bg-primaryLt transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
