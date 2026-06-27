'use client';
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../../lib/api';
import Pagination from '../../../components/Pagination';

const STATUSES = ['new','contacted','not_connected','interested','not_interested','follow_up','booking_done','converted','lost'];
const STATUS_LABELS = {
  new:'New', contacted:'Contacted', not_connected:'Not Connected', interested:'Interested',
  not_interested:'Not Interested', follow_up:'Follow Up', booking_done:'Booking Done',
  converted:'Converted', lost:'Lost',
};
const STATUS_STYLE = {
  new:            { background:'#EFF6FF', color:'#2563EB', border:'1px solid #BFDBFE' },
  contacted:      { background:'rgba(124,58,237,0.08)', color:'#7C3AED', border:'1px solid rgba(124,58,237,0.22)' },
  not_connected:  { background:'#F1F5F9', color:'#64748B', border:'1px solid #E2E8F0' },
  interested:     { background:'rgba(217,119,6,0.08)', color:'#D97706', border:'1px solid rgba(217,119,6,0.22)' },
  not_interested: { background:'rgba(220,38,38,0.08)', color:'#DC2626', border:'1px solid rgba(220,38,38,0.22)' },
  follow_up:      { background:'rgba(13,148,136,0.08)', color:'#0D9488', border:'1px solid rgba(13,148,136,0.22)' },
  booking_done:   { background:'rgba(22,163,74,0.08)', color:'#16A34A', border:'1px solid rgba(22,163,74,0.22)' },
  converted:      { background:'rgba(22,163,74,0.12)', color:'#15803D', border:'1px solid rgba(22,163,74,0.35)' },
  lost:           { background:'#F1F5F9', color:'#64748B', border:'1px solid #E2E8F0' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtDur(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec/60), s = sec%60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
function CloseIco() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

function LeadDetailModal({ lead, employees, onClose, onUpdate }) {
  const [form, setForm] = useState({
    name:lead.name, phone:lead.phone, email:lead.email||'',
    company:lead.company||'', address1:lead.address1||'',
    city:lead.city||'', state:lead.state||'', country:lead.country||'',
    status:lead.status, assignedTo:lead.assignedTo?._id||'',
    followUpDate:lead.followUpDate?new Date(lead.followUpDate).toISOString().slice(0,10):'',
    tags:(lead.tags||[]).join(', '), source:lead.source||'',
  });
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, tags:form.tags?form.tags.split(',').map(t=>t.trim()).filter(Boolean):[] };
      await api.put(`/api/leads/${lead._id}`, payload);
      toast.success('Lead updated'); onUpdate(); onClose();
    } catch { toast.error('Failed to update'); }
    finally { setSaving(false); }
  };

  const handleNote = async () => {
    if (!noteText.trim()) return;
    try { await api.post(`/api/leads/${lead._id}/note`, {text:noteText}); toast.success('Note added'); setNoteText(''); onUpdate(); }
    catch { toast.error('Failed to add note'); }
  };

  const fields = [
    {k:'name',l:'Full Name'},{k:'phone',l:'Phone'},{k:'email',l:'Email'},{k:'company',l:'Company'},
    {k:'address1',l:'Address'},{k:'city',l:'City'},{k:'state',l:'State'},{k:'country',l:'Country'},
    {k:'source',l:'Source'},{k:'tags',l:'Tags (comma-separated)'},
  ];

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 modal-overlay"
      style={{ background:'rgba(0,0,0,0.50)', backdropFilter:'blur(5px)' }}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl modal-content"
        style={{ background:'#fff', border:'1px solid #E2E8F0', boxShadow:'0 20px 60px rgba(0,0,0,0.18)' }}>
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom:'1px solid #F1F5F9' }}>
          <div>
            <h3 className="font-bold" style={{ color:'#0F172A' }}>{lead.name}</h3>
            <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>{lead.phone}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ color:'#94A3B8' }}
            onMouseEnter={e=>{e.currentTarget.style.background='#FFF1F2';e.currentTarget.style.color='#EF4444';}}
            onMouseLeave={e=>{e.currentTarget.style.background='';e.currentTarget.style.color='#94A3B8';}}>
            <CloseIco />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {fields.map(({k,l})=>(
              <div key={k}>
                <label className="block text-xs font-medium mb-1" style={{ color:'#475569' }}>{l}</label>
                <input value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} className="form-input" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color:'#475569' }}>Status</label>
              <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="form-input">
                {STATUSES.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color:'#475569' }}>Assign To</label>
              <select value={form.assignedTo} onChange={e=>setForm({...form,assignedTo:e.target.value})} className="form-input">
                <option value="">Unassigned</option>
                {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color:'#475569' }}>Follow-up Date</label>
              <input type="date" value={form.followUpDate} onChange={e=>setForm({...form,followUpDate:e.target.value})} className="form-input" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color:'#475569' }}>Add Note</label>
            <div className="flex gap-2">
              <input value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Add a note…" className="form-input flex-1" />
              <button onClick={handleNote} className="btn-primary text-xs px-3">Add</button>
            </div>
            {(lead.notes||[]).length > 0 && (
              <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
                {lead.notes.slice().reverse().map((n,i)=>(
                  <div key={i} className="rounded-lg px-3 py-2 text-xs" style={{ background:'#F8FAFC', border:'1px solid #E2E8F0' }}>
                    <p style={{ color:'#475569' }}>{n.text}</p>
                    <p className="mt-0.5" style={{ color:'#94A3B8' }}>{new Date(n.addedAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="p-5 flex gap-2 flex-shrink-0" style={{ borderTop:'1px solid #F1F5F9' }}>
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center" style={{ opacity:saving?0.7:1 }}>
            {saving?'Saving…':'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const [leads,        setLeads]        = useState([]);
  const [employees,    setEmployees]    = useState([]);
  const [page,         setPage]         = useState(1);
  const [pages,        setPages]        = useState(1);
  const [total,        setTotal]        = useState(0);
  const [filters,      setFilters]      = useState({ status:'', assignedTo:'', search:'' });
  const [colSearch,    setColSearch]    = useState({ name:'', phone:'', company:'', assignedTo:'' });
  const [selected,     setSelected]     = useState(new Set());
  const [showAdd,      setShowAdd]      = useState(false);
  const [detailLead,   setDetailLead]   = useState(null);
  const [bulkModal,    setBulkModal]    = useState(null);
  const [bulkEmployee, setBulkEmployee] = useState('');
  const [loading,      setLoading]      = useState(false);
  const [form,         setForm]         = useState({ name:'',phone:'',email:'',company:'',source:'',status:'new',assignedTo:'',followUpDate:'',tags:'' });

  const fetchLeads = useCallback(async (p=page, f=filters) => {
    try {
      const params = { page:p, limit:20, ...Object.fromEntries(Object.entries(f).filter(([,v])=>v)) };
      const res = await api.get('/api/leads', { params });
      setLeads(res.data.data.leads);
      setTotal(res.data.data.total);
      setPages(res.data.data.pages);
    } catch {}
  }, [page, filters]);

  useEffect(() => { api.get('/api/employees').then(r=>setEmployees(r.data.data)).catch(()=>{}); }, []);
  useEffect(() => { fetchLeads(page, filters); }, [page]);

  const applyFilters = (f) => { setFilters(f); setPage(1); setSelected(new Set()); fetchLeads(1, f); };
  const toggleSelect  = (id) => { const n=new Set(selected); n.has(id)?n.delete(id):n.add(id); setSelected(n); };
  const toggleAll     = () => setSelected(selected.size===leads.length?new Set():new Set(leads.map(l=>l._id)));

  const handleAddLead = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const payload = { ...form, tags:form.tags?form.tags.split(',').map(t=>t.trim()).filter(Boolean):[] };
      await api.post('/api/leads', payload);
      toast.success('Lead created'); setShowAdd(false);
      setForm({ name:'',phone:'',email:'',company:'',source:'',status:'new',assignedTo:'',followUpDate:'',tags:'' });
      fetchLeads(1, filters);
    } catch (err) { toast.error(err.response?.data?.error||'Failed to create lead'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this lead?')) return;
    try { await api.delete(`/api/leads/${id}`); toast.success('Lead deleted'); fetchLeads(page, filters); }
    catch { toast.error('Failed to delete'); }
  };

  const handleBulkAction = async () => {
    if (!selected.size) return;
    const ids = [...selected];
    try {
      if (bulkModal==='assign'||bulkModal==='transfer') {
        await api.post(`/api/leads/bulk-${bulkModal==='assign'?'assign':'transfer'}`, { leadIds:ids, employeeId:bulkEmployee, toEmployeeId:bulkEmployee });
        toast.success(`${ids.length} leads ${bulkModal}ed`);
      } else if (bulkModal==='delete') {
        if (!confirm(`Delete ${ids.length} leads?`)) return;
        await api.delete('/api/leads/bulk-delete', { data:{leadIds:ids} });
        toast.success(`${ids.length} leads deleted`);
      }
      setBulkModal(null); setBulkEmployee(''); setSelected(new Set()); fetchLeads(page, filters);
    } catch (err) { toast.error(err.response?.data?.error||'Bulk action failed'); }
  };

  const handleStatusChange = async (id, status) => {
    try { await api.put(`/api/leads/${id}`, {status}); setLeads(prev=>prev.map(l=>l._id===id?{...l,status}:l)); }
    catch { toast.error('Failed to update status'); }
  };

  const filteredLeads = leads.filter(l=>{
    const q = s=>(s||'').toLowerCase();
    if (colSearch.name       && !q(l.name).includes(q(colSearch.name)))               return false;
    if (colSearch.phone      && !q(l.phone).includes(q(colSearch.phone)))             return false;
    if (colSearch.company    && !q(l.company).includes(q(colSearch.company)))         return false;
    if (colSearch.assignedTo && !q(l.assignedTo?.name).includes(q(colSearch.assignedTo))) return false;
    return true;
  });

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Leads</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>{total.toLocaleString()} total leads</p>
        </div>
        <button onClick={()=>setShowAdd(true)} className="btn-primary">+ Add Lead</button>
      </div>

      {/* Status chips */}
      <div className="flex gap-2 flex-wrap">
        {['', ...STATUSES].map(s=>{
          const active = filters.status === s;
          return (
            <button key={s} onClick={()=>applyFilters({...filters,status:s})}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={active
                ? { background:'#0F172A', color:'#fff', border:'1px solid #0F172A' }
                : { background:'#fff', color:'#64748B', border:'1px solid #E2E8F0' }}>
              {s===''?`All (${total})`:STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="page-card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color:'#64748B' }}>Search</label>
          <input value={filters.search} placeholder="Name, phone, company…"
            onChange={e=>setFilters({...filters,search:e.target.value})}
            onKeyDown={e=>e.key==='Enter'&&applyFilters(filters)}
            className="form-input" />
        </div>
        <div className="min-w-40">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color:'#64748B' }}>Assigned To</label>
          <select value={filters.assignedTo} onChange={e=>applyFilters({...filters,assignedTo:e.target.value})} className="form-input">
            <option value="">All Employees</option>
            {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2 pb-0.5">
          <button onClick={()=>applyFilters({status:'',assignedTo:'',search:''})} className="btn-secondary text-xs py-1.5">Reset</button>
          <button onClick={()=>applyFilters(filters)} className="btn-primary text-xs py-1.5">Apply</button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap animate-slide-down"
          style={{ background:'#EFF6FF', border:'1px solid #BFDBFE' }}>
          <span className="text-sm font-semibold" style={{ color:'#2563EB' }}>{selected.size} selected</span>
          <div className="flex gap-2 ml-auto flex-wrap">
            {[
              {a:'assign',l:'Assign',c:'#2563EB'},
              {a:'transfer',l:'Transfer',c:'#D97706'},
              {a:'delete',l:'Delete',c:'#DC2626'},
            ].map(({a,l,c})=>(
              <button key={a} onClick={()=>setBulkModal(a)}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors"
                style={{ border:`1px solid ${c}`, color:c, background:'transparent' }}
                onMouseEnter={e=>{e.currentTarget.style.background=c;e.currentTarget.style.color='#fff';}}
                onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color=c;}}>
                {l}
              </button>
            ))}
            <button onClick={()=>setSelected(new Set())} className="text-xs transition-colors" style={{ color:'#94A3B8' }}
              onMouseEnter={e=>e.currentTarget.style.color='#DC2626'} onMouseLeave={e=>e.currentTarget.style.color='#94A3B8'}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="page-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" style={{ minWidth:960 }}>
            <thead>
              <tr>
                <th style={{ width:36 }}>
                  <input type="checkbox" checked={selected.size===leads.length&&leads.length>0} onChange={toggleAll}
                    style={{ accentColor:'#2563EB' }} />
                </th>
                {['Created','Lead','Contact','Attempts','Tags','Assigned To','Status','Last Call','Duration','Note','Company','Follow-up','Actions'].map(h=>(
                  <th key={h}>{h}</th>
                ))}
              </tr>
              {/* Column search row */}
              <tr style={{ background:'#F8FAFC' }}>
                <td style={{ padding:'0 0 8px 16px' }} />
                <td style={{ padding:'0 0 8px 14px' }} />
                {/* Lead name search */}
                <td style={{ padding:'0 14px 8px' }}>
                  <input value={colSearch.name} placeholder="Search…" onChange={e=>setColSearch(s=>({...s,name:e.target.value}))}
                    className="form-input" style={{ padding:'4px 8px', fontSize:11, height:'auto' }} />
                </td>
                {/* Phone search */}
                <td style={{ padding:'0 14px 8px' }}>
                  <input value={colSearch.phone} placeholder="Search…" onChange={e=>setColSearch(s=>({...s,phone:e.target.value}))}
                    className="form-input" style={{ padding:'4px 8px', fontSize:11, height:'auto' }} />
                </td>
                <td style={{ padding:'0 0 8px' }} /><td style={{ padding:'0 0 8px' }} />
                {/* Assigned to search */}
                <td style={{ padding:'0 14px 8px' }}>
                  <input value={colSearch.assignedTo} placeholder="Search…" onChange={e=>setColSearch(s=>({...s,assignedTo:e.target.value}))}
                    className="form-input" style={{ padding:'4px 8px', fontSize:11, height:'auto' }} />
                </td>
                <td style={{ padding:'0 0 8px' }} /><td style={{ padding:'0 0 8px' }} /><td style={{ padding:'0 0 8px' }} />
                {/* Company search */}
                <td style={{ padding:'0 14px 8px' }}>
                  <input value={colSearch.company} placeholder="Search…" onChange={e=>setColSearch(s=>({...s,company:e.target.value}))}
                    className="form-input" style={{ padding:'4px 8px', fontSize:11, height:'auto' }} />
                </td>
                <td style={{ padding:'0 0 8px' }} /><td style={{ padding:'0 0 8px' }} />
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map(lead=>(
                <tr key={lead._id} className="transition-colors"
                  onMouseEnter={e=>e.currentTarget.style.background='#F8FAFC'}
                  onMouseLeave={e=>e.currentTarget.style.background=''}>
                  <td style={{ padding:'10px 16px' }}>
                    <input type="checkbox" checked={selected.has(lead._id)} onChange={()=>toggleSelect(lead._id)} style={{ accentColor:'#2563EB' }} />
                  </td>
                  <td className="text-xs whitespace-nowrap" style={{ color:'#94A3B8', padding:'10px 14px' }}>{fmtDate(lead.createdAt)}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <button onClick={()=>setDetailLead(lead)} className="flex items-center gap-2 text-left">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ background:'#2563EB' }}>
                        {lead.name[0]?.toUpperCase()}
                      </div>
                      <span className="text-xs font-semibold transition-colors" style={{ color:'#0F172A' }}
                        onMouseEnter={e=>e.currentTarget.style.color='#2563EB'}
                        onMouseLeave={e=>e.currentTarget.style.color='#0F172A'}>
                        {lead.name}
                      </span>
                    </button>
                  </td>
                  <td className="text-xs font-medium" style={{ color:'#2563EB', padding:'10px 14px' }}>{lead.phone}</td>
                  <td style={{ padding:'10px 14px', textAlign:'center' }}>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:'#EFF6FF', color:'#2563EB' }}>{lead.attempts||0}</span>
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    {(lead.tags||[]).length>0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {lead.tags.slice(0,2).map(t=>(
                          <span key={t} className="text-[11px] px-1.5 py-0.5 rounded-full"
                            style={{ background:'rgba(124,58,237,0.08)', color:'#7C3AED', border:'1px solid rgba(124,58,237,0.22)' }}>
                            {t}
                          </span>
                        ))}
                        {lead.tags.length>2&&<span className="text-[11px]" style={{ color:'#94A3B8' }}>+{lead.tags.length-2}</span>}
                      </div>
                    ) : <span className="text-xs" style={{ color:'#CBD5E1' }}>—</span>}
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    {lead.assignedTo ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ background:'#2563EB' }}>
                          {lead.assignedTo.name[0]?.toUpperCase()}
                        </div>
                        <span className="text-xs truncate max-w-[90px]" style={{ color:'#475569' }}>{lead.assignedTo.name}</span>
                      </div>
                    ) : <span className="text-xs" style={{ color:'#CBD5E1' }}>Unassigned</span>}
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <select value={lead.status} onChange={e=>handleStatusChange(lead._id,e.target.value)}
                      className="text-[11px] rounded-full px-2 py-0.5 font-semibold focus:outline-none cursor-pointer"
                      style={STATUS_STYLE[lead.status]||STATUS_STYLE.lost}>
                      {STATUSES.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </td>
                  <td className="text-xs whitespace-nowrap" style={{ color:'#475569', padding:'10px 14px' }}>{lead.lastCallAt?fmtDate(lead.lastCallAt):'—'}</td>
                  <td className="text-xs font-medium" style={{ color:'#475569', padding:'10px 14px' }}>{fmtDur(lead.lastCallDuration)}</td>
                  <td className="max-w-[110px]" style={{ padding:'10px 14px' }}>
                    <p className="text-xs truncate" style={{ color:lead.lastCallNote||(lead.notes?.length>0)?'#374151':'#CBD5E1' }}>
                      {lead.lastCallNote||lead.notes?.[lead.notes.length-1]?.text||'—'}
                    </p>
                  </td>
                  <td className="text-xs" style={{ color:'#475569', padding:'10px 14px' }}>{lead.company||'—'}</td>
                  <td style={{ padding:'10px 14px' }}>
                    {lead.followUpDate ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                        style={{ background:'rgba(217,119,6,0.08)', color:'#D97706', border:'1px solid rgba(217,119,6,0.22)' }}>
                        {fmtDate(lead.followUpDate)}
                      </span>
                    ) : <span className="text-xs" style={{ color:'#CBD5E1' }}>—</span>}
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <div className="flex items-center gap-2">
                      <button onClick={()=>setDetailLead(lead)} className="text-xs font-semibold transition-opacity" style={{ color:'#2563EB' }}
                        onMouseEnter={e=>e.currentTarget.style.opacity='0.7'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>Edit</button>
                      <button onClick={()=>handleDelete(lead._id)} className="text-xs font-semibold transition-opacity" style={{ color:'#EF4444' }}
                        onMouseEnter={e=>e.currentTarget.style.opacity='0.7'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
              {leads.length===0&&(
                <tr><td colSpan={14} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background:'#EFF6FF', color:'#2563EB' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></svg>
                    </div>
                    <p className="text-sm" style={{ color:'#94A3B8' }}>No leads found</p>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} pages={pages} onPage={setPage} />

      {/* Add Lead Modal */}
      {showAdd && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 modal-overlay"
          style={{ background:'rgba(0,0,0,0.50)', backdropFilter:'blur(5px)' }}>
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl modal-content"
            style={{ background:'#fff', border:'1px solid #E2E8F0', boxShadow:'0 20px 60px rgba(0,0,0,0.18)' }}>
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom:'1px solid #F1F5F9' }}>
              <div>
                <h3 className="font-bold" style={{ color:'#0F172A' }}>Add New Lead</h3>
                <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>Fill in contact details</p>
              </div>
              <button onClick={()=>setShowAdd(false)} className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ color:'#94A3B8' }}
                onMouseEnter={e=>{e.currentTarget.style.background='#FFF1F2';e.currentTarget.style.color='#EF4444';}}
                onMouseLeave={e=>{e.currentTarget.style.background='';e.currentTarget.style.color='#94A3B8';}}>
                <CloseIco />
              </button>
            </div>
            <form onSubmit={handleAddLead} className="p-5 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                {[{k:'name',l:'Full Name',req:true},{k:'phone',l:'Phone',req:true},{k:'email',l:'Email'},{k:'company',l:'Company'},{k:'source',l:'Source'},{k:'tags',l:'Tags (comma-separated)'}].map(({k,l,req})=>(
                  <div key={k}>
                    <label className="block text-xs font-medium mb-1" style={{ color:'#475569' }}>{l}</label>
                    <input type="text" required={!!req} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} className="form-input" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color:'#475569' }}>Status</label>
                  <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="form-input">
                    {STATUSES.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color:'#475569' }}>Assign To</label>
                  <select value={form.assignedTo} onChange={e=>setForm({...form,assignedTo:e.target.value})} className="form-input">
                    <option value="">Unassigned</option>
                    {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color:'#475569' }}>Follow-up Date</label>
                  <input type="date" value={form.followUpDate} onChange={e=>setForm({...form,followUpDate:e.target.value})} className="form-input" />
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={()=>setShowAdd(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center" style={{ opacity:loading?0.7:1 }}>
                  {loading?'Creating…':'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk assign/transfer modal */}
      {(bulkModal==='assign'||bulkModal==='transfer') && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 modal-overlay"
          style={{ background:'rgba(0,0,0,0.50)', backdropFilter:'blur(5px)' }}>
          <div className="w-full max-w-sm rounded-xl modal-content"
            style={{ background:'#fff', border:'1px solid #E2E8F0', boxShadow:'0 20px 60px rgba(0,0,0,0.18)' }}>
            <div className="px-5 py-4" style={{ borderBottom:'1px solid #F1F5F9' }}>
              <h3 className="font-bold capitalize" style={{ color:'#0F172A' }}>{bulkModal} {selected.size} Leads</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color:'#475569' }}>Select Employee</label>
                <select value={bulkEmployee} onChange={e=>setBulkEmployee(e.target.value)} className="form-input">
                  <option value="">— Select —</option>
                  {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>{setBulkModal(null);setBulkEmployee('');}} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button onClick={handleBulkAction} disabled={!bulkEmployee} className="btn-primary flex-1 justify-center" style={{ opacity:bulkEmployee?1:0.4 }}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailLead && (
        <LeadDetailModal lead={detailLead} employees={employees}
          onClose={()=>setDetailLead(null)}
          onUpdate={()=>{ fetchLeads(page,filters); setDetailLead(null); }} />
      )}
    </div>
  );
}
