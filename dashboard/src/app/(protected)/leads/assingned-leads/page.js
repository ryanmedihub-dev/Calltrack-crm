'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '../../../../lib/api';
import { fmtDate } from '../../../../lib/timezone';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const SearchIco = () => <Ico size={13}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>;
const AssignIco = ({s=20}) => <Ico size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></Ico>;

const STATUS_META = {
  new:        { color:'#2563EB', bg:'#EFF6FF' },
  contacted:  { color:'#D97706', bg:'#FFFBEB' },
  qualified:  { color:'#7C3AED', bg:'#F5F3FF' },
  interested: { color:'#0D9488', bg:'#F0FDFA' },
  converted:  { color:'#16A34A', bg:'#F0FDF4' },
  lost:       { color:'#DC2626', bg:'#FFF1F2' },
};

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

  const totalPages = Math.ceil(total/PER_PAGE);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background:'rgba(37,99,235,0.10)', color:'#2563EB' }}>
              <AssignIco s={16}/>
            </div>
            <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Assigned Leads</h2>
          </div>
          <p className="text-sm" style={{ color:'#94A3B8' }}>Leads that have been assigned to an employee</p>
        </div>
        <div className="page-card px-4 py-2.5">
          <span className="text-lg font-extrabold tabular-nums" style={{ color:'#2563EB' }}>{total}</span>
          <span className="text-xs font-medium ml-1.5" style={{ color:'#94A3B8' }}>Assigned leads</span>
        </div>
      </div>

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
        <select className="form-input text-xs w-36" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}>
          <option value="">All Status</option>
          {Object.keys(STATUS_META).map(s=><option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
        </select>
        {(search||employee||status) && (
          <button className="btn-secondary text-xs py-2 px-3"
            onClick={()=>{setSearch('');setEmployee('');setStatus('');setPage(1);}}>Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="page-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" style={{ minWidth:680 }}>
            <thead><tr><th>Lead</th><th>Phone</th><th>Assigned To</th><th>Status</th><th>Source</th><th>Assigned Date</th></tr></thead>
            <tbody>
              {loading ? (
                Array.from({length:10}).map((_,i)=>(
                  <tr key={i}>{Array.from({length:6}).map((_,j)=><td key={j}><div className="skeleton h-4 rounded"/></td>)}</tr>
                ))
              ) : leads.length===0 ? (
                <tr><td colSpan={6}>
                  <div className="flex flex-col items-center py-16 gap-3">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background:'#EFF6FF', color:'#2563EB' }}>
                      <AssignIco s={26}/>
                    </div>
                    <p className="font-semibold text-sm" style={{ color:'#0F172A' }}>No assigned leads found</p>
                    <p className="text-xs" style={{ color:'#94A3B8' }}>Try changing your filters.</p>
                  </div>
                </td></tr>
              ) : leads.map((l,i)=>{
                const sm = STATUS_META[l.status]||{ color:'#64748B', bg:'#F1F5F9' };
                return (
                  <tr key={l._id||i}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ background:'linear-gradient(135deg,#2563EB,#60A5FA)' }}>
                          {(l.name||'?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-xs" style={{ color:'#0F172A' }}>{l.name||'Unknown'}</p>
                          <p className="text-[11px]" style={{ color:'#94A3B8' }}>{l.email||''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs" style={{ color:'#475569' }}>{l.phone||'—'}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                          style={{ background:'#2563EB' }}>
                          {(l.assignedToName||l.assignedTo||'?')[0]?.toUpperCase()||'?'}
                        </div>
                        <span className="text-xs font-medium" style={{ color:'#374151' }}>{l.assignedToName||l.assignedTo||'Unknown'}</span>
                      </div>
                    </td>
                    <td><span className="badge capitalize" style={{ background:sm.bg, color:sm.color }}>{l.status||'—'}</span></td>
                    <td>{l.source&&<span className="badge" style={{ background:'#F1F5F9', color:'#64748B', border:'1px solid #CBD5E1' }}>{l.source}</span>}</td>
                    <td className="text-xs" style={{ color:'#94A3B8' }}>{fmt(l.assignedAt||l.updatedAt)}</td>
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
