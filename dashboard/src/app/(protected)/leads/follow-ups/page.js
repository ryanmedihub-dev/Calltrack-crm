'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '../../../../lib/api';
import { fmtDate } from '../../../../lib/timezone';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const SearchIco  = () => <Ico size={13}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>;
const CalendarIco= ({s=20}) => <Ico size={s}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Ico>;

const fmt = fmtDate;

function dueStatus(ts) {
  if (!ts) return null;
  const diff = Math.floor((new Date(ts)-Date.now())/86400000);
  if (diff < 0)  return { label:'Overdue',  color:'#DC2626', bg:'#FFF1F2', border:'#FECACA' };
  if (diff === 0) return { label:'Due Today', color:'#D97706', bg:'#FFFBEB', border:'#FDE68A' };
  if (diff <= 2) return { label:`In ${diff}d`,color:'#2563EB', bg:'#EFF6FF', border:'#BFDBFE' };
  return { label:`In ${diff}d`, color:'#16A34A', bg:'#F0FDF4', border:'#BBF7D0' };
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
  useEffect(() => { api.get('/api/employees').then(r=>setEmployees(r.data?.data||[])).catch(()=>{}); }, []);

  const totalPages = Math.ceil(total/PER_PAGE);
  const overdue = leads.filter(l => l.followUpDate && new Date(l.followUpDate) < new Date()).length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background:'rgba(217,119,6,0.10)', color:'#D97706' }}>
              <CalendarIco s={16}/>
            </div>
            <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Follow-ups</h2>
          </div>
          <p className="text-sm" style={{ color:'#94A3B8' }}>Leads scheduled for a follow-up call or action</p>
        </div>
        <div className="flex items-center gap-3">
          {overdue > 0 && (
            <div className="page-card px-4 py-2.5 flex items-center gap-2" style={{ borderLeft:'3px solid #DC2626' }}>
              <span className="text-sm font-bold tabular-nums" style={{ color:'#DC2626' }}>{overdue}</span>
              <span className="text-xs font-medium" style={{ color:'#94A3B8' }}>Overdue</span>
            </div>
          )}
          <div className="page-card px-4 py-2.5">
            <span className="text-sm font-bold tabular-nums" style={{ color:'#D97706' }}>{total}</span>
            <span className="text-xs font-medium ml-1.5" style={{ color:'#94A3B8' }}>Total follow-ups</span>
          </div>
        </div>
      </div>

      {overdue > 0 && (
        <div className="page-card p-4 flex items-center gap-3" style={{ borderLeft:'3px solid #DC2626', background:'#FFF1F2' }}>
          <CalendarIco s={18}/>
          <p className="text-xs" style={{ color:'#DC2626' }}>
            <strong>{overdue} follow-up{overdue>1?'s':''}</strong> are overdue. Contact these leads immediately to avoid losing them.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'#94A3B8' }}><SearchIco/></span>
          <input className="form-input pl-8 text-xs" placeholder="Search by name or phone…"
            value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
        </div>
        <select className="form-input text-xs w-44" value={employee} onChange={e=>{setEmployee(e.target.value);setPage(1);}}>
          <option value="">All Employees</option>
          {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
        </select>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={dueSoon} onChange={e=>{setDueSoon(e.target.checked);setPage(1);}} className="w-4 h-4 rounded" style={{ accentColor:'#2563EB' }}/>
          <span className="text-xs font-medium" style={{ color:'#374151' }}>Due within 2 days</span>
        </label>
      </div>

      {/* Table */}
      <div className="page-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" style={{ minWidth:660 }}>
            <thead>
              <tr><th>Lead</th><th>Phone</th><th>Assigned To</th><th>Status</th><th>Follow-up Date</th><th>Due</th></tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:10}).map((_,i)=>(
                  <tr key={i}>{Array.from({length:6}).map((_,j)=><td key={j}><div className="skeleton h-4 rounded"/></td>)}</tr>
                ))
              ) : leads.length===0 ? (
                <tr><td colSpan={6}>
                  <div className="flex flex-col items-center py-16 gap-3">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background:'#FFFBEB', color:'#D97706' }}>
                      <CalendarIco s={26}/>
                    </div>
                    <p className="font-semibold text-sm" style={{ color:'#0F172A' }}>No follow-ups scheduled</p>
                    <p className="text-xs" style={{ color:'#94A3B8' }}>Leads scheduled for follow-up will appear here.</p>
                  </div>
                </td></tr>
              ) : leads.map((l,i) => {
                const due = dueStatus(l.followUpDate);
                const statusMeta = {
                  new:{ bg:'#EFF6FF',color:'#2563EB' }, contacted:{ bg:'#FFFBEB',color:'#D97706' },
                  qualified:{ bg:'#F5F3FF',color:'#7C3AED' }, interested:{ bg:'#F0FDFA',color:'#0D9488' },
                  converted:{ bg:'#F0FDF4',color:'#16A34A' }, lost:{ bg:'#FFF1F2',color:'#DC2626' },
                };
                const sm = statusMeta[l.status]||{ bg:'#F1F5F9', color:'#64748B' };
                return (
                  <tr key={l._id||i}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ background:'#D97706' }}>{(l.name||'?')[0].toUpperCase()}</div>
                        <div>
                          <p className="font-semibold text-xs" style={{ color:'#0F172A' }}>{l.name||'Unknown'}</p>
                          <p className="text-[11px]" style={{ color:'#94A3B8' }}>{l.email||''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs" style={{ color:'#475569' }}>{l.phone||'—'}</td>
                    <td className="text-xs" style={{ color:'#475569' }}>{l.assignedToName||l.assignedTo||'Unassigned'}</td>
                    <td><span className="badge capitalize" style={{ background:sm.bg, color:sm.color }}>{l.status||'—'}</span></td>
                    <td className="text-xs" style={{ color:'#475569' }}>{fmt(l.followUpDate)}</td>
                    <td>
                      {due && <span className="badge" style={{ background:due.bg, color:due.color, border:`1px solid ${due.border}` }}>{due.label}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages>1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop:'1px solid #F1F5F9' }}>
            <span className="text-xs" style={{ color:'#94A3B8' }}>Page {page} of {totalPages} · {total} leads</span>
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
