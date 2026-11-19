'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../../lib/api';
import { getAllEmployeesSafe } from '../../../../lib/employees';
import { PageHeader, fmtNum } from '../../../../components/report-shared';
import MultiSelect from '../../../../components/MultiSelect';

function Ico({ size = 16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>;
}
const SearchIco = () => <Ico size={14}><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.5" y2="16.5" /></Ico>;
const PlusIco = () => <Ico size={15}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Ico>;
const EyeIco = () => <Ico size={15}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></Ico>;
const EyeOffIco = () => <Ico size={15}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></Ico>;

// The User model's only status field is the boolean `isActive` — writes go through
// PATCH /:id/status (the only route that persists it); PUT /:id ignores status.
const EMPTY = { name: '', email: '', phone: '', role: 'employee', status: 'active', password: '', confirmPassword: '', tlName: '', ryanEmployeeCode: '' };
const ROLES = [
  { value: 'employee', label: 'Agent', hint: 'Uses the mobile app; no dashboard access.' },
  { value: 'tl', label: 'Team lead', hint: 'Sees only employees whose TL name matches their name.' },
  { value: 'manager', label: 'Manager', hint: 'Sees only employees whose TL name matches their name.' },
  { value: 'admin', label: 'Admin', hint: 'Sees and manages everything.' },
];
const roleLabel = (r) => ROLES.find((x) => x.value === r)?.label || 'Agent';
const toForm = (u) => ({
  name: u.name || '', email: u.email || '', phone: u.phone || '',
  role: ROLES.some((r) => r.value === u.role) ? u.role : 'employee', // never send an invalid role
  status: u.isActive === false ? 'inactive' : 'active',
  password: '', confirmPassword: '', tlName: u.tlName || '', ryanEmployeeCode: u.ryanEmployeeCode || '',
});
const initials = (n) => (n || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

function Section({ title, desc, children }) {
  return (
    <fieldset className="grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)] gap-x-8 gap-y-4 py-6 border-b border-line-2 last:border-0 first:pt-2">
      <legend className="contents">
        <span className="block">
          <span className="block text-[13px] font-semibold text-ink">{title}</span>
          {desc && <span className="block text-[12.5px] text-ink-3 mt-1 leading-relaxed">{desc}</span>}
        </span>
      </legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">{children}</div>
    </fieldset>
  );
}

function Input({ label, required, hint, error, full, children }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="form-label">{label}{required && <span className="text-behind ml-0.5" aria-hidden>*</span>}</span>
      {children}
      {error ? <span className="form-error block" role="alert">{error}</span> : hint ? <span className="form-hint block">{hint}</span> : null}
    </label>
  );
}

export default function UpdateUsersPage() {
  const params = useSearchParams();
  const editId = params.get('id');

  const [users, setUsers] = useState([]);
  const [tlNames, setTlNames] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [baseline, setBaseline] = useState(EMPTY);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [mode, setMode] = useState('edit'); // 'edit' | 'add'
  const [loading, setLoading] = useState(true);

  const load = useCallback((keepId) => {
    setLoading(true);
    (async () => {
      let list = [];
      try {
        const r0 = await api.get('/api/users', { params: { page: 1, limit: 200 } });
        const pages = r0.data?.pages ?? 1;
        list = r0.data?.data || [];
        for (let p = 2; p <= pages; p++) {
          const rp = await api.get('/api/users', { params: { page: p, limit: 200 } });
          list = [...list, ...(rp.data?.data || [])];
        }
      } catch {
        list = await getAllEmployeesSafe(api);
      }
      setUsers(list);
      const want = keepId || editId;
      if (want) {
        const u = list.find((x) => x._id === want);
        if (u) { setSelected(u); setForm(toForm(u)); setBaseline(toForm(u)); setMode('edit'); }
      }
    })().catch(() => {}).finally(() => setLoading(false));
  }, [editId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/api/employees/tl-names').then((r) => setTlNames(r.data.data || [])).catch(() => {}); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) =>
      (!roleFilter || roleFilter.split(',').includes(u.role || 'employee')) &&
      (!q || [u.name, u.email, u.ryanEmployeeCode, u.phone].some((v) => (v || '').toLowerCase().includes(q))));
  }, [users, search, roleFilter]);

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const pwdMismatch = form.password && form.confirmPassword !== form.password;

  const confirmDiscard = () => !dirty || window.confirm('Discard unsaved changes?');
  const selectUser = (u) => {
    if (selected?._id === u._id || !confirmDiscard()) return;
    setSelected(u); setMode('edit'); setError(''); setTouched(false);
    setForm(toForm(u)); setBaseline(toForm(u));
  };
  const startAdd = () => {
    if (!confirmDiscard()) return;
    setSelected(null); setMode('add'); setError(''); setTouched(false);
    setForm(EMPTY); setBaseline(EMPTY);
  };
  const reset = () => { setForm(baseline); setError(''); setTouched(false); if (mode === 'add') setMode('edit'); };

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (pwdMismatch) return;
    setSaving(true); setError('');
    try {
      const body = { name: form.name, email: form.email, phone: form.phone, role: form.role, tlName: form.tlName.trim(), ryanEmployeeCode: form.ryanEmployeeCode };
      if (form.password) body.password = form.password;
      if (mode === 'edit' && selected) {
        await api.put(`/api/employees/${selected._id}`, body);
        const wantActive = form.status === 'active';
        if (wantActive !== (selected.isActive !== false)) {
          await api.patch(`/api/employees/${selected._id}/status`, { isActive: wantActive });
        }
        toast.success(`Saved ${form.name}`);
        load(selected._id);
      } else {
        const r = await api.post('/api/employees', body);
        toast.success(`Created ${form.name}`);
        load(r.data?.data?._id);
      }
      setBaseline({ ...form, password: '', confirmPassword: '' });
      setForm((f) => ({ ...f, password: '', confirmPassword: '' }));
      setTouched(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Couldn’t save. Check the fields and try again.');
    }
    setSaving(false);
  };

  const editing = mode === 'add' || selected;
  const roleCounts = users.reduce((m, u) => { const r = u.role || 'employee'; m[r] = (m[r] || 0) + 1; return m; }, {});

  return (
    <div>
      <PageHeader
        title="Add & edit users"
        description={loading ? 'Loading users…' : `${fmtNum(users.length)} accounts · ${fmtNum(users.filter((u) => u.role === 'admin' || u.isSuperAdmin).length)} with admin access · ${fmtNum(users.filter((u) => (u.role === 'manager' || u.role === 'tl') && !u.isSuperAdmin).length)} managers & team leads`}
        actions={<button onClick={startAdd} className="btn-primary"><PlusIco /> New user</button>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start">
        {/* Master list */}
        <aside className="panel overflow-hidden xl:sticky xl:top-[76px]">
          <div className="p-3 space-y-2 border-b border-line-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none"><SearchIco /></span>
              <input className="form-input pl-9" placeholder="Search name, email, ID" aria-label="Search users"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <MultiSelect className="h-8 text-xs" ariaLabel="Filter by role" placeholder="All roles" noun="roles"
              value={roleFilter} onChange={setRoleFilter}
              options={ROLES.map((r) => [r.value, `${r.label}${roleCounts[r.value] ? ` (${roleCounts[r.value]})` : ''}`])} />
          </div>
          <ul className="overflow-y-auto max-h-[calc(100vh-260px)] min-h-[200px] p-1.5" role="listbox" aria-label="Users">
            {loading ? Array.from({ length: 7 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 px-2.5 h-14"><div className="skeleton w-8 h-8 rounded-full" /><div className="flex-1 space-y-1.5"><div className="skeleton h-3 w-28" /><div className="skeleton h-2.5 w-20" /></div></li>
            )) : filtered.length === 0 ? (
              <li className="px-4 py-10 text-center text-[13px] text-ink-3">No users match “{search}”.</li>
            ) : filtered.map((u) => {
              const on = selected?._id === u._id && mode === 'edit';
              return (
                <li key={u._id}>
                  <button role="option" aria-selected={on} onClick={() => selectUser(u)}
                    className={`w-full flex items-center gap-3 px-2.5 h-14 rounded-lg text-left transition-colors duration-150 ${on ? 'bg-[var(--blue-50)]' : 'hover:bg-gray-50'}`}>
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${on ? 'bg-[var(--blue)] text-white' : 'bg-gray-100 text-ink-2'}`}>{initials(u.name)}</span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-[13px] font-medium truncate ${on ? 'text-[var(--blue)]' : 'text-ink'}`}>{u.name || 'Unnamed'}</span>
                      <span className="block text-xs text-ink-3 truncate">{roleLabel(u.role)}{u.ryanEmployeeCode ? ` · ${u.ryanEmployeeCode}` : ''}{u.tlName ? ` · TL ${u.tlName}` : ''}</span>
                    </span>
                    {u.isActive === false && <span className="badge bg-gray-100 text-ink-3 shrink-0">Inactive</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Detail form */}
        <section className="panel" aria-label={mode === 'add' ? 'New user' : 'Edit user'}>
          {!editing ? (
            <div className="flex flex-col items-center justify-center text-center py-24 px-6">
              <p className="text-sm font-medium text-ink">Choose someone to edit</p>
              <p className="text-[13px] text-ink-3 mt-1 max-w-xs">Pick a user from the list to change their details, role or password — or create a new account.</p>
              <button onClick={startAdd} className="btn-secondary btn-sm mt-4"><PlusIco /> New user</button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate={false}>
              <div className="panel-head">
                <div className="min-w-0">
                  <h2 className="panel-title truncate">{mode === 'add' ? 'New user' : selected?.name}</h2>
                  <p className="panel-sub">{mode === 'add' ? 'Create an account for an agent, team lead, manager or admin' : `${roleLabel(selected?.role)} · ${selected?.email || 'no email'}`}</p>
                </div>
              </div>

              <div className="px-5">
                <AnimatePresence>
                  {error && (
                    <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                      className="mt-4 text-[13px] text-behind bg-[var(--behind-50)] rounded-lg px-3 py-2.5">{error}</motion.p>
                  )}
                </AnimatePresence>

                <Section title="Profile" desc="How this person appears across reports.">
                  <Input label="Full name" required full>
                    <input required className="form-input" placeholder="Raj Sharma" value={form.name} onChange={(e) => setF('name', e.target.value)} />
                  </Input>
                  <Input label="Email" required={mode === 'add'} hint="Used to sign in.">
                    <input type="email" required={mode === 'add'} className="form-input" placeholder="raj@company.com" value={form.email} onChange={(e) => setF('email', e.target.value)} />
                  </Input>
                  <Input label="Phone">
                    <input type="tel" className="form-input tabular-nums" placeholder="98765 43210" value={form.phone} onChange={(e) => setF('phone', e.target.value)} />
                  </Input>
                </Section>

                <Section title="Role & team" desc="Managers and team leads see only the employees whose TL name matches their own name (capital letters don’t matter).">
                  <Input label="Role" required hint={ROLES.find((r) => r.value === form.role)?.hint}>
                    <select required className="form-input" value={form.role} onChange={(e) => setF('role', e.target.value)}>
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </Input>
                  <Input label="Employee ID">
                    <input className="form-input" placeholder="RC-014" value={form.ryanEmployeeCode} onChange={(e) => setF('ryanEmployeeCode', e.target.value)} />
                  </Input>
                  <Input label="TL name" full hint={form.role === 'employee' ? 'The team lead or manager this agent reports to.' : 'Agents with this TL name will report to this person if it matches their name.'}>
                    <input className="form-input" list="tl-names" placeholder="Start typing a team lead…" value={form.tlName} onChange={(e) => setF('tlName', e.target.value)} />
                    <datalist id="tl-names">{tlNames.map((n) => <option key={n} value={n} />)}</datalist>
                  </Input>
                </Section>

                <Section title="Access" desc="Inactive users can’t sign in. Their history stays in reports.">
                  <div className="sm:col-span-2">
                    <span className="form-label">Status</span>
                    <div className="seg" role="radiogroup" aria-label="Status">
                      {[['active', 'Active'], ['inactive', 'Inactive']].map(([k, l]) => (
                        <button type="button" key={k} role="radio" aria-checked={form.status === k} aria-pressed={form.status === k} onClick={() => setF('status', k)}>{l}</button>
                      ))}
                    </div>
                  </div>
                </Section>

                <Section title="Password" desc={mode === 'add' ? 'They’ll use this to sign in.' : 'Leave blank to keep their current password.'}>
                  <Input label={mode === 'add' ? 'Password' : 'New password'} required={mode === 'add'}>
                    <span className="relative block">
                      <input required={mode === 'add'} type={showPwd ? 'text' : 'password'} autoComplete="new-password"
                        className="form-input pr-10" value={form.password} onChange={(e) => setF('password', e.target.value)} />
                      <button type="button" onClick={() => setShowPwd((v) => !v)} aria-label={showPwd ? 'Hide password' : 'Show password'}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-ink-3 hover:text-ink hover:bg-gray-100">
                        {showPwd ? <EyeOffIco /> : <EyeIco />}
                      </button>
                    </span>
                  </Input>
                  <Input label="Confirm password" required={!!form.password} error={(touched || form.confirmPassword) && pwdMismatch ? 'Passwords don’t match.' : null}>
                    <input required={!!form.password} type={showPwd ? 'text' : 'password'} autoComplete="new-password"
                      aria-invalid={(touched || !!form.confirmPassword) && !!pwdMismatch}
                      className="form-input" value={form.confirmPassword} onChange={(e) => setF('confirmPassword', e.target.value)} />
                  </Input>
                </Section>
              </div>

              {/* Save bar */}
              <div className="sticky bottom-0 flex items-center justify-between gap-3 px-5 h-16 border-t border-line bg-white rounded-b-xl">
                <span className="text-[13px] text-ink-3" aria-live="polite">
                  {dirty ? <span className="inline-flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--warn)]" />Unsaved changes</span> : mode === 'add' ? 'Fill in the details to create the account' : 'No changes'}
                </span>
                <div className="flex gap-2">
                  {(dirty || mode === 'add') && <button type="button" onClick={reset} className="btn-ghost">Cancel</button>}
                  <button type="submit" disabled={saving || (!dirty && mode === 'edit')} className="btn-primary min-w-[120px]">
                    {saving ? 'Saving…' : mode === 'add' ? 'Create user' : 'Save changes'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
