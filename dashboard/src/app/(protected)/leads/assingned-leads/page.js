'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import api from '../../../../lib/api';
import { fmtDate } from '../../../../lib/timezone';
import { DataTable, LeadStatusBadge } from '../../../../components/report-shared';
import { STATUSES, STATUS_LABELS, statusStyle, statusLabel } from '../../../../lib/leadStatus';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const SearchIco = () => <Ico size={13}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>;
const AssignIco = ({s=20}) => <Ico size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></Ico>;
const XIco      = ({s=16}) => <Ico size={s}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Ico>;

const fmt = fmtDate;

export default function AssignedLeadsPage() {
  const [leads,     setLeads]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [employee,  setEmployee]  = useState('');
  const [status,    setStatus]    = useState('');
  const [employees, setEmployees] = useState([]);
  const [page,      setPage]      = useState(1);
  const [total,     setTotal]     = useState(0);
  const [selected,  setSelected]  = useState(new Set());
  const [reassign,  setReassign]  = useState(null); // { leadIds, leadNames, target }
  const [busy,      setBusy]      = useState(false);
  const [toast,     setToast]     = useState('');
  const PER_PAGE = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/leads', {
        params: {
          assigned: true,
          search: search||undefined,
          assignedTo: employee||undefined,
          status: status||undefined,
          page, limit: PER_PAGE,
        },
      });
      setLeads(r.data?.data?.leads||r.data?.data||[]);
      setTotal(r.data?.data?.total||0);
    } catch { setLeads([]); }
    setLoading(false);
  }, [search, employee, status, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/api/employees').then(r=>setEmployees(r.data?.data||[])).catch(()=>{}); }, []);
  useEffect(() => { setSelected(new Set()); }, [search, employee, status, page]);

  const totalPages = Math.ceil(total/PER_PAGE);

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(''), 3200); };

  const toggleSelect = (id) => setSelected((s) => {
    const next = new Set(s);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleSelectAll = (ids) => setSelected((s) => {
    const allSelected = ids.every((id) => s.has(id));
    const next = new Set(s);
    ids.forEach((id) => allSelected ? next.delete(id) : next.add(id));
    return next;
  });

  const openReassign = (rows) => setReassign({
    leadIds: rows.map((l)=>l._id),
    leadNames: rows.map((l)=>l.name||l.phone||'Lead'),
    target: '',
  });

  const confirmReassign = async () => {
    if (!reassign || !reassign.target) { showToast('Select an employee to reassign to.'); return; }
    setBusy(true);
    try {
      await api.post('/api/leads/bulk-transfer', { leadIds: reassign.leadIds, toEmployeeId: reassign.target });
      showToast(`${reassign.leadIds.length} lead${reassign.leadIds.length===1?'':'s'} reassigned.`);
      setSelected(new Set());
      setReassign(null);
      load();
    } catch (e) {
      showToast(e.response?.data?.error||'Reassignment failed. Please try again.');
    }
    setBusy(false);
  };

  const columns = [
    {
      key: 'name',
      label: 'Lead',
      render: (l) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 bg-gradient-to-br from-blue-600 to-blue-400">
            {(l.name||'?')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-xs text-gray-900">{l.name||'Unknown'}</p>
            <p className="text-[11px] text-gray-400">{l.email||''}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone', render: (l) => <span className="font-mono text-xs text-gray-600">{l.phone||'—'}</span> },
    {
      key: 'assignedToName',
      label: 'Assigned To',
      render: (l) => (
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0 bg-blue-600">
            {(l.assignedTo?.name||'?')[0]?.toUpperCase()||'?'}
          </div>
          <span className="text-xs font-medium text-gray-700">{l.assignedTo?.name||'Unknown'}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (l) => <LeadStatusBadge status={l.status} style={statusStyle(l.status)} label={statusLabel(l.status)} />,
    },
    { key: 'source', label: 'Source', render: (l) => l.source ? <span className="badge bg-gray-100 text-gray-500 border border-gray-300">{l.source}</span> : null },
    { key: 'assignedAt', label: 'Assigned Date', render: (l) => <span className="text-xs text-gray-400">{fmt(l.assignedAt||l.updatedAt)}</span> },
    {
      key: 'actions', label: 'Actions', align: 'right', sortable: false, searchable: false,
      render: (l) => (
        <button
          onClick={()=>openReassign([l])}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
          <AssignIco s={11}/> Reassign
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
              <AssignIco s={16}/>
            </div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Assigned Leads</h2>
          </div>
          <p className="text-sm text-gray-400">Leads that have been assigned to an employee</p>
        </div>
        <div className="page-card px-4 py-2.5">
          <span className="text-lg font-extrabold tabular-nums text-blue-600">{total}</span>
          <span className="text-xs font-medium ml-1.5 text-gray-400">Assigned leads</span>
        </div>
      </motion.div>

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
        <select className="form-input text-xs w-36" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}>
          <option value="">All Status</option>
          {STATUSES.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        {(search||employee||status) && (
          <button className="btn-secondary text-xs py-2 px-3"
            onClick={()=>{setSearch('');setEmployee('');setStatus('');setPage(1);}}>Clear</button>
        )}
      </motion.div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200">
          <span className="text-xs font-semibold text-blue-700">{selected.size} lead{selected.size===1?'':'s'} selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={()=>openReassign(leads.filter((l)=>selected.has(l._id)))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
              <AssignIco s={12}/> Reassign Selected
            </button>
            <button onClick={()=>setSelected(new Set())} className="text-xs text-blue-500 hover:text-blue-700 font-medium">Clear</button>
          </div>
        </motion.div>
      )}

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
          selectable
          selectedIds={selected}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          getRowId={(l)=>l._id}
          emptyTitle="No assigned leads found"
          emptyHint="Try changing your filters."
        />
      </motion.div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-fade-in px-5 py-3 rounded-xl text-sm font-semibold shadow-lg bg-gray-900 text-white min-w-[280px]">
          {toast}
        </div>
      )}

      {/* Reassign modal */}
      {reassign && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/45">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="page-card p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 flex-shrink-0">
                  <AssignIco s={18}/>
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900">Reassign Lead{reassign.leadIds.length===1?'':'s'}</p>
                  <p className="text-xs text-gray-400">{reassign.leadIds.length} selected</p>
                </div>
              </div>
              <button onClick={()=>setReassign(null)} className="text-gray-400 hover:text-gray-600"><XIco/></button>
            </div>

            <div className="mb-4 max-h-24 overflow-y-auto rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
              <p className="text-xs text-gray-500 leading-relaxed">{reassign.leadNames.join(', ')}</p>
            </div>

            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Assign to</label>
            <select className="form-input text-xs w-full mb-5" value={reassign.target}
              onChange={(e)=>setReassign((r)=>({...r, target:e.target.value}))}>
              <option value="">Select employee…</option>
              {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
            </select>

            <div className="flex gap-3">
              <button disabled={busy} onClick={confirmReassign}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-60">
                {busy?'Please wait…':'Reassign'}
              </button>
              <button disabled={busy} onClick={()=>setReassign(null)} className="btn-secondary flex-1 py-2.5">Cancel</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
