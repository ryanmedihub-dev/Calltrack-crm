'use client';
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { fmtDate } from '@/lib/timezone';
import { DataTable, StatCard, UsersIco, CheckIco, XIco, SearchIco } from '@/components/report-shared';

function CloseIco() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
}
function EditIco() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>;
}
function TrashIco() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
}
function WarningIco() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
}

const AVATAR_COLORS = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#0D9488', '#7C3AED'];
function avatarColor(id) {
  const s = String(id || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function StatusToggle({ user, onSaved }) {
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      await api.patch(`/api/employees/${user._id}/status`, { isActive: !user.isActive });
      toast.success(!user.isActive ? 'Marked active' : 'Marked inactive');
      onSaved({ ...user, isActive: !user.isActive });
    } catch {
      toast.error('Failed to update status');
    } finally {
      setBusy(false);
    }
  };
  return (
    <button onClick={toggle} disabled={busy}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium disabled:opacity-50 ${user.isActive ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
      {user.isActive ? 'Active' : 'Inactive'}
    </button>
  );
}

function TargetCell({ user, onSaved }) {
  const [value, setValue] = useState(user.dailyTarget ?? 0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    setEditing(false);
    const num = Number(value);
    if (Number.isNaN(num) || num < 0 || num === (user.dailyTarget ?? 0)) { setValue(user.dailyTarget ?? 0); return; }
    setSaving(true);
    try {
      await api.patch(`/api/employees/${user._id}/target`, { dailyTarget: num });
      toast.success('Target updated');
      onSaved({ ...user, dailyTarget: num });
    } catch {
      toast.error('Failed to update target');
      setValue(user.dailyTarget ?? 0);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <input autoFocus type="number" min={0} value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className="w-20 text-xs border border-blue-300 rounded-md px-2 py-1 outline-none text-right" />
    );
  }
  return (
    <button onClick={() => setEditing(true)} disabled={saving}
      className="text-xs font-semibold text-gray-700 hover:text-blue-600 hover:underline disabled:opacity-50">
      {saving ? '…' : value || 0}
    </button>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', phone: '', tlName: '', ryanEmployeeCode: '' });
  const [addSaving, setAddSaving] = useState(false);

  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', deviceId: '', tlName: '', ryanEmployeeCode: '' });
  const [editSaving, setEditSaving] = useState(false);

  const [deleteUser, setDeleteUser] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async (q = search) => {
    setLoading(true);
    try {
      const res = await api.get('/api/employees', { params: q ? { search: q } : {} });
      setUsers(res.data.data || []);
    } catch {
      toast.error('Failed to load users');
    }
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const patchLocal = (updated) => setUsers((list) => list.map((u) => (u._id === updated._id ? updated : u)));

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddSaving(true);
    try {
      await api.post('/api/employees', addForm);
      toast.success('User added');
      setShowAdd(false);
      setAddForm({ name: '', email: '', password: '', phone: '', tlName: '', ryanEmployeeCode: '' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add user');
    } finally {
      setAddSaving(false);
    }
  };

  const openEdit = (u) => { setEditUser(u); setEditForm({ name: u.name || '', phone: u.phone || '', deviceId: u.deviceId || '', tlName: u.tlName || '', ryanEmployeeCode: u.ryanEmployeeCode || '' }); };
  const handleEdit = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    try {
      const res = await api.put(`/api/employees/${editUser._id}`, editForm);
      toast.success('User updated');
      patchLocal(res.data.data);
      setEditUser(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/employees/${deleteUser._id}`);
      toast.success('User deleted');
      setUsers((list) => list.filter((u) => u._id !== deleteUser._id));
      setDeleteUser(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const total = users.length;
  const active = users.filter((u) => u.isActive).length;

  const columns = [
    {
      key: 'name', label: 'User',
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: avatarColor(u._id) }}>
            {(u.name || 'U')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-900 truncate">{u.name}</p>
            <p className="text-xs text-gray-400 truncate">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'ryanEmployeeCode', label: 'Employee ID', render: (u) => u.ryanEmployeeCode || '—' },
    { key: 'phone', label: 'Phone', render: (u) => u.phone || '—' },
    { key: 'tlName', label: 'TL Name', render: (u) => u.tlName || '—' },
    { key: 'isActive', label: 'Status', sortable: false, searchable: false, render: (u) => <StatusToggle user={u} onSaved={patchLocal} /> },
    { key: 'dailyTarget', label: 'Daily Target', align: 'right', sortable: false, searchable: false, render: (u) => <TargetCell user={u} onSaved={patchLocal} /> },
    { key: 'createdAt', label: 'Joined', align: 'right', searchable: false, render: (u) => fmtDate(u.createdAt) },
    {
      key: 'actions', label: '', sortable: false, searchable: false, align: 'right',
      render: (u) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openEdit(u)} title="Edit"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
            <EditIco />
          </button>
          <button onClick={() => setDeleteUser(u)} title="Delete"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <TrashIco />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} user{total === 1 ? '' : 's'} · manage accounts, status and daily targets</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">+ Add User</button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard loading={loading} label="Total Users" value={total.toLocaleString()} color="#2563EB" icon={<UsersIco />} />
        <StatCard loading={loading} label="Active" value={active.toLocaleString()} color="#16A34A" icon={<CheckIco />} />
        <StatCard loading={loading} label="Inactive" value={(total - active).toLocaleString()} color="#DC2626" icon={<XIco />} />
      </div>

    
      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <DataTable
          loading={loading}
          pageSize={15}
          emptyTitle="No users found"
          emptyHint="Try a different search, or add your first user."
          columns={columns}
          rows={users}
        />
      </div>

      {/* ── Add User Modal ── */}
      {showAdd && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 modal-overlay" style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(5px)' }}>
          <div className="w-full max-w-md rounded-xl modal-content bg-white border border-gray-200 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-sm text-gray-900">Add New User</h3>
                <p className="text-xs text-gray-400 mt-0.5">They'll receive login credentials for the mobile app</p>
              </div>
              <button onClick={() => setShowAdd(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                <CloseIco />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-5 space-y-4">
              {[
                { k: 'name', l: 'Full Name', t: 'text', ph: 'John Doe', req: true },
                { k: 'email', l: 'Email', t: 'email', ph: 'john@company.com', req: true },
                { k: 'password', l: 'Password', t: 'password', ph: 'Min 6 characters', req: true },
                { k: 'phone', l: 'Phone (optional)', t: 'text', ph: '+91 99999 99999', req: false },
                { k: 'tlName', l: 'TL Name (optional)', t: 'text', ph: 'e.g. Priya Singh', req: false },
                { k: 'ryanEmployeeCode', l: 'Employee ID (optional)', t: 'text', ph: 'e.g. RC-014', req: false },
              ].map(({ k, l, t, ph, req }) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
                  <input type={t} required={req} value={addForm[k]} placeholder={ph}
                    onChange={(e) => setAddForm({ ...addForm, [k]: e.target.value })} className="form-input" />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={addSaving} className="btn-primary flex-1 justify-center disabled:opacity-70">
                  {addSaving ? 'Adding…' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ── */}
      {editUser && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 modal-overlay" style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(5px)' }}>
          <div className="w-full max-w-md rounded-xl modal-content bg-white border border-gray-200 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-sm text-gray-900">Edit {editUser.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Email and password can't be changed here</p>
              </div>
              <button onClick={() => setEditUser(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                <CloseIco />
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                <input type="text" required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="form-input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input type="text" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="form-input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Device ID (optional)</label>
                <input type="text" value={editForm.deviceId} onChange={(e) => setEditForm({ ...editForm, deviceId: e.target.value })} className="form-input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">TL Name</label>
                <input type="text" value={editForm.tlName} onChange={(e) => setEditForm({ ...editForm, tlName: e.target.value })} className="form-input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Employee ID</label>
                <input type="text" value={editForm.ryanEmployeeCode} placeholder="e.g. RC-014" onChange={(e) => setEditForm({ ...editForm, ryanEmployeeCode: e.target.value })} className="form-input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" value={editUser.email} disabled className="form-input opacity-60 cursor-not-allowed" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditUser(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={editSaving} className="btn-primary flex-1 justify-center disabled:opacity-70">
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteUser && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 modal-overlay" style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(5px)' }}>
          <div className="w-full max-w-sm rounded-xl modal-content bg-white border border-gray-200 shadow-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0"><WarningIco /></div>
              <div>
                <h3 className="font-bold text-sm text-gray-900">Delete {deleteUser.name}?</h3>
                <p className="text-xs text-gray-400 mt-1">This permanently removes their account. Their existing call logs and lead assignments are not deleted. This can't be undone.</p>
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <button onClick={() => setDeleteUser(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 justify-center inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-70">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}