'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '../../../../lib/api';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const SearchIco  = () => <Ico size={13}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>;
const ClockIco   = ({s=20}) => <Ico size={s}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Ico>;
const PhoneIco   = ({s=13}) => <Ico size={s}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></Ico>;

function fmt(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const diff = Math.floor((Date.now()-d)/86400000);
  if (diff===0) return 'Today';
  if (diff===1) return 'Yesterday';
  return `${diff} days ago`;
}

export default function UnattemptedLeadsPage() {
  const [leads,     setLeads]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [employee,  setEmployee]  = useState('');
  const [employees, setEmployees] = useState([]);
  const [page,      setPage]      = useState(1);
  const [total,     setTotal]     = useState(0);
  const PER_PAGE = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/leads', {
        params: { unattempted:true, search:search||undefined, assignedTo:employee||undefined, page, limit:PER_PAGE },
      });
      setLeads(r.data?.data?.leads||r.data?.data||[]);
      setTotal(r.data?.data?.total||0);
    } catch { setLeads([]); }
    setLoading(false);
  }, [search, employee, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/api/employees').then(r=>setEmployees(r.data?.data||[])).catch(()=>{}); }, []);

  const totalPages = Math.ceil(total/PER_PAGE);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background:'rgba(220,38,38,0.10)', color:'#DC2626' }}>
              <ClockIco s={16}/>
            </div>
            <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Unattempted Leads</h2>
          </div>
          <p className="text-sm" style={{ color:'#94A3B8' }}>Leads that have never received a call attempt</p>
        </div>
        <div className="page-card px-4 py-2.5 flex items-center gap-3">
          <ClockIco s={18}/>
          <div>
            <p className="text-lg font-extrabold tabular-nums" style={{ color:'#DC2626' }}>{total}</p>
            <p className="text-[10px] font-medium" style={{ color:'#94A3B8' }}>Awaiting contact</p>
          </div>
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
      </div>

      {/* Table */}
      <div className="page-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" style={{ minWidth:600 }}>
            <thead><tr><th>Lead</th><th>Phone</th><th>Assigned To</th><th>Source</th><th>Added</th><th>Priority</th></tr></thead>
            <tbody>
              {loading ? (
                Array.from({length:10}).map((_,i)=>(
                  <tr key={i}>{Array.from({length:6}).map((_,j)=><td key={j}><div className="skeleton h-4 rounded"/></td>)}</tr>
                ))
              ) : leads.length===0 ? (
                <tr><td colSpan={6}>
                  <div className="flex flex-col items-center py-16 gap-3">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background:'#F0FDF4', color:'#16A34A' }}>
                      <ClockIco s={26}/>
                    </div>
                    <p className="font-semibold text-sm" style={{ color:'#0F172A' }}>All leads have been attempted!</p>
                    <p className="text-xs" style={{ color:'#94A3B8' }}>No unattempted leads match your filters.</p>
                  </div>
                </td></tr>
              ) : leads.map((l,i) => {
                const daysOld = l.createdAt ? Math.floor((Date.now()-new Date(l.createdAt))/86400000) : 0;
                const priority = daysOld>7 ? { label:'High', color:'#DC2626', bg:'#FFF1F2', border:'#FECACA' }
                               : daysOld>3 ? { label:'Medium', color:'#D97706', bg:'#FFFBEB', border:'#FDE68A' }
                               :              { label:'Low', color:'#16A34A', bg:'#F0FDF4', border:'#BBF7D0' };
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
                    <td className="text-xs" style={{ color:'#475569' }}>{l.assignedToName||l.assignedTo||'Unassigned'}</td>
                    <td>
                      {l.source && <span className="badge" style={{ background:'#F1F5F9', color:'#64748B', border:'1px solid #CBD5E1' }}>{l.source}</span>}
                    </td>
                    <td className="text-xs" style={{ color:'#94A3B8' }}>{fmt(l.createdAt)}</td>
                    <td>
                      <span className="badge" style={{ background:priority.bg, color:priority.color, border:`1px solid ${priority.border}` }}>
                        {priority.label}
                      </span>
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
              <button disabled={page===1} onClick={()=>setPage(p=>p-1)}
                className="px-3 py-1.5 text-xs rounded-lg font-medium disabled:opacity-40" style={{ background:'#F1F5F9', color:'#374151' }}>Prev</button>
              <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}
                className="px-3 py-1.5 text-xs rounded-lg font-medium disabled:opacity-40" style={{ background:'#F1F5F9', color:'#374151' }}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
