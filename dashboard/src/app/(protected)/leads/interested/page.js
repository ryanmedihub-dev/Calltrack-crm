'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '../../../../lib/api';
import { fmtDate } from '../../../../lib/timezone';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const SearchIco = () => <Ico size={13}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>;
const StarIco   = ({s=20}) => <Ico size={s}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Ico>;
const PhoneIco  = ({s=13}) => <Ico size={s}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></Ico>;

const fmt = fmtDate;

export default function InterestedLeadsPage() {
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
        params: { status:'interested', search:search||undefined, assignedTo:employee||undefined, page, limit:PER_PAGE },
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
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background:'rgba(13,148,136,0.10)', color:'#0D9488' }}>
              <StarIco s={16}/>
            </div>
            <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Interested Leads</h2>
          </div>
          <p className="text-sm" style={{ color:'#94A3B8' }}>Leads who have expressed interest — high conversion potential</p>
        </div>
        <div className="page-card px-4 py-2.5 flex items-center gap-3">
          <StarIco s={18}/>
          <div>
            <p className="text-lg font-extrabold tabular-nums" style={{ color:'#0D9488' }}>{total}</p>
            <p className="text-[10px] font-medium" style={{ color:'#94A3B8' }}>Interested leads</p>
          </div>
        </div>
      </div>

      {/* Tip banner */}
      <div className="page-card p-4 flex items-center gap-3" style={{ borderLeft:'3px solid #0D9488', background:'#F0FDFA' }}>
        <StarIco s={18}/>
        <p className="text-xs" style={{ color:'#0D9488' }}>
          These leads have shown interest. <strong>Follow up within 24–48 hours</strong> to maximize conversion. Assign to your best closers.
        </p>
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
          <table className="data-table" style={{ minWidth:620 }}>
            <thead>
              <tr><th>Lead</th><th>Phone</th><th>Assigned To</th><th>Source</th><th>Last Updated</th><th>Added</th></tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:10}).map((_,i)=>(
                  <tr key={i}>{Array.from({length:6}).map((_,j)=><td key={j}><div className="skeleton h-4 rounded"/></td>)}</tr>
                ))
              ) : leads.length===0 ? (
                <tr><td colSpan={6}>
                  <div className="flex flex-col items-center py-16 gap-3">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background:'#F0FDFA', color:'#0D9488' }}>
                      <StarIco s={26}/>
                    </div>
                    <p className="font-semibold text-sm" style={{ color:'#0F172A' }}>No interested leads</p>
                    <p className="text-xs" style={{ color:'#94A3B8' }}>Leads marked as "Interested" will appear here.</p>
                  </div>
                </td></tr>
              ) : leads.map((l,i)=>(
                <tr key={l._id||i}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ background:'linear-gradient(135deg,#0D9488,#14B8A6)' }}>
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
                  <td>{l.source&&<span className="badge" style={{ background:'#F1F5F9', color:'#64748B', border:'1px solid #CBD5E1' }}>{l.source}</span>}</td>
                  <td className="text-xs" style={{ color:'#94A3B8' }}>{fmt(l.updatedAt)}</td>
                  <td className="text-xs" style={{ color:'#94A3B8' }}>{fmt(l.createdAt)}</td>
                </tr>
              ))}
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
