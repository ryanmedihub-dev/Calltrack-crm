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

function Svg({ children, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const ExportIco  = () => <Svg><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Svg>;
const FilterIco  = () => <Svg><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></Svg>;
const CloseIco   = () => <Svg size={14}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Svg>;
const ChevronIco = () => <Svg size={13}><polyline points="9 18 15 12 9 6"/></Svg>;
const NoteIco    = () => <Svg><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></Svg>;

const TYPE_FILTERS = [
  { value: '',         label: 'All Types' },
  { value: 'incoming', label: 'Incoming' },
  { value: 'outgoing', label: 'Outgoing' },
  { value: 'missed',   label: 'Missed' },
  { value: 'rejected', label: 'Rejected' },
];

const TYPE_CHIP = {
  '':        { active: { background: '#0F172A', color: '#fff' },        idle: { background: '#fff', color: '#475569', border: '1px solid #E2E8F4' } },
  incoming:  { active: { background: '#10B981', color: '#fff' },        idle: { background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.22)' } },
  outgoing:  { active: { background: '#F59E0B', color: '#fff' },        idle: { background: 'rgba(245,158,11,0.08)', color: '#D97706', border: '1px solid rgba(245,158,11,0.22)' } },
  missed:    { active: { background: '#EF4444', color: '#fff' },        idle: { background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.22)' } },
  rejected:  { active: { background: '#8B5CF6', color: '#fff' },        idle: { background: 'rgba(139,92,246,0.08)', color: '#7C3AED', border: '1px solid rgba(139,92,246,0.22)' } },
};

const inputStyle = {
  background: '#F8FAFF',
  border: '1px solid #E2E8F4',
  color: '#0F172A',
  outline: 'none',
  fontSize: '13px',
  borderRadius: '10px',
  padding: '8px 12px',
};

function CreateLeadModal({ call, employees, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: call?.contactName && call.contactName !== 'Unknown' ? call.contactName : '',
    phone: call?.contactNumber || '', email: '', source: 'Call', assignedTo: '', status: 'new',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const res = await api.post('/api/leads/from-call', { ...form, callId: call?._id });
      toast.success(res.data.message || 'Lead created');
      onCreated(res.data.data); onClose();
    } catch (err) { setError(err.response?.data?.error || 'Failed to create lead'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 modal-overlay"
      style={{ background: 'rgba(12,10,30,0.55)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-md rounded-2xl modal-content"
        style={{ background: '#fff', border: '1px solid #E2E8F4', boxShadow: '0 25px 80px rgba(0,0,0,0.18), 0 8px 32px rgba(99,102,241,0.10)' }}>
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <h3 className="font-bold text-sm" style={{ color: '#0F172A' }}>Create Lead from Call</h3>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{call?.contactNumber} · {call?.callType}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
            style={{ color: '#94A3B8' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FFF1F2'; e.currentTarget.style.color = '#EF4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#94A3B8'; }}>
            <CloseIco />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {error && <div className="text-xs rounded-xl px-3 py-2.5" style={{ background: '#FFF1F2', color: '#EF4444', border: '1px solid #FECACA' }}>{error}</div>}
          {[{k:'name',l:'Full Name',t:'text',req:true,ro:false},{k:'phone',l:'Phone',t:'text',req:true,ro:true},{k:'email',l:'Email',t:'email',req:false,ro:false}].map(({k,l,t,req,ro})=>(
            <div key={k}>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>{l}</label>
              <input type={t} value={form[k]} required={req} readOnly={ro}
                onChange={e=>!ro&&setForm({...form,[k]:e.target.value})}
                className="w-full transition-all input-ring"
                style={{ ...inputStyle, color: ro ? '#94A3B8' : '#0F172A' }} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Assign To</label>
            <select value={form.assignedTo} onChange={e=>setForm({...form,assignedTo:e.target.value})}
              className="w-full transition-all input-ring" style={inputStyle}>
              <option value="">Unassigned</option>
              {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ border: '1px solid #E2E8F4', color: '#64748B' }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor='#FECACA'; e.currentTarget.style.color='#EF4444'; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor='#E2E8F4'; e.currentTarget.style.color='#64748B'; }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Creating…' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CallLogsPage() {
  const [calls,          setCalls]          = useState([]);
  const [total,          setTotal]          = useState(0);
  const [pages,          setPages]          = useState(1);
  const [page,           setPage]           = useState(1);
  const [employees,      setEmployees]      = useState([]);
  const [expanded,       setExpanded]       = useState(null);
  const [createLeadCall, setCreateLeadCall] = useState(null);
  const [noteModal,      setNoteModal]      = useState(null);
  const [noteText,       setNoteText]       = useState('');

  const [filters, setFilters] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return {
        employeeId: p.get('employeeId') || '',
        callType:   p.get('callType')   || '',
        startDate:  p.get('startDate')  || today,
        endDate:    p.get('endDate')    || today,
        search:     p.get('search')     || '',
      };
    }
    return { employeeId: '', callType: '', startDate: today, endDate: today, search: '' };
  });

  const fetchCalls = async (p = page, f = filters) => {
    try {
      const params = { page: p, limit: 20, ...Object.fromEntries(Object.entries(f).filter(([,v])=>v)) };
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
      const res = await api.get('/api/calls/export', { params, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a'); a.href = url;
      a.download = `calls_${new Date().toISOString().slice(0,10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch { toast.error('Export failed'); }
  };

  const handleSaveNote = async () => {
    if (!noteText.trim() || !noteModal) return;
    try {
      await api.patch(`/api/calls/${noteModal._id}/notes`, { notes: noteText });
      toast.success('Note saved');
      setCalls(prev => prev.map(c => c._id === noteModal._id ? { ...c, notes: noteText } : c));
      setNoteModal(null); setNoteText('');
    } catch { toast.error('Failed to save note'); }
  };

  const activeFilterChips = [
    filters.callType   && { key:'callType',   label:`Type: ${filters.callType}`,                           clear:{callType:''} },
    filters.search     && { key:'search',     label:`"${filters.search}"`,                                 clear:{search:''} },
    filters.employeeId && { key:'employeeId', label:`${employees.find(e=>e._id===filters.employeeId)?.name||'Employee'}`, clear:{employeeId:''} },
    filters.startDate  && { key:'startDate',  label:`From ${filters.startDate}`,                           clear:{startDate:''} },
    filters.endDate    && { key:'endDate',    label:`To ${filters.endDate}`,                               clear:{endDate:''} },
  ].filter(Boolean);

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold leading-none" style={{ color: '#0F172A', letterSpacing: '-0.02em' }}>Call Logs</h2>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>{total.toLocaleString()} total records</p>
        </div>
        <button onClick={handleExport}
          className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl transition-all"
          style={{ background: '#fff', border: '1px solid #E2E8F4', color: '#475569', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(99,102,241,0.4)';e.currentTarget.style.color='#6366F1';}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='#E2E8F4';e.currentTarget.style.color='#475569';}}>
          <ExportIco /> Export CSV
        </button>
      </div>

      {/* ── Type chips ── */}
      <div className="flex gap-2 flex-wrap">
        {TYPE_FILTERS.map(({ value, label }) => {
          const active = filters.callType === value;
          const c = TYPE_CHIP[value];
          return (
            <button key={value} onClick={() => applyFilter({ callType: value })}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={active ? c.active : c.idle}>
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Filters bar ── */}
      <div className="rounded-2xl p-4 flex flex-wrap gap-3 items-end animate-fade-in"
        style={{ background: '#fff', border: '1px solid #E2E8F4', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex-1 min-w-44">
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Search</label>
          <input value={filters.search} placeholder="Number, name, employee…"
            onChange={e=>setFilters({...filters,search:e.target.value})}
            onKeyDown={e=>e.key==='Enter'&&applyFilter({})}
            className="w-full transition-all input-ring" style={inputStyle} />
        </div>
        <div className="min-w-40">
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Employee</label>
          <select value={filters.employeeId} onChange={e=>applyFilter({employeeId:e.target.value})}
            className="w-full transition-all input-ring" style={inputStyle}>
            <option value="">All Employees</option>
            {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>From</label>
          <input type="date" value={filters.startDate} onChange={e=>applyFilter({startDate:e.target.value})}
            className="transition-all input-ring" style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>To</label>
          <input type="date" value={filters.endDate} onChange={e=>applyFilter({endDate:e.target.value})}
            className="transition-all input-ring" style={inputStyle} />
        </div>
        <div className="flex gap-2">
          <button onClick={()=>applyFilter({employeeId:'',callType:'',startDate:'',endDate:'',search:''})}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ border:'1px solid #E2E8F4', color:'#64748B' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='#FECACA';e.currentTarget.style.color='#EF4444';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='#E2E8F4';e.currentTarget.style.color='#64748B';}}>
            Reset
          </button>
          <button onClick={()=>applyFilter({})}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background:'linear-gradient(135deg,#6366F1,#8B5CF6)', boxShadow:'0 4px 12px rgba(99,102,241,0.30)' }}>
            <FilterIco />
          </button>
        </div>
      </div>

      {/* ── Active filter chips ── */}
      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center animate-slide-down">
          <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>Filters:</span>
          {activeFilterChips.map(chip => (
            <span key={chip.key} className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: '#EEF2FF', color: '#6366F1', border: '1px solid #C7D2FE' }}>
              {chip.label}
              <button onClick={()=>applyFilter(chip.clear)} className="transition-colors leading-none"
                onMouseEnter={e=>e.currentTarget.style.color='#EF4444'}
                onMouseLeave={e=>e.currentTarget.style.color='#6366F1'}>
                <CloseIco />
              </button>
            </span>
          ))}
          <button onClick={()=>applyFilter({employeeId:'',callType:'',startDate:'',endDate:'',search:''})}
            className="text-xs font-medium transition-colors"
            style={{ color: '#94A3B8' }}
            onMouseEnter={e=>e.currentTarget.style.color='#EF4444'}
            onMouseLeave={e=>e.currentTarget.style.color='#94A3B8'}>
            Clear all
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: '#fff', border: '1px solid #E2E8F4', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFF' }}>
                {['#', 'Employee', 'Contact', 'Date & Time', 'Duration', 'Type', 'Notes', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: '#94A3B8' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calls.map((log, idx) => (
                <tr key={log._id} style={{ borderBottom: '1px solid #F8FAFF' }}
                  className="table-row-hover transition-colors cursor-pointer"
                  onClick={() => setExpanded(expanded === log._id ? null : log._id)}>
                  <td className="px-5 py-3.5 text-xs font-medium" style={{ color: '#CBD5E1' }}>
                    {(page - 1) * 20 + idx + 1}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                        {(log.employeeName || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: '#0F172A' }}>{log.employeeName}</p>
                        {log.employeePhone && <p className="text-xs" style={{ color: '#94A3B8' }}>{log.employeePhone}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-xs font-semibold" style={{ color: '#0F172A' }}>
                      {log.contactName && log.contactName !== 'Unknown' ? log.contactName : log.contactNumber}
                    </p>
                    {log.contactName && log.contactName !== 'Unknown' && (
                      <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{log.contactNumber}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap" onClick={e=>e.stopPropagation()}>
                    <p className="text-xs font-medium" style={{ color: '#0F172A' }}>
                      {new Date(log.timestamp).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                      {new Date(log.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-xs font-semibold whitespace-nowrap" style={{ color: '#475569' }}>
                    {formatDuration(log.duration)}
                  </td>
                  <td className="px-5 py-3.5" onClick={e=>e.stopPropagation()}>
                    <CallTypeBadge type={log.callType} />
                  </td>
                  <td className="px-5 py-3.5 max-w-[120px]" onClick={e=>e.stopPropagation()}>
                    <p className="text-xs truncate" style={{ color: log.notes ? '#475569' : '#CBD5E1' }}>
                      {log.notes || '—'}
                    </p>
                  </td>
                  <td className="px-5 py-3.5" onClick={e=>e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <button onClick={()=>{ setNoteModal(log); setNoteText(log.notes||''); }}
                        className="flex items-center gap-1 text-xs font-semibold transition-colors"
                        style={{ color: '#6366F1' }}
                        onMouseEnter={e=>e.currentTarget.style.opacity='0.7'}
                        onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                        <NoteIco />
                      </button>
                      {!log.leadId ? (
                        <button onClick={()=>setCreateLeadCall(log)}
                          className="text-xs px-2 py-1 rounded-lg font-semibold transition-all whitespace-nowrap"
                          style={{ background: '#EEF2FF', color: '#6366F1', border: '1px solid #C7D2FE' }}
                          onMouseEnter={e=>{e.currentTarget.style.background='#6366F1';e.currentTarget.style.color='#fff';e.currentTarget.style.borderColor='#6366F1';}}
                          onMouseLeave={e=>{e.currentTarget.style.background='#EEF2FF';e.currentTarget.style.color='#6366F1';e.currentTarget.style.borderColor='#C7D2FE';}}>
                          + Lead
                        </button>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-lg font-medium"
                          style={{ background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.22)' }}>
                          Linked
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {/* Expanded detail row */}
              {calls.map(log => expanded === log._id && (
                <tr key={log._id + '_exp'}>
                  <td colSpan={8} className="px-5 py-3.5 animate-slide-down" style={{ background: '#F8FAFF', borderBottom: '1px solid #F1F5F9' }}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      {[
                        { label: 'Contact Name', value: log.contactName || '—' },
                        { label: 'Full Number',  value: log.contactNumber },
                        { label: 'Duration',     value: formatDuration(log.duration) },
                        { label: 'Notes',        value: log.notes || '—' },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-xl p-3" style={{ background: '#fff', border: '1px solid #E2E8F4' }}>
                          <p className="font-semibold mb-1" style={{ color: '#94A3B8' }}>{label}</p>
                          <p style={{ color: '#0F172A' }}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}

              {calls.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#EEF2FF', color: '#818CF8' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                      </div>
                      <p className="text-sm font-medium" style={{ color: '#94A3B8' }}>No call logs found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} pages={pages} onPage={setPage} />

      {/* ── Add Note Modal ── */}
      {noteModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 modal-overlay"
          style={{ background: 'rgba(12,10,30,0.55)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm rounded-2xl modal-content"
            style={{ background: '#fff', border: '1px solid #E2E8F4', boxShadow: '0 25px 80px rgba(0,0,0,0.18)' }}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <div>
                <h3 className="font-bold text-sm" style={{ color: '#0F172A' }}>Add Note</h3>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{noteModal.contactNumber} · {noteModal.callType}</p>
              </div>
              <button onClick={()=>{setNoteModal(null);setNoteText('');}}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                style={{ color: '#94A3B8' }}
                onMouseEnter={e=>{e.currentTarget.style.background='#FFF1F2';e.currentTarget.style.color='#EF4444';}}
                onMouseLeave={e=>{e.currentTarget.style.background='';e.currentTarget.style.color='#94A3B8';}}>
                <CloseIco />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} rows={4}
                placeholder="Enter note…"
                className="w-full resize-none transition-all input-ring"
                style={{ ...inputStyle, padding: '12px 14px' }} />
              <div className="flex gap-3">
                <button onClick={()=>{setNoteModal(null);setNoteText('');}}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={{ border:'1px solid #E2E8F4', color:'#64748B' }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='#FECACA';e.currentTarget.style.color='#EF4444';}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='#E2E8F4';e.currentTarget.style.color='#64748B';}}>
                  Cancel
                </button>
                <button onClick={handleSaveNote}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background:'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {createLeadCall && (
        <CreateLeadModal call={createLeadCall} employees={employees}
          onClose={()=>setCreateLeadCall(null)}
          onCreated={()=>fetchCalls(page,filters)} />
      )}
    </div>
  );
}
