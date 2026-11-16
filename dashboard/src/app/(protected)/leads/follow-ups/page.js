'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../../lib/api';
import { getAllEmployeesSafe } from '../../../../lib/employees';
import { fmtDate } from '../../../../lib/timezone';
import { DataTable, LeadStatusBadge, InfoDot } from '../../../../components/report-shared';
import { statusStyle, statusLabel } from '../../../../lib/leadStatus';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const SearchIco  = () => <Ico size={13}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>;
const CalendarIco= ({s=20}) => <Ico size={s}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Ico>;

const fmt = fmtDate;

function dueStatus(ts) {
  if (!ts) return null;
  const diff = Math.floor((new Date(ts)-Date.now())/86400000);
  if (diff < 0)  return { label:'Overdue',  className: 'bg-red-50 text-red-600 border-red-200' };
  if (diff === 0) return { label:'Due Today', className: 'bg-amber-50 text-amber-600 border-amber-200' };
  if (diff <= 2) return { label:`In ${diff}d`, className: 'bg-blue-50 text-blue-600 border-blue-200' };
  return { label:`In ${diff}d`, className: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
}

export default function FollowUpsPage() {
  const [leads,     setLeads]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [employee,  setEmployee]  = useState('');
  const [employees, setEmployees] = useState([]);
  const [dueSoon,   setDueSoon]   = useState(false);
  const [page,      setPage]      = useState(1);
  const [total,     setTotal]     = useState(0);
  const PER_PAGE = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/leads', {
        params: {
          followUp: true,
          search: search||undefined,
          assignedTo: employee||undefined,
          dueSoon: dueSoon||undefined,
          page, limit: PER_PAGE,
        },
      });
      setLeads(r.data?.data?.leads||r.data?.data||[]);
      setTotal(r.data?.data?.total||0);
    } catch { setLeads([]); }
    setLoading(false);
  }, [search, employee, dueSoon, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getAllEmployeesSafe(api).then(setEmployees).catch(()=>{}); }, []);

  const totalPages = Math.ceil(total/PER_PAGE);
  // NOTE: this page is server-paginated — `leads` only holds the CURRENT page's rows,
  // so this count can only ever reflect overdue follow-ups on the page you're looking
  // at, not the true total across every page. Labeled accordingly below rather than
  // implying a global count (there's no lightweight "overdue total" endpoint to call instead).
  const overdueThisPage = leads.filter(l => l.followUpDate && new Date(l.followUpDate) < new Date()).length;

  const columns = [
    {
      key: 'name',
      label: 'Lead',
      render: (l) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 bg-amber-600">{(l.name||'?')[0].toUpperCase()}</div>
          <div>
            <p className="font-semibold text-xs text-gray-900">{l.name||'Unknown'}</p>
            <p className="text-[11px] text-gray-400">{l.email||''}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone', render: (l) => <span className="font-mono text-xs text-gray-600">{l.phone||'—'}</span> },
    { key: 'assignedToName', label: 'Assigned To', render: (l) => <span className="text-xs text-gray-600">{l.assignedTo?.name||'Unassigned'}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (l) => <LeadStatusBadge status={l.status} style={statusStyle(l.status)} label={statusLabel(l.status)} />,
    },
    { key: 'followUpDate', label: 'Follow-up Date', render: (l) => <span className="text-xs text-gray-600">{fmt(l.followUpDate)}</span> },
    {
      key: 'due',
      label: 'Due',
      render: (l) => {
        const due = dueStatus(l.followUpDate);
        return due ? <span className={`badge border ${due.className}`}>{due.label}</span> : null;
      },
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600">
              <CalendarIco s={16}/>
            </div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Follow-ups</h2>
          </div>
          <p className="text-sm text-gray-400">Leads scheduled for a follow-up call or action</p>
        </div>
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {overdueThisPage > 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className="page-card px-4 py-2.5 flex items-center gap-2 border-l-4 border-red-600">
                <span className="text-sm font-bold tabular-nums text-red-600">{overdueThisPage}</span>
                <span className="text-xs font-medium text-gray-400 flex items-center">
                  Overdue (this page)
                  <InfoDot text="This counts only overdue follow-ups on the page currently shown. Leads are paginated server-side, so this isn't a global total." />
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="page-card px-4 py-2.5">
            <span className="text-sm font-bold tabular-nums text-amber-600">{total}</span>
            <span className="text-xs font-medium ml-1.5 text-gray-400">Total follow-ups</span>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {overdueThisPage > 0 && (
          <motion.div initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="page-card p-4 flex items-center gap-3 border-l-4 border-red-600 bg-red-50">
              <CalendarIco s={18}/>
              <p className="text-xs text-red-600">
                <strong>{overdueThisPage} follow-up{overdueThisPage>1?'s':''}</strong> on this page {overdueThisPage>1?'are':'is'} overdue. Contact these leads immediately to avoid losing them.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="filter-bar flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><SearchIco/></span>
          <input className="form-input pl-8 text-xs" placeholder="Search by name or phone…"
            value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
        </div>
        <select className="form-input text-xs w-44" value={employee} onChange={e=>{setEmployee(e.target.value);setPage(1);}}>
          <option value="">All Employees</option>
          {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
        </select>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={dueSoon} onChange={e=>{setDueSoon(e.target.checked);setPage(1);}} className="w-4 h-4 rounded accent-blue-600"/>
          <span className="text-xs font-medium text-gray-700">Due within 2 days</span>
        </label>
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="page-card overflow-hidden p-4">
        <DataTable
          serverMode
          columns={columns}
          rows={leads}
          loading={loading}
          page={page}
          totalPages={totalPages}
          totalCount={total}
          onPageChange={setPage}
          emptyTitle="No follow-ups scheduled"
          emptyHint="Leads scheduled for follow-up will appear here."
        />
      </motion.div>
    </div>
  );
}
