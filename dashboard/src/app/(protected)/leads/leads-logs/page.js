'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import api from '../../../../lib/api';
import { getAllEmployeesSafe } from '../../../../lib/employees';
import { fmtDateTime } from '../../../../lib/timezone';
import { SearchIco, EmptyState, Ico } from '../../../../components/report-shared';
import MultiSelect from '../../../../components/MultiSelect';

const LogIco = ({ s = 20 }) => <Ico size={s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></Ico>;

// Keys must match the real Lead changelog action values (backend/models/Lead.js
// changelogSchema comment: 'created', 'call_linked', 'status_changed',
// 'note_added', 'assigned', 'updated' — there is no 'deleted' entry, since
// deleting a lead removes the whole document rather than logging an action).
const ACTION_META = {
  created:        { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500', label: 'Created' },
  updated:        { bg: 'bg-blue-50',    text: 'text-blue-600',    dot: 'bg-blue-500',    label: 'Updated' },
  assigned:       { bg: 'bg-violet-50',  text: 'text-violet-600',  dot: 'bg-violet-500',  label: 'Assigned' },
  status_changed: { bg: 'bg-amber-50',   text: 'text-amber-600',   dot: 'bg-amber-500',   label: 'Status Changed' },
  call_linked:    { bg: 'bg-teal-50',    text: 'text-teal-600',    dot: 'bg-teal-500',    label: 'Call Linked' },
  note_added:     { bg: 'bg-gray-100',   text: 'text-gray-500',    dot: 'bg-gray-400',    label: 'Note Added' },
};

const fmt = fmtDateTime;

export default function LeadsLogsPage() {
  const [logs,      setLogs]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search,    setSearch]    = useState('');
  const [action,    setAction]    = useState('');
  const [employee,  setEmployee]  = useState('');
  const [employees, setEmployees] = useState([]);
  const [page,      setPage]      = useState(1);
  const [total,     setTotal]     = useState(0);
  const PER_PAGE = 40;

  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const r = await api.get('/api/leads/logs', {
        params: { search:search||undefined, action:action||undefined, employee:employee||undefined, page, limit:PER_PAGE },
      });
      setLogs(r.data?.data?.logs||r.data?.data||[]);
      setTotal(r.data?.data?.total||0);
    } catch {
      // No fabricated fallback data here — a failed fetch surfaces as a real error
      // state instead of silently synthesizing fake "updated" entries from /api/leads.
      setLogs([]); setTotal(0); setLoadError(true);
    }
    setLoading(false);
  }, [search, action, employee, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getAllEmployeesSafe(api).then(setEmployees).catch(()=>{}); }, []);

  const totalPages = Math.ceil(total/PER_PAGE);

  return (
    <div className="space-y-5 animate-fade-in">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="page-title">Leads Logs</h2>
          <p className="page-subtitle">Activity history and audit trail for all lead changes</p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
        className="filter-bar flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><SearchIco/></span>
          <input className="form-input pl-8 text-xs" placeholder="Search by lead name or phone…"
            value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
        </div>
        <MultiSelect className="w-44" ariaLabel="Action" placeholder="All actions" noun="actions"
          value={action} onChange={(v)=>{setAction(v);setPage(1);}} options={Object.entries(ACTION_META).map(([k,v])=>[k, v.label])} />
        <MultiSelect className="w-48" ariaLabel="Employee" placeholder="All employees" noun="employees"
          value={employee} onChange={(v)=>{setEmployee(v);setPage(1);}} options={employees.map((e) => [e._id, e.name])} />
      </motion.div>

      {/* Logs */}
      <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
        className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-200">
          <h3 className="font-bold text-sm text-gray-900">Activity Log</h3>
          <span className="text-xs text-gray-500">{total} entries</span>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({length:8}).map((_,i)=>(
              <div key={i} className="flex gap-3">
                <div className="skeleton w-8 h-8 rounded-full shrink-0"/>
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3.5 w-48 rounded"/>
                  <div className="skeleton h-3 w-64 rounded"/>
                </div>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-red-50 text-red-500">
              <LogIco s={26}/>
            </div>
            <p className="font-semibold text-sm text-gray-900">Couldn&apos;t load activity log — try again</p>
            <p className="text-xs text-gray-500 text-center max-w-xs">The activity log service didn&apos;t respond. Nothing was fabricated in its place.</p>
            <button onClick={load} className="btn-secondary text-xs py-1.5 px-3 mt-1">Retry</button>
          </div>
        ) : logs.length===0 ? (
          <EmptyState title="No activity logs found" hint="Activity will appear here as leads are created and updated." />
        ) : (
          <div className="p-4">
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"/>
              <div className="space-y-0">
                {logs.map((log,i) => {
                  const am  = ACTION_META[log.action]||ACTION_META.updated;
                  return (
                    <motion.div key={log._id||i} initial={false} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i*0.03, 0.3) }}
                      className="relative flex gap-4 pb-3 pl-10">
                      <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center z-10 border-2 border-white top-0.5 ${am.dot}`}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>
                      </div>
                      <div className="flex-1 min-w-0 pb-3 border-b border-line-2">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`badge ${am.bg} ${am.text}`}>{am.label}</span>
                            <span className="font-semibold text-xs text-gray-900">
                              {log.leadName||'Unknown Lead'}
                            </span>
                            {log.leadPhone && (
                              <span className="tabular-nums text-xs text-gray-500">{log.leadPhone}</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 shrink-0">{fmt(log.timestamp)}</span>
                        </div>
                        {log.description && (
                          <p className="text-xs mt-1.5 text-gray-500">{log.description}</p>
                        )}
                        {log.performedBy && (
                          <p className="text-xs mt-1 font-medium text-gray-500">
                            by {log.performedBy}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {totalPages>1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1.5 text-xs rounded-lg font-medium bg-gray-100 text-gray-700 disabled:opacity-40">Prev</button>
              <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1.5 text-xs rounded-lg font-medium bg-gray-100 text-gray-700 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
