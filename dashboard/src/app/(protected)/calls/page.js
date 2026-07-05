'use client';
import { useEffect, useState, useRef, Fragment } from 'react';
import toast from 'react-hot-toast';
import api from '../../../lib/api';
import { triggerServerExport } from '../../../lib/downloads';
import CallTypeBadge from '../../../components/CallTypeBadge';
import Pagination from '../../../components/Pagination';
import { parseUTC } from '../../../lib/timezone';

function formatDuration(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function Ico({ size = 14, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const CloseIco   = () => <Ico><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Ico>;
const NoteIco    = () => <Ico><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></Ico>;
const ExportIco  = () => <Ico><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Ico>;
const FilterIco  = () => <Ico><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></Ico>;
const ChevDnIco  = () => <Ico size={12}><polyline points="6 9 12 15 18 9"/></Ico>;
const SearchIco  = () => <Ico><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>;
const CalIco     = () => <Ico><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Ico>;

const CALL_TYPES = [
  { v: 'incoming', l: 'Incoming', color: '#16A34A', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.25)' },
  { v: 'outgoing', l: 'Outgoing', color: '#D97706', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.25)' },
  { v: 'missed',   l: 'Missed',   color: '#DC2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.25)' },
  { v: 'rejected', l: 'Rejected', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.25)' },
];

const DURATION_OPTS = [
  { v: '', l: 'Any Duration' },
  { v: '0-30',   l: '< 30s' },
  { v: '30-120', l: '30s – 2m' },
  { v: '120-300',l: '2m – 5m' },
  { v: '300-',   l: '> 5m' },
];

const DATE_PRESETS = [
  { v: 'today',     l: 'Today' },
  { v: 'yesterday', l: 'Yesterday' },
  { v: 'thisweek',  l: 'This Week' },
  { v: 'thismonth', l: 'This Month' },
  { v: 'custom',    l: 'Custom' },
];

function presetToDates(preset) {
  const now = new Date();
  const d = (date) => date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const inIST = (offsetDays = 0) => {
    const dt = new Date(now);
    dt.setDate(dt.getDate() + offsetDays);
    return d(dt);
  };
  switch (preset) {
    case 'today':     return { startDate: inIST(0), endDate: inIST(0) };
    case 'yesterday': return { startDate: inIST(-1), endDate: inIST(-1) };
    case 'thisweek': {
      const day = now.getDay();
      return { startDate: inIST(-day), endDate: inIST(0) };
    }
    case 'thismonth': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: d(first), endDate: inIST(0) };
    }
    default: return { startDate: '', endDate: '' };
  }
}

/* Multi-select dropdown */
function MultiSelect({ label, options, selected, onChange, placeholder = 'All' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (v) => {
    onChange(selected.includes(v) ? selected.filter(x=>x!==v) : [...selected, v]);
  };

  const label2 = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? options.find(o=>o.value===selected[0])?.label || selected[0]
      : `${selected.length} selected`;

  return (
    <div className="relative" ref={ref}>
      <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color:'#64748B' }}>{label}</label>
      <button type="button" onClick={()=>setOpen(o=>!o)}
        className="form-input flex items-center justify-between gap-2 cursor-pointer text-left"
        style={{ minWidth: 140 }}>
        <span style={{ color: selected.length ? '#0F172A' : '#94A3B8', fontSize: 13 }}>{label2}</span>
        <ChevDnIco />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 rounded-xl py-1 overflow-hidden"
          style={{ background:'#fff', border:'1px solid #E2E8F0', boxShadow:'0 8px 30px rgba(0,0,0,0.12)', minWidth:180 }}>
          {options.map(opt=>(
            <label key={opt.value} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
              style={{ fontSize:13, color:'#374151' }}
              onMouseEnter={e=>e.currentTarget.style.background='#F8FAFC'}
              onMouseLeave={e=>e.currentTarget.style.background=''}>
              <input type="checkbox" checked={selected.includes(opt.value)} onChange={()=>toggle(opt.value)}
                className="rounded" style={{ accentColor:'#2563EB' }} />
              {opt.label}
            </label>
          ))}
          {selected.length > 0 && (
            <div style={{ borderTop:'1px solid #F1F5F9', padding:'8px 16px' }}>
              <button onClick={()=>{ onChange([]); setOpen(false); }}
                className="text-xs font-semibold" style={{ color:'#EF4444' }}>
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [calls,      setCalls]      = useState([]);
  const [total,      setTotal]      = useState(0);
  const [pages,      setPages]      = useState(1);
  const [page,       setPage]       = useState(1);
  const [employees,  setEmployees]  = useState([]);
  const [expanded,   setExpanded]   = useState(null);
  const [leadCall,   setLeadCall]   = useState(null);
  const [noteModal,  setNoteModal]  = useState(null);
  const [noteText,   setNoteText]   = useState('');
  const [showFilter, setShowFilter] = useState(true);

  const today = todayIST();

  const [datePreset,    setDatePreset]    = useState('today');
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedEmps,  setSelectedEmps]  = useState([]);
  const [duration,      setDuration]      = useState('');
  const [search,        setSearch]        = useState('');
  const [customStart,   setCustomStart]   = useState(today);
  const [customEnd,     setCustomEnd]     = useState(today);
  const [tags,          setTags]          = useState('');

  const buildFilters = () => {
    const dates = datePreset === 'custom'
      ? { startDate: customStart, endDate: customEnd }
      : presetToDates(datePreset);

    const params = { ...dates };
    if (search)                  params.search     = search;
    if (selectedTypes.length)    params.callType   = selectedTypes.join(',');
    if (selectedEmps.length)     params.employeeId = selectedEmps.join(',');
    if (tags)                    params.tags       = tags;
    if (duration) {
      const [min, max] = duration.split('-');
      if (min) params.durationMin = min;
      if (max) params.durationMax = max;
    }
    return params;
  };

  const fetchCalls = async (p = page, overrideParams = null) => {
    try {
      const params = { page: p, limit: 20, ...(overrideParams ?? buildFilters()) };
      const res = await api.get('/api/calls', { params });
      setCalls(res.data.data.calls);
      setTotal(res.data.data.total);
      setPages(res.data.data.pages);
    } catch {}
  };

  useEffect(() => { api.get('/api/employees').then(r=>setEmployees(r.data.data)).catch(()=>{}); }, []);
  useEffect(() => { fetchCalls(); }, [page]);

  const applyFilters = () => { setPage(1); fetchCalls(1); };

  const resetFilters = () => {
    setDatePreset('today');
    setSelectedTypes([]);
    setSelectedEmps([]);
    setDuration('');
    setSearch('');
    setCustomStart(today);
    setCustomEnd(today);
    setTags('');
    setPage(1);
    fetchCalls(1, { startDate: today, endDate: today });
  };

  const handleExport = () => triggerServerExport({
    endpoint: '/api/calls/export',
    params: buildFilters(),
    filename: `calls_${today}.csv`,
  });

  const handleSaveNote = async () => {
    if (!noteText.trim()||!noteModal) return;
    try {
      await api.patch(`/api/calls/${noteModal._id}/notes`, { notes:noteText });
      toast.success('Note saved');
      setCalls(prev=>prev.map(c=>c._id===noteModal._id?{...c,notes:noteText}:c));
      setNoteModal(null); setNoteText('');
    } catch { toast.error('Failed to save'); }
  };

  const activeFilterCount = [
    selectedTypes.length > 0,
    selectedEmps.length > 0,
    duration !== '',
    tags !== '',
    datePreset !== 'today',
  ].filter(Boolean).length;

  const empOptions = employees.map(e => ({ value: e._id, label: e.name }));

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Call Logs</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>{total.toLocaleString()} total records</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setShowFilter(f=>!f)}
            className="btn-secondary text-xs py-1.5 px-3 relative">
            <FilterIco />
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                style={{ background:'#2563EB' }}>
                {activeFilterCount}
              </span>
            )}
          </button>
          <button onClick={handleExport} className="btn-secondary text-xs py-1.5 px-3">
            <ExportIco /> Export CSV
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilter && (
        <div className="page-card p-4 space-y-4 animate-slide-down">
          {/* Date preset row */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] mb-2" style={{ color:'#64748B' }}>
              <CalIco /> Date Range
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {DATE_PRESETS.map(p=>(
                <button key={p.v} onClick={()=>setDatePreset(p.v)}
                  className="px-3 h-8 rounded-full text-xs font-semibold transition-all"
                  style={datePreset===p.v
                    ? { background:'#2563EB', color:'#fff', border:'1px solid #2563EB' }
                    : { background:'#fff', color:'#64748B', border:'1px solid #E2E8F0' }}>
                  {p.l}
                </button>
              ))}
              {datePreset === 'custom' && (
                <div className="flex items-center gap-2 ml-2">
                  <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)}
                    className="form-input" style={{ width:140, padding:'6px 10px', fontSize:12 }} />
                  <span className="text-xs" style={{ color:'#94A3B8' }}>to</span>
                  <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)}
                    className="form-input" style={{ width:140, padding:'6px 10px', fontSize:12 }} />
                </div>
              )}
            </div>
          </div>

          {/* Filter controls row */}
          <div className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="flex-1 min-w-44">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color:'#64748B' }}>Search</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'#94A3B8', pointerEvents:'none' }}><SearchIco /></span>
                <input value={search} placeholder="Number, name, employee…"
                  onChange={e=>setSearch(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&applyFilters()}
                  className="form-input" style={{ paddingLeft:34 }} />
              </div>
            </div>

            {/* Call Type multi-select */}
            <MultiSelect
              label="Call Type"
              options={CALL_TYPES.map(t=>({ value:t.v, label:t.l }))}
              selected={selectedTypes}
              onChange={setSelectedTypes}
              placeholder="All Types"
            />

            {/* Agent multi-select */}
            <MultiSelect
              label="Agent"
              options={empOptions}
              selected={selectedEmps}
              onChange={setSelectedEmps}
              placeholder="All Agents"
            />

            {/* Duration */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color:'#64748B' }}>Duration</label>
              <select value={duration} onChange={e=>setDuration(e.target.value)}
                className="form-input" style={{ minWidth:130 }}>
                {DURATION_OPTS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>

            {/* Tags */}
            <div className="min-w-32">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color:'#64748B' }}>Tags</label>
              <input value={tags} placeholder="e.g. hot-lead"
                onChange={e=>setTags(e.target.value)}
                className="form-input" />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pb-0.5">
              <button onClick={resetFilters} className="btn-secondary text-xs py-1.5 px-3">Reset</button>
              <button onClick={applyFilters} className="btn-primary text-xs py-1.5 px-4">Apply</button>
            </div>
          </div>

          {/* Active type chips */}
          {selectedTypes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedTypes.map(t=>{
                const cfg = CALL_TYPES.find(c=>c.v===t);
                return cfg ? (
                  <span key={t} className="flex items-center gap-1.5 px-2.5 h-7 rounded-full text-xs font-semibold"
                    style={{ background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}` }}>
                    {cfg.l}
                    <button onClick={()=>setSelectedTypes(prev=>prev.filter(x=>x!==t))}
                      className="opacity-60 hover:opacity-100 transition-opacity">
                      <CloseIco />
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="page-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" style={{ minWidth:860 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Employee</th>
                <th>Contact</th>
                <th>Date & Time (IST)</th>
                <th>Duration</th>
                <th>Type</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((log,idx)=>(
                <Fragment key={log._id}>
                  <tr className="cursor-pointer"
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
                        {parseUTC(log.timestamp).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Kolkata'})}
                      </p>
                      <p className="text-[11px]" style={{ color:'#94A3B8' }}>
                        {parseUTC(log.timestamp).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'})}
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
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                          {[
                            {l:'Contact Name', v:log.contactName||'—'},
                            {l:'Full Number',  v:log.contactNumber},
                            {l:'Duration',     v:formatDuration(log.duration)},
                            {l:'Call Type',    v:log.callType||'—'},
                            {l:'Notes',        v:log.notes||'—'},
                          ].map(({l,v})=>(
                            <div key={l} className="page-card p-3">
                              <p className="font-semibold mb-1" style={{ color:'#94A3B8' }}>{l}</p>
                              <p className="font-medium" style={{ color:'#0F172A' }}>{v}</p>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {calls.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background:'#EFF6FF', color:'#2563EB' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      </div>
                      <p className="text-sm" style={{ color:'#94A3B8' }}>No call logs found</p>
                      <button onClick={resetFilters} className="text-xs font-semibold" style={{ color:'#2563EB' }}>
                        Clear filters
                      </button>
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
          onCreated={()=>fetchCalls(page)} />
      )}
    </div>
  );
}
