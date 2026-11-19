'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '../../../../lib/api';
import { getAllEmployeesSafe } from '../../../../lib/employees';
import { fmtDate } from '../../../../lib/timezone';
import { DataTable, LeadStatusBadge, PageHeader, fmtNum } from '../../../../components/report-shared';
import { statusStyle, statusLabel } from '../../../../lib/leadStatus';
import MultiSelect from '../../../../components/MultiSelect';

const SearchIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.5" y2="16.5" /></svg>
);

// Overdue is the only red; due today is amber; everything later is neutral.
function dueStatus(ts) {
  if (!ts) return null;
  const diff = Math.floor((new Date(ts) - Date.now()) / 86400000);
  if (diff < 0) return { label: `Overdue ${Math.abs(diff)}d`, tone: 'text-behind bg-[var(--behind-50)]' };
  if (diff === 0) return { label: 'Due today', tone: 'text-[var(--warn)] bg-[var(--warn-50)]' };
  return { label: `In ${diff} day${diff > 1 ? 's' : ''}`, tone: 'text-ink-2 bg-gray-100' };
}

export default function FollowUpsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [employee, setEmployee] = useState('');
  const [employees, setEmployees] = useState([]);
  const [dueSoon, setDueSoon] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PER_PAGE = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/leads', {
        params: {
          followUp: true,
          search: search || undefined,
          assignedTo: employee || undefined,
          dueSoon: dueSoon || undefined,
          page, limit: PER_PAGE,
        },
      });
      setLeads(r.data?.data?.leads || r.data?.data || []);
      setTotal(r.data?.data?.total || 0);
    } catch { setLeads([]); }
    setLoading(false);
  }, [search, employee, dueSoon, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getAllEmployeesSafe(api).then(setEmployees).catch(() => {}); }, []);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  // Server-paginated: this counts overdue rows on the page shown, and says so.
  const overdueThisPage = leads.filter((l) => l.followUpDate && new Date(l.followUpDate) < new Date()).length;

  const columns = [
    {
      key: 'name', label: 'Lead', width: '24%',
      render: (l) => (
        <span className="block min-w-0">
          <span className="block font-medium text-ink truncate">{l.name || l.phone || 'Unnamed lead'}</span>
          {l.name && l.name !== l.phone && <span className="block text-xs text-ink-3 tabular-nums">{l.phone}</span>}
        </span>
      ),
    },
    { key: 'assignedToName', label: 'Assigned to', width: '18%', render: (l) => l.assignedTo?.name || <span className="text-ink-4">Unassigned</span> },
    { key: 'status', label: 'Status', width: '18%', render: (l) => <LeadStatusBadge status={l.status} style={statusStyle(l.status)} label={statusLabel(l.status)} /> },
    { key: 'lastCallNote', label: 'Last note', width: '18%', render: (l) => <span className="text-ink-3 truncate block" title={l.lastCallNote || ''}>{l.lastCallNote || '—'}</span> },
    { key: 'followUpDate', label: 'Follow-up', width: '10%', render: (l) => <span className="tabular-nums">{fmtDate(l.followUpDate)}</span> },
    {
      key: 'due', label: 'Due', width: '12%', align: 'right',
      render: (l) => { const d = dueStatus(l.followUpDate); return d ? <span className={`badge ${d.tone}`}>{d.label}</span> : null; },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        description={loading ? 'Loading…' : `${fmtNum(total)} leads with a follow-up date · soonest first`}
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none"><SearchIco /></span>
          <input className="form-input pl-9" placeholder="Search name or phone" aria-label="Search leads"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <MultiSelect className="w-52" ariaLabel="Assigned to" placeholder="Everyone" noun="employees"
          value={employee} onChange={(v) => { setEmployee(v); setPage(1); }} options={employees.map((e) => [e._id, e.name])} />
        <div className="seg" role="group" aria-label="Due window">
          <button aria-pressed={!dueSoon} onClick={() => { setDueSoon(false); setPage(1); }}>All</button>
          <button aria-pressed={dueSoon} onClick={() => { setDueSoon(true); setPage(1); }}>Due in 2 days</button>
        </div>
        {overdueThisPage > 0 && (
          <span className="ml-auto text-[13px] text-behind tabular-nums" title="Counts overdue leads on the page shown; results are paged.">
            {fmtNum(overdueThisPage)} overdue on this page
          </span>
        )}
      </div>

      <DataTable
        serverMode
        searchable={false}
        columns={columns}
        rows={leads}
        loading={loading}
        page={page}
        pageSize={PER_PAGE}
        totalPages={totalPages}
        totalCount={total}
        onPageChange={setPage}
        getRowId={(l) => l._id}
        emptyTitle={dueSoon ? 'Nothing due in the next 2 days' : 'No follow-ups scheduled'}
        emptyHint={dueSoon ? 'Switch to All to see later follow-ups.' : 'Leads get a follow-up date from the post-call form or the lead editor.'}
      />
    </div>
  );
}
