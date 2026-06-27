'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../../lib/api';

const COLUMNS = [
  { key:'new',            label:'New',            color:'#64748B', bg:'#F8FAFC' },
  { key:'interested',     label:'Interested',     color:'#16A34A', bg:'#F0FDF4' },
  { key:'callback',       label:'Callback',       color:'#2563EB', bg:'#EFF6FF' },
  { key:'price_enquiry',  label:'Price Enquiry',  color:'#D97706', bg:'#FFFBEB' },
  { key:'converted',      label:'Converted',      color:'#059669', bg:'#D1FAE5' },
  { key:'not_interested', label:'Not Interested', color:'#EF4444', bg:'#FEF2F2' },
];

function LeadCard({ lead, onClick }) {
  return (
    <div onClick={()=>onClick(lead)}
      className="rounded-xl p-3.5 cursor-pointer transition-all group"
      style={{ background:'#fff', border:'1px solid #E2E8F0', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}
      onMouseEnter={e=>{ e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.10)'; e.currentTarget.style.borderColor='rgba(37,99,235,0.35)'; }}
      onMouseLeave={e=>{ e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor='#E2E8F0'; }}>
      <p className="text-sm font-semibold truncate" style={{ color:'#0F172A' }}>{lead.name||'Unknown'}</p>
      <p className="text-xs font-mono mt-0.5" style={{ color:'#94A3B8' }}>{lead.phone}</p>
      {lead.company && <p className="text-xs truncate mt-1" style={{ color:'#475569' }}>{lead.company}</p>}
      {lead.followUpDate && (
        <div className="mt-2 text-[10px] px-2 py-0.5 rounded-lg font-semibold"
          style={{ background:'rgba(217,119,6,0.08)', color:'#92400E', border:'1px solid rgba(217,119,6,0.22)' }}>
          Follow-up {new Date(lead.followUpDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
        </div>
      )}
      {lead.lastCallNote && (
        <p className="text-xs mt-1.5 line-clamp-2 italic" style={{ color:'#94A3B8' }}>&ldquo;{lead.lastCallNote}&rdquo;</p>
      )}
    </div>
  );
}

function LeadModal({ lead, onClose, onUpdate }) {
  const [status, setStatus] = useState(lead.status||'new');
  const [note,   setNote]   = useState(lead.lastCallNote||'');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/api/leads/${lead._id}`, { status, lastCallNote:note });
      toast.success('Lead updated'); onUpdate(); onClose();
    } catch { toast.error('Failed to update lead'); }
    finally  { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background:'rgba(0,0,0,0.50)', backdropFilter:'blur(5px)' }}>
      <div className="w-full max-w-md rounded-xl" style={{ background:'#fff', border:'1px solid #E2E8F0', boxShadow:'0 20px 60px rgba(0,0,0,0.18)' }}>
        <div className="p-5 flex items-start justify-between" style={{ borderBottom:'1px solid #E2E8F0' }}>
          <div>
            <h3 className="font-bold text-lg leading-none" style={{ color:'#0F172A' }}>{lead.name}</h3>
            <p className="text-sm mt-1" style={{ color:'#94A3B8' }}>{lead.phone}{lead.company?` · ${lead.company}`:''}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-lg"
            style={{ color:'#94A3B8' }}
            onMouseEnter={e=>{ e.currentTarget.style.background='#FFF1F2'; e.currentTarget.style.color='#EF4444'; }}
            onMouseLeave={e=>{ e.currentTarget.style.background=''; e.currentTarget.style.color='#94A3B8'; }}>
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'#64748B' }}>Status</label>
            <select value={status} onChange={e=>setStatus(e.target.value)} className="form-input">
              {COLUMNS.map(c=><option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'#64748B' }}>Call Notes</label>
            <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} className="form-input resize-none"/>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm" style={{ color:'#475569' }}>
            {lead.source && <div><span className="font-medium" style={{ color:'#0F172A' }}>Source:</span> {lead.source}</div>}
            {lead.email  && <div><span className="font-medium" style={{ color:'#0F172A' }}>Email:</span> {lead.email}</div>}
            {lead.followUpDate && (
              <div className="col-span-2">
                <span className="font-medium" style={{ color:'#0F172A' }}>Follow-up:</span>{' '}
                {new Date(lead.followUpDate).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 flex gap-3" style={{ borderTop:'1px solid #E2E8F0' }}>
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center" style={{ opacity:saving?0.7:1 }}>
            {saving?'Saving…':'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const [leads,    setLeads]    = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(true);

  const load = async () => {
    try {
      const res = await api.get('/api/leads?limit=500');
      setLeads(res.data.data?.leads||res.data.data||[]);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const grouped = {};
  COLUMNS.forEach(c=>{ grouped[c.key]=[]; });
  leads.forEach(lead=>{
    const s = (lead.status||'new').replace(' ','_').toLowerCase();
    if (grouped[s]) grouped[s].push(lead);
    else grouped['new'].push(lead);
  });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Pipeline</h2>
        <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>
          {leads.length} lead{leads.length!==1?'s':''} across {COLUMNS.length} stages
        </p>
      </div>

      {/* Stage counts */}
      <div className="flex flex-wrap gap-2">
        {COLUMNS.map(col=>(
          <span key={col.key} className="badge text-xs"
            style={{ color:col.color, background:col.bg, border:`1px solid ${col.color}40` }}>
            {col.label}: {(grouped[col.key]||[]).length}
          </span>
        ))}
      </div>

      {/* Board */}
      <div className="overflow-x-auto pb-6">
        <div className="flex gap-4" style={{ minWidth:`${COLUMNS.length*296}px` }}>
          {COLUMNS.map(col=>{
            const colLeads = grouped[col.key]||[];
            return (
              <div key={col.key} className="w-72 flex-shrink-0">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background:col.color }}/>
                    <span className="text-sm font-semibold" style={{ color:'#0F172A' }}>{col.label}</span>
                  </div>
                  <span className="badge text-xs" style={{ background:'#fff', color:'#94A3B8', border:'1px solid #E2E8F0' }}>{colLeads.length}</span>
                </div>
                <div className="rounded-xl p-2.5 space-y-2.5 min-h-[14rem]"
                  style={{ background:col.bg, border:`1.5px solid ${col.color}22` }}>
                  {loading ? (
                    <>{[1,2,3].map(i=><div key={i} className="h-16 rounded-xl animate-pulse" style={{ background:'rgba(255,255,255,0.6)' }}/>)}</>
                  ) : colLeads.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-xs select-none" style={{ color:'#94A3B8' }}>
                      No leads here
                    </div>
                  ) : colLeads.map(lead=>(
                    <LeadCard key={lead._id} lead={lead} onClick={setSelected}/>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <LeadModal lead={selected} onClose={()=>setSelected(null)} onUpdate={()=>{ load(); setSelected(null); }}/>
      )}
    </div>
  );
}
