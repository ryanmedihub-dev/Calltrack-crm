'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../lib/api';
import CallTypeBadge from '../../../components/CallTypeBadge';
import Pagination from '../../../components/Pagination';

function formatDuration(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function Ico({ size = 14, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const CloseIco = () => <Ico><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Ico>;
const NoteIco  = () => <Ico><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></Ico>;
const ExportIco= () => <Ico><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Ico>;

const TYPE_COLORS = {
  '':        { active:'#0F172A', bg:'#0F172A', idle:'#64748B', idleBg:'#fff', border:'#E2E8F0' },
  incoming:  { active:'#16A34A', bg:'#22C55E', idle:'#16A34A', idleBg:'rgba(22,163,74,0.06)', border:'rgba(22,163,74,0.25)' },
  outgoing:  { active:'#D97706', bg:'#F59E0B', idle:'#D97706', idleBg:'rgba(217,119,6,0.06)', border:'rgba(217,119,6,0.25)' },
  missed:    { active:'#DC2626', bg:'#EF4444', idle:'#DC2626', idleBg:'rgba(220,38,38,0.06)', border:'rgba(220,38,38,0.25)' },
  rejected:  { active:'#7C3AED', bg:'#8B5CF6', idle:'#7C3AED', idleBg:'rgba(124,58,237,0.06)', border:'rgba(124,58,237,0.25)' },
};

function CreateLeadModal({ call, employees, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: call?.contactName && call.contactName !== 'Unknown' ? call.contactName : '',
    phone: call?.contactNumber || '', email: '', assignedTo: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const res = await api.post('/api/leads/from-call', { ...form, callId: call?._id, source: 'Call' });
      toast.success(res.data.message || 'Lead created');
      onCreated(res.data.data); onClose();
    } catch (err) { setError(err.response?.data?.error || 'Failed to create lead'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 modal-overlay"
      style={{ background:'rgba(0,0,0,0.50)', backdropFilter:'blur(5px)' }}>
      <div className="w-full max-w-md rounded-xl modal-content"
        style={{ background:'#fff', border:'1px solid #E2E8F0', boxShadow:'0 20px 60px rgba(0,0,0,0.18)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:'1px solid #F1F5F9' }}>
          <div>
            <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Create Lead from Call</h3>
            <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>{call?.contactNumber}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ color:'#94A3B8' }}
            onMouseEnter={e=>{e.currentTarget.style.background='#FFF1F2';e.currentTarget.style.color='#EF4444';}}
            onMouseLeave={e=>{e.currentTarget.style.background='';e.currentTarget.style.color='#94A3B8';}}>
            <CloseIco />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          {error && <div className="text-xs rounded-lg px-3 py-2" style={{ background:'#FFF1F2', color:'#DC2626', border:'1px solid #FECACA' }}>{error}</div>}
          {[{k:'name',l:'Full Name',ro:false},{k:'phone',l:'Phone',ro:true},{k:'email',l:'Email',ro:false}].map(({k,l,ro})=>(
            <div key={k}>
              <label className="block text-xs font-medium mb-1" style={{ color:'#475569' }}>{l}</label>
              <input type={k==='email'?'email':'text'} value={form[k]} readOnly={ro}
                onChange={e=>!ro&&setForm({...form,[k]:e.target.value})}
                className="form-input" style={ro?{background:'#F8FAFC',color:'#94A3B8'}:{}} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color:'#475569' }}>Assign To</label>
            <select value={form.assignedTo} onChange={e=>setForm({...form,assignedTo:e.target.value})} className="form-input">
              <option value="">Unassigned</option>
              {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center" style={{ opacity:loading?0.7:1 }}>
              {loading?'Creating…':'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CallLogsPage() {
  const [calls,     setCalls]     = useState([]);
  const [total,     setTotal]     = useState(0);
  const [pages,     setPages]     = useState(1);
  const [page,      setPage]      = useState(1);
  const [employees, setEmployees] = useState([]);
  const [expanded,  setExpanded]  = useState(null);
  const [leadCall,  setLeadCall]  = useState(null);
  const [noteModal, setNoteModal] = useState(null);
  const [noteText,  setNoteText]  = useState('');

  const [filters, setFilters] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return { employeeId: p.get('employeeId')||'', callType: p.get('callType')||'', startDate: p.get('startDate')||today, endDate: p.get('endDate')||today, search: p.get('search')||'' };
    }
    return { employeeId:'', callType:'', startDate: today, endDate: today, search:'' };
  });

  const fetchCalls = async (p = page, f = filters) => {
    try {
      const params = { page:p, limit:20, ...Object.fromEntries(Object.entries(f).filter(([,v])=>v)) };
      const res = await api.get('/api/calls', { params });
      setCalls(res.data.data.calls);
      setTotal(res.data.data.total);
      setPages(res.data.data.pages);
    } catch {}
  };

  useEffect(() => { api.get('/api/employees').then(r=>setEmployees(r.data.data)).catch(()=>{}); }, []);
  useEffect(() => { fetchCalls(); }, [page]);

  const applyFilter = (patch) => {
    const next = { ...filters, ...patch };
    setFilters(next); setPage(1); fetchCalls(1, next);
  };

  const handleExport = async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([,v])=>v));
      const res = await api.get('/api/calls/export', { params, responseType:'blob' });
      const url = URL.createObjectURL(new Blob([res.data],{type:'text/csv'}));
      const a = document.createElement('a'); a.href = url;
      a.download = `calls_${new Date().toISOString().slice(0,10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch { toast.error('Export failed'); }
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()||!noteModal) return;
    try {
      await api.patch(`/api/calls/${noteModal._id}/notes`, { notes:noteText });
      toast.success('Note saved');
      setCalls(prev=>prev.map(c=>c._id===noteModal._id?{...c,notes:noteText}:c));
      setNoteModal(null); setNoteText('');
    } catch { toast.error('Failed to save'); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Call Logs</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>{total.toLocaleString()} total records</p>
        </div>
        <button onClick={handleExport} className="btn-secondary text-xs py-1.5 px-3">
          <ExportIco /> Export CSV
        </button>
      </div>

      {/* Type chips */}
      <div className="flex gap-2 flex-wrap">
        {[{v:'',l:'All Types'},{v:'incoming',l:'Incoming'},{v:'outgoing',l:'Outgoing'},{v:'missed',l:'Missed'},{v:'rejected',l:'Rejected'}].map(({v,l})=>{
          const active = filters.callType === v;
          const c = TYPE_COLORS[v];
          return (
            <button key={v} onClick={()=>applyFilter({callType:v})}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={active
                ? { background:c.bg, color:'#fff', border:`1px solid ${c.bg}` }
                : { background:c.idleBg, color:c.idle, border:`1px solid ${c.border}` }}>
              {l}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="page-card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-44">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color:'#64748B' }}>Search</label>
          <input value={filters.search} placeholder="Number, name, employee…"
            onChange={e=>setFilters({...filters,search:e.target.value})}
            onKeyDown={e=>e.key==='Enter'&&applyFilter({})}
            className="form-input" />
        </div>
        <div className="min-w-40">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color:'#64748B' }}>Employee</label>
          <select value={filters.employeeId} onChange={e=>applyFilter({employeeId:e.target.value})} className="form-input">
            <option value="">All Employees</option>
            {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color:'#64748B' }}>From</label>
          <input type="date" value={filters.startDate} onChange={e=>applyFilter({startDate:e.target.value})} className="form-input" style={{ width:150 }} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color:'#64748B' }}>To</label>
          <input type="date" value={filters.endDate} onChange={e=>applyFilter({endDate:e.target.value})} className="form-input" style={{ width:150 }} />
        </div>
        <div className="flex gap-2 pb-0.5">
          <button onClick={()=>applyFilter({employeeId:'',callType:'',startDate:'',endDate:'',search:''})} className="btn-secondary text-xs py-1.5">Reset</button>
          <button onClick={()=>applyFilter({})} className="btn-primary text-xs py-1.5">Apply</button>
        </div>
      </div>

      {/* Table */}
      <div className="page-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" style={{ minWidth:860 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Employee</th>
                <th>Contact</th>
                <th>Date & Time</th>
                <th>Duration</th>
                <th>Type</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((log,idx)=>(
                <>
                  <tr key={log._id} className="cursor-pointer"
                    onClick={()=>setExpanded(expanded===log._id?null:log._id)}>
                    <td style={{ color:'#CBD5E1' }}>{(page-1)*20+idx+1}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ background:'#2563EB' }}>
                          {(log.employeeName||'?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold" style={{ color:'#0F172A' }}>{log.employeeName}</p>
                          {log.employeePhone&&<p className="text-[11px]" style={{ color:'#94A3B8' }}>{log.employeePhone}</p>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className="text-xs font-medium" style={{ color:'#0F172A' }}>
                        {log.contactName&&log.contactName!=='Unknown'?log.contactName:log.contactNumber}
                      </p>
                      {log.contactName&&log.contactName!=='Unknown'&&<p className="text-[11px]" style={{ color:'#94A3B8' }}>{log.contactNumber}</p>}
                    </td>
                    <td onClick={e=>e.stopPropagation()}>
                      <p className="text-xs font-medium" style={{ color:'#0F172A' }}>
                        {new Date(log.timestamp).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                      </p>
                      <p className="text-[11px]" style={{ color:'#94A3B8' }}>
                        {new Date(log.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                      </p>
                    </td>
                    <td className="font-medium text-xs" style={{ color:'#475569' }}>{formatDuration(log.duration)}</td>
                    <td onClick={e=>e.stopPropagation()}><CallTypeBadge type={log.callType}/></td>
                    <td className="max-w-[120px]" onClick={e=>e.stopPropagation()}>
                      <p className="text-xs truncate" style={{ color:log.notes?'#374151':'#CBD5E1' }}>{log.notes||'—'}</p>
                    </td>
                    <td onClick={e=>e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button onClick={()=>{setNoteModal(log);setNoteText(log.notes||'');}}
                          className="text-xs font-semibold transition-opacity" style={{ color:'#2563EB' }}
                          onMouseEnter={e=>e.currentTarget.style.opacity='0.7'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                          <NoteIco />
                        </button>
                        {!log.leadId ? (
                          <button onClick={()=>setLeadCall(log)}
                            className="text-[11px] font-semibold px-2 py-0.5 rounded transition-colors whitespace-nowrap"
                            style={{ background:'#EFF6FF', color:'#2563EB', border:'1px solid #BFDBFE' }}
                            onMouseEnter={e=>{e.currentTarget.style.background='#2563EB';e.currentTarget.style.color='#fff';}}
                            onMouseLeave={e=>{e.currentTarget.style.background='#EFF6FF';e.currentTarget.style.color='#2563EB';}}>
                            + Lead
                          </button>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded font-medium"
                            style={{ background:'rgba(22,163,74,0.08)', color:'#16A34A', border:'1px solid rgba(22,163,74,0.22)' }}>
                            Linked
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded === log._id && (
                    <tr key={log._id+'_exp'}>
                      <td colSpan={8} className="animate-slide-down" style={{ background:'#F8FAFC', padding:'12px 16px' }}>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          {[{l:'Contact Name',v:log.contactName||'—'},{l:'Full Number',v:log.contactNumber},{l:'Duration',v:formatDuration(log.duration)},{l:'Notes',v:log.notes||'—'}].map(({l,v})=>(
                            <div key={l} className="page-card p-3">
                              <p className="font-semibold mb-1" style={{ color:'#94A3B8' }}>{l}</p>
                              <p style={{ color:'#0F172A' }}>{v}</p>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {calls.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background:'#EFF6FF', color:'#2563EB' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      </div>
                      <p className="text-sm" style={{ color:'#94A3B8' }}>No call logs found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} pages={pages} onPage={setPage} />

      {/* Note modal */}
      {noteModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 modal-overlay"
          style={{ background:'rgba(0,0,0,0.50)', backdropFilter:'blur(5px)' }}>
          <div className="w-full max-w-sm rounded-xl modal-content"
            style={{ background:'#fff', border:'1px solid #E2E8F0', boxShadow:'0 20px 60px rgba(0,0,0,0.18)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:'1px solid #F1F5F9' }}>
              <div>
                <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Add Note</h3>
                <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>{noteModal.contactNumber}</p>
              </div>
              <button onClick={()=>{setNoteModal(null);setNoteText('');}} className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ color:'#94A3B8' }}
                onMouseEnter={e=>{e.currentTarget.style.background='#FFF1F2';e.currentTarget.style.color='#EF4444';}}
                onMouseLeave={e=>{e.currentTarget.style.background='';e.currentTarget.style.color='#94A3B8';}}>
                <CloseIco />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} rows={4}
                placeholder="Enter note…" className="form-input resize-none" />
              <div className="flex gap-2">
                <button onClick={()=>{setNoteModal(null);setNoteText('');}} className="btn-secondary flex-1 justify-center text-xs">Cancel</button>
                <button onClick={handleSaveNote} className="btn-primary flex-1 justify-center text-xs">Save Note</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {leadCall && (
        <CreateLeadModal call={leadCall} employees={employees}
          onClose={()=>setLeadCall(null)}
          onCreated={()=>fetchCalls(page,filters)} />
      )}
    </div>
  );
}
