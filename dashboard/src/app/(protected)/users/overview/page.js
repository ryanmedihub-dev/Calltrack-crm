'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '../../../../lib/api';
import { getAllEmployeesSafe } from '../../../../lib/employees';
import { fmtDate } from '../../../../lib/timezone';
import { DataTable, PageHeader, fmtNum } from '../../../../components/report-shared';

const ROLES = [
  { key: 'admin', label: 'Admin' },
  { key: 'manager', label: 'Manager' },
  { key: 'tl', label: 'Team lead' },
  { key: 'employee', label: 'Agent' },
];
const roleLabel = (u) => (u.isSuperAdmin ? 'Admin' : ROLES.find((r) => r.key === (u.role || 'employee'))?.label || 'Agent');
const initials = (n) => (n || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export default function UsersOverviewPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // All system users via the admin endpoint; fall back to the employee list if not permitted.
        let list = null;
        try {
          const r0 = await api.get('/api/users', { params: { page: 1, limit: 200 } });
          const pages = r0.data?.pages ?? 1;
          list = r0.data?.data || [];
          for (let p = 2; p <= pages; p++) {
            const rp = await api.get('/api/users', { params: { page: p, limit: 200 } });
            list = [...list, ...(rp.data?.data || [])];
          }
        } catch { list = null; }
        if (!list || !list.length) list = await getAllEmployeesSafe(api);
        const seen = new Set();
        setUsers(list.filter((u) => u?._id && !seen.has(String(u._id)) && seen.add(String(u._id))));
      } catch (err) {
        console.error('UsersOverview load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const counts = useMemo(() => users.reduce((m, u) => { const k = u.isSuperAdmin ? 'admin' : (u.role || 'employee'); m[k] = (m[k] || 0) + 1; return m; }, {}), [users]);
  const rows = users.filter((u) => {
    const k = u.isSuperAdmin ? 'admin' : (u.role || 'employee');
    return (!role || k === role) && (!status || (u.isActive === false ? 'inactive' : 'active') === status);
  });
  const inactive = users.filter((u) => u.isActive === false).length;

  return (
    <div>
      <PageHeader
        title="Users"
        description={loading ? 'Loading…' : `${fmtNum(users.length)} accounts · ${fmtNum(counts.admin || 0)} admin, ${fmtNum(counts.manager || 0)} managers, ${fmtNum(counts.tl || 0)} team leads, ${fmtNum(counts.employee || 0)} agents`}
        actions={<Link href="/users/update-users" className="btn-primary">New user</Link>}
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="seg" role="group" aria-label="Role">
          <button aria-pressed={!role} onClick={() => setRole('')}>All <span className="ml-1 text-ink-3 tabular-nums">{users.length || ''}</span></button>
          {ROLES.map((r) => (
            <button key={r.key} aria-pressed={role === r.key} onClick={() => setRole(r.key)}>
              {r.label} <span className="ml-1 text-ink-3 tabular-nums">{counts[r.key] || 0}</span>
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Status">
          <button aria-pressed={!status} onClick={() => setStatus('')}>Any status</button>
          <button aria-pressed={status === 'active'} onClick={() => setStatus('active')}>Active</button>
          <button aria-pressed={status === 'inactive'} onClick={() => setStatus('inactive')}>Inactive <span className="ml-1 text-ink-3 tabular-nums">{inactive}</span></button>
        </div>
      </div>

      <DataTable
        loading={loading}
        rows={rows}
        pageSize={25}
        getRowId={(u) => u._id}
        emptyTitle="No users match these filters"
        emptyHint="Clear the role or status filter."
        columns={[
          {
            key: 'name', label: 'User', width: '26%',
            filterValue: (u) => `${u.name} ${u.email || ''} ${u.phone || ''} ${u.ryanEmployeeCode || ''}`,
            render: (u) => (
              <span className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 rounded-full bg-gray-100 text-ink-2 flex items-center justify-center text-xs font-semibold shrink-0">{initials(u.name)}</span>
                <span className="min-w-0">
                  <span className="block font-medium text-ink truncate">{u.name || 'Unnamed'}</span>
                  <span className="block text-xs text-ink-3 truncate">{u.email || '—'}</span>
                </span>
              </span>
            ),
          },
          { key: 'role', label: 'Role', width: '10%', searchable: false, render: (u) => roleLabel(u) },
          { key: 'tlName', label: 'Team lead', width: '14%', render: (u) => u.tlName || <span className="text-ink-4">—</span> },
          { key: 'phone', label: 'Phone', width: '13%', render: (u) => <span className="tabular-nums">{u.phone || '—'}</span> },
          { key: 'ryanEmployeeCode', label: 'Employee ID', width: '10%', render: (u) => u.ryanEmployeeCode || <span className="text-ink-4">—</span> },
          {
            key: 'isActive', label: 'Status', width: '10%', searchable: false,
            render: (u) => (
              <span className="inline-flex items-center gap-1.5 text-[13px]">
                <span className={`w-1.5 h-1.5 rounded-full ${u.isActive !== false ? 'bg-[var(--met)]' : 'bg-gray-300'}`} />
                <span className={u.isActive !== false ? 'text-ink-2' : 'text-ink-3'}>{u.isActive !== false ? 'Active' : 'Inactive'}</span>
              </span>
            ),
          },
          { key: 'createdAt', label: 'Joined', width: '12%', searchable: false, render: (u) => <span className="tabular-nums text-ink-3">{u.createdAt ? fmtDate(u.createdAt) : '—'}</span> },
          {
            key: 'edit', label: '', width: '6%', align: 'right', sortable: false, searchable: false,
            render: (u) => <Link href={`/users/update-users?id=${u._id}`} className="btn-ghost btn-sm">Edit</Link>,
          },
        ]}
      />
    </div>
  );
}
