'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '../../../../lib/api';
import { fmtDateTime } from '../../../../lib/timezone';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const SearchIco = () => <Ico size={13}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>;
const LogIco    = ({s=20}) => <Ico size={s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></Ico>;

const ACTION_META = {
  created:    { color:'#16A34A', bg:'#F0FDF4', label:'Created'     },
  updated:    { color:'#2563EB', bg:'#EFF6FF', label:'Updated'     },
  assigned:   { color:'#7C3AED', bg:'#F5F3FF', label:'Assigned'    },
  status_change:{ color:'#D97706', bg:'#FFFBEB', label:'Status Changed'},
  call_made:  { color:'#0D9488', bg:'#F0FDFA', label:'Call Made'   },
  deleted:    { color:'#DC2626', bg:'#FFF1F2', label:'Deleted'     },
  note_added: { color:'#64748B', bg:'#F1F5F9', label:'Note Added'  },
};

const fmt = fmtDateTime;

export default function LeadsLogsPage() {
  const [logs,      setLogs]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [action,    setAction]    = useState('');
  const [employee,  setEmployee]  = useState('');
  const [employees, setEmployees] = useState([]);
  const [page,      setPage]      = useState(1);
  const [total,     setTotal]     = useState(0);
  const PER_PAGE = 40;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/leads/logs', {
        params: { search:search||undefined, action:action||undefined, employee:employee||undefined, page, limit:PER_PAGE },
      });
      setLogs(r.data?.data?.logs||r.data?.data||[]);
      setTotal(r.data?.data?.total||0);
    } catch {
      // Fallback: fetch leads as activity proxy
      try {
        const r2 = await api.get('/api/leads', { params:{ page, limit:PER_PAGE } });
        const items = r2.data?.data?.leads||r2.data?.data||[];
        setLogs(items.map(l=>({
          _id: l._id, leadName:l.name, leadPhone:l.phone, action:'updated',
          performedBy:l.assignedToName||'System', timestamp:l.updatedAt||l.createdAt,
          description:`Lead status: ${l.status||'—'}`,
        })));
        setTotal(r2.data?.data?.total||0);
      } catch { setLogs([]); }
    }
    setLoading(false);
  }, [search, action, employee, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/api/employees').then(r=>setEmployees(r.data?.data||[])).catch(()=>{}); }, []);

  const totalPages = Math.ceil(total/PER_PAGE);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background:'rgba(100,116,139,0.10)', color:'#64748B' }}>
              <LogIco s={16}/>
            </div>
            <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Leads Logs</h2>
          </div>
          <p className="text-sm" style={{ color:'#94A3B8' }}>Activity history and audit trail for all lead changes</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'#94A3B8' }}><SearchIco/></span>
          <input className="form-input pl-8 text-xs" placeholder="Search by lead name or phone…"
            value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
        </div>
        <select className="form-input text-xs w-40" value={action} onChange={e=>{setAction(e.target.value);setPage(1);}}>
          <option value="">All Actions</option>
          {Object.entries(ACTION_META).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="form-input text-xs w-44" value={employee} onChange={e=>{setEmployee(e.target.value);setPage(1);}}>
          <option value="">All Employees</option>
          {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
        </select>
      </div>

      {/* Logs */}
      <div className="page-card overflow-hidden">
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom:'1px solid #E2E8F0' }}>
          <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Activity Log</h3>
          <span className="text-xs" style={{ color:'#94A3B8' }}>{total} entries</span>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({length:8}).map((_,i)=>(
              <div key={i} className="flex gap-3">
                <div className="skeleton w-8 h-8 rounded-full flex-shrink-0"/>
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3.5 w-48 rounded"/>
                  <div className="skeleton h-3 w-64 rounded"/>
                </div>
              </div>
            ))}
          </div>
        ) : logs.length===0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background:'#F1F5F9', color:'#94A3B8' }}>
              <LogIco s={26}/>
            </div>
            <p className="font-semibold text-sm" style={{ color:'#0F172A' }}>No activity logs found</p>
            <p className="text-xs" style={{ color:'#94A3B8' }}>Activity will appear here as leads are created and updated.</p>
          </div>
        ) : (
          <div className="p-4">
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5" style={{ background:'#E2E8F0' }}/>
              <div className="space-y-0">
                {logs.map((log,i) => {
                  const am  = ACTION_META[log.action]||ACTION_META.updated;
                  return (
                    <div key={log._id||i} className="relative flex gap-4 pb-4 pl-10">
                      <div className="absolute left-2 w-5 h-5 rounded-full flex items-center justify-center z-10 border-2 border-white"
                        style={{ background:am.color, top:'2px' }}>
                        <span style={{ color:'#fff', fontSize:'8px', fontWeight:800 }}>✓</span>
                      </div>
                      <div className="flex-1 page-card p-3 transition-all"
                        onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.06)';}}
                        onMouseLeave={e=>{e.currentTarget.style.boxShadow='';}}>
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="badge" style={{ background:am.bg, color:am.color }}>{am.label}</span>
                            <span className="font-semibold text-xs" style={{ color:'#0F172A' }}>
                              {log.leadName||'Unknown Lead'}
                            </span>
                            {log.leadPhone && (
                              <span className="font-mono text-[11px]" style={{ color:'#94A3B8' }}>{log.leadPhone}</span>
                            )}
                          </div>
                          <span className="text-[11px] flex-shrink-0" style={{ color:'#94A3B8' }}>{fmt(log.timestamp)}</span>
                        </div>
                        {log.description && (
                          <p className="text-xs mt-1.5" style={{ color:'#64748B' }}>{log.description}</p>
                        )}
                        {log.performedBy && (
                          <p className="text-[11px] mt-1 font-medium" style={{ color:'#94A3B8' }}>
                            by {log.performedBy}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {totalPages>1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop:'1px solid #F1F5F9' }}>
            <span className="text-xs" style={{ color:'#94A3B8' }}>Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1.5 text-xs rounded-lg font-medium disabled:opacity-40" style={{ background:'#F1F5F9', color:'#374151' }}>Prev</button>
              <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1.5 text-xs rounded-lg font-medium disabled:opacity-40" style={{ background:'#F1F5F9', color:'#374151' }}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
