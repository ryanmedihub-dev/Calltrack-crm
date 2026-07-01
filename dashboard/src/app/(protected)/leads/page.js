'use client';
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../../lib/api';
import Pagination from '../../../components/Pagination';
import { parseUTC } from '../../../lib/timezone';

const VALID_STATUSES = new Set(['new','contacted','not_connected','interested','not_interested','follow_up','booking_done','converted','lost']);
const STATUS_ALIASES = {
  'new':'new','fresh':'new','lead':'new',
  'contacted':'contacted','called':'contacted','reached':'contacted',
  'not connected':'not_connected','not_connected':'not_connected','no answer':'not_connected','busy':'not_connected',
  'interested':'interested','warm':'interested',
  'not interested':'not_interested','not_interested':'not_interested','cold':'not_interested',
  'follow up':'follow_up','follow_up':'follow_up','callback':'follow_up','follow-up':'follow_up',
  'booking done':'booking_done','booking_done':'booking_done','booked':'booking_done',
  'converted':'converted','closed':'converted','won':'converted',
  'lost':'lost','dead':'lost','rejected':'lost',
};

function parseCSV(raw) {
  const lines = raw.trim().split('\n').map(l=>l.trim()).filter(Boolean);
  if (lines.length < 2) return { rows:[], errors:['Need at least a header row and one data row'] };
  const header = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/[^a-z0-9_]/g,''));
  const nameIdx  = header.findIndex(h=>['name','fullname','full_name','contact','contactname'].includes(h));
  const phoneIdx = header.findIndex(h=>['phone','mobile','number','phonenumber','contact_number','mobilenumber'].includes(h));
  const statusIdx= header.findIndex(h=>['status','leadstatus','stage'].includes(h));
  if (nameIdx===-1||phoneIdx===-1) return { rows:[], errors:['Could not find "Name" and "Phone" columns — check your CSV header.'] };
  const rows=[], errors=[];
  for (let i=1;i<lines.length;i++) {
    const cols = lines[i].split(',').map(c=>c.trim().replace(/^"|"$/g,''));
    const name  = cols[nameIdx]||'';
    const phone = (cols[phoneIdx]||'').replace(/\D/g,'');
    let   status = 'new';
    if (!name)          { errors.push(`Row ${i+1}: missing name`); continue; }
    if (phone.length<7) { errors.push(`Row ${i+1}: invalid phone "${cols[phoneIdx]}"`); continue; }
    if (statusIdx!==-1&&cols[statusIdx]) {
      const r = cols[statusIdx].trim().toLowerCase();
      status = STATUS_ALIASES[r]||(VALID_STATUSES.has(r)?r:'new');
    }
    rows.push({ name, phone, status });
  }
  return { rows, errors };
}

function ImportModal({ onClose, onDone }) {
  const [step, setStep] = useState(1);
  const [csvText, setCsvText] = useState('');
  const [parsed, setParsed] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const handleParse = () => {
    const { rows, errors } = parseCSV(csvText);
    setParsed(rows); setParseErrors(errors);
    if (rows.length > 0) setStep(2);
  };

  const handleUpload = async () => {
    setUploading(true);
    try {
      const res = await api.post('/api/leads/bulk-upload', { leads: parsed });
      setResult(res.data); setStep(3);
    } catch (e) { toast.error(e?.response?.data?.error||'Upload failed'); }
    finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background:'rgba(0,0,0,0.50)', backdropFilter:'blur(5px)' }}>
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl"
        style={{ background:'#fff', border:'1px solid #E2E8F0', boxShadow:'0 20px 60px rgba(0,0,0,0.18)' }}>
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom:'1px solid #F1F5F9' }}>
          <div>
            <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Import Leads via CSV</h3>
            <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>Paste CSV data with Name, Phone, Status columns</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color:'#94A3B8' }}
            onMouseEnter={e=>{e.currentTarget.style.background='#FFF1F2';e.currentTarget.style.color='#EF4444';}}
            onMouseLeave={e=>{e.currentTarget.style.background='';e.currentTarget.style.color='#94A3B8';}}>
            <CloseIco />
          </button>
        </div>

        <div className="flex items-center gap-0 px-5 py-3 flex-shrink-0" style={{ borderBottom:'1px solid #F1F5F9' }}>
          {[{n:1,l:'Paste CSV'},{n:2,l:'Preview'},{n:3,l:'Done'}].map((s,i,arr)=>(
            <div key={s.n} className="flex items-center gap-0 flex-1">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background:step>s.n?'#16A34A':step===s.n?'#2563EB':'#E2E8F0', color:step>=s.n?'#fff':'#94A3B8' }}>
                  {step>s.n?'✓':s.n}
                </div>
                <span className="text-xs font-semibold whitespace-nowrap" style={{ color:step===s.n?'#2563EB':'#94A3B8' }}>{s.l}</span>
              </div>
              {i<arr.length-1&&<div className="flex-1 h-px mx-2" style={{ background:'#E2E8F0' }}/>}
            </div>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {step===1 && (
            <div className="space-y-4">
              <div className="rounded-xl p-4 text-sm space-y-1" style={{ background:'#EFF6FF', border:'1px solid #BFDBFE' }}>
                <p className="font-semibold text-xs" style={{ color:'#1D4ED8' }}>How to upload</p>
                <p className="text-xs" style={{ color:'#1E40AF' }}>1. Open your Excel / Google Sheet</p>
                <p className="text-xs" style={{ color:'#1E40AF' }}>2. Ensure columns: <b>Name, Phone, Status</b> (Status optional)</p>
                <p className="text-xs" style={{ color:'#1E40AF' }}>3. Select all rows → Copy → Paste below</p>
              </div>
              <div className="rounded-xl p-3" style={{ background:'#F8FAFC', border:'1px solid #E2E8F0' }}>
                <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color:'#94A3B8' }}>Example format</p>
                <pre className="text-xs font-mono" style={{ color:'#475569' }}>{`Name,Phone,Status\nRahul Sharma,9876543210,interested\nPriya Singh,8765432109,new`}</pre>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color:'#64748B' }}>Paste CSV data</label>
                <textarea value={csvText} onChange={e=>setCsvText(e.target.value)} rows={8}
                  placeholder={'Name,Phone,Status\nRahul Sharma,9876543210,new\n…'}
                  className="form-input resize-none font-mono text-xs leading-relaxed"/>
              </div>
              {parseErrors.length>0&&(
                <div className="rounded-xl p-3 text-xs space-y-1" style={{ background:'#FFF1F2', border:'1px solid #FECACA' }}>
                  {parseErrors.map((e,i)=><p key={i} style={{ color:'#DC2626' }}>⚠ {e}</p>)}
                </div>
              )}
              <button onClick={handleParse} disabled={!csvText.trim()} className="btn-primary w-full justify-center" style={{ opacity:!csvText.trim()?0.45:1 }}>
                Parse &amp; Preview →
              </button>
            </div>
          )}

          {step===2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background:'#D1FAE5', color:'#059669', border:'1px solid #6EE7B7' }}>{parsed.length} leads ready</span>
                {parseErrors.length>0&&<span className="text-xs font-semibold" style={{ color:'#D97706' }}>{parseErrors.length} rows skipped</span>}
              </div>
              {parseErrors.length>0&&(
                <div className="rounded-xl p-3 text-xs space-y-1" style={{ background:'#FFFBEB', border:'1px solid #FDE68A' }}>
                  {parseErrors.map((e,i)=><p key={i} style={{ color:'#92400E' }}>⚠ {e}</p>)}
                </div>
              )}
              <div className="rounded-xl overflow-hidden" style={{ border:'1px solid #E2E8F0' }}>
                <table className="w-full text-xs">
                  <thead><tr style={{ background:'#F8FAFC' }}>
                    <th className="text-left px-3 py-2 font-bold uppercase tracking-wide text-[10px]" style={{ color:'#94A3B8' }}>Name</th>
                    <th className="text-left px-3 py-2 font-bold uppercase tracking-wide text-[10px]" style={{ color:'#94A3B8' }}>Phone</th>
                    <th className="text-left px-3 py-2 font-bold uppercase tracking-wide text-[10px]" style={{ color:'#94A3B8' }}>Status</th>
                  </tr></thead>
                  <tbody>
                    {parsed.slice(0,20).map((r,i)=>(
                      <tr key={i} style={{ borderTop:'1px solid #F1F5F9', background:i%2===1?'#F8FAFC':'' }}>
                        <td className="px-3 py-2 font-medium truncate max-w-[160px]" style={{ color:'#0F172A' }}>{r.name}</td>
                        <td className="px-3 py-2" style={{ color:'#475569' }}>{r.phone}</td>
                        <td className="px-3 py-2 font-semibold" style={{ color:'#2563EB' }}>{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.length>20&&<p className="text-xs text-center py-2" style={{ color:'#94A3B8' }}>…and {parsed.length-20} more rows</p>}
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setStep(1)} className="btn-secondary flex-1 justify-center">← Back</button>
                <button onClick={handleUpload} disabled={uploading} className="btn-primary flex-[2] justify-center" style={{ opacity:uploading?0.7:1 }}>
                  {uploading?'Uploading…':`Upload ${parsed.length} Leads ✓`}
                </button>
              </div>
            </div>
          )}

          {step===3&&result&&(
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ background:'#D1FAE5' }}>🎉</div>
              <p className="text-lg font-bold" style={{ color:'#0F172A' }}>Upload Complete!</p>
              <div className="flex gap-4">
                {[
                  {v:result.inserted??result.data?.inserted??0,l:'Inserted',c:'#059669',bg:'#D1FAE5'},
                  {v:result.skipped??result.data?.skipped??0,l:'Skipped',c:'#D97706',bg:'#FEF3C7'},
                  {v:result.errors??result.data?.errors??0,l:'Errors',c:'#DC2626',bg:'#FEE2E2'},
                ].map(({v,l,c,bg})=>(
                  <div key={l} className="flex flex-col items-center rounded-xl px-6 py-4 gap-1" style={{ background:bg }}>
                    <span className="text-3xl font-black" style={{ color:c }}>{v}</span>
                    <span className="text-xs font-bold" style={{ color:c }}>{l}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs" style={{ color:'#94A3B8' }}>Skipped = duplicates already in the system</p>
              <button onClick={onDone} className="btn-primary px-8 justify-center">View Leads →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

const CHANGELOG_ICONS = {
  created:        '✨',
  call_linked:    '📞',
  status_changed: '🔄',
  note_added:     '📝',
  assigned:       '👤',
  updated:        '✏️',
};

function fmtDate(d) {
  if (!d) return '—';
  return parseUTC(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', timeZone:'Asia/Kolkata' });
}
function fmtDateTime(d) {
  if (!d) return '—';
  return parseUTC(d).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'Asia/Kolkata' });
}
function fmtDur(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec/60), s = sec%60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
function CloseIco() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

function LeadDetailModal({ lead: initialLead, employees, onClose, onUpdate }) {
  const [lead, setLead] = useState(initialLead);
  const [activeTab, setActiveTab] = useState('info');
  const [form, setForm] = useState({
    name:lead.name, phone:lead.phone, email:lead.email||'',
    status:lead.status, assignedTo:lead.assignedTo?._id||'',
    followUpDate:lead.followUpDate?new Date(lead.followUpDate).toISOString().slice(0,10):'',
    tags:(lead.tags||[]).join(', '), source:lead.source||'',
  });
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [calls, setCalls] = useState([]);
  const [changelog, setChangelog] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    setLoadingDetail(true);
    api.get(`/api/leads/${lead._id}`)
      .then(r => {
        setCalls(r.data.data.calls || []);
        setChangelog((r.data.data.lead.changelog || []).slice().reverse());
        setLead(r.data.data.lead);
      })
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  }, [lead._id]);

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
    try {
      await api.post(`/api/leads/${lead._id}/note`, {text:noteText});
      toast.success('Note added');
      setNoteText('');
      // Refresh changelog
      const r = await api.get(`/api/leads/${lead._id}`);
      setChangelog((r.data.data.lead.changelog || []).slice().reverse());
    } catch { toast.error('Failed to add note'); }
  };

  const callTypeColor = { incoming:'#16A34A', outgoing:'#D97706', missed:'#DC2626', rejected:'#7C3AED' };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 modal-overlay"
      style={{ background:'rgba(0,0,0,0.50)', backdropFilter:'blur(5px)' }}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl modal-content"
        style={{ background:'#fff', border:'1px solid #E2E8F0', boxShadow:'0 20px 60px rgba(0,0,0,0.18)' }}>

        {/* Header */}
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

        {/* Tabs */}
        <div className="flex gap-0 px-5 flex-shrink-0" style={{ borderBottom:'1px solid #F1F5F9' }}>
          {[['info','Info'],['calls','Call Logs'],['activity','Activity']].map(([k,l])=>(
            <button key={k} onClick={()=>setActiveTab(k)}
              className="px-4 py-3 text-xs font-semibold transition-colors"
              style={{ borderBottom: activeTab===k?'2px solid #2563EB':'2px solid transparent', color:activeTab===k?'#2563EB':'#64748B' }}>
              {l}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ── INFO TAB ── */}
          {activeTab==='info' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[{k:'name',l:'Full Name'},{k:'phone',l:'Phone'},{k:'email',l:'Email'},{k:'source',l:'Source'},{k:'tags',l:'Tags (comma-separated)'}].map(({k,l})=>(
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

              {/* Add Note */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color:'#475569' }}>Add Note</label>
                <div className="flex gap-2">
                  <input value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Add a note…" className="form-input flex-1"
                    onKeyDown={e=>e.key==='Enter'&&handleNote()} />
                  <button onClick={handleNote} className="btn-primary text-xs px-3">Add</button>
                </div>
              </div>
            </>
          )}

          {/* ── CALL LOGS TAB ── */}
          {activeTab==='calls' && (
            <div className="space-y-2">
              {loadingDetail && <p className="text-xs text-center py-4" style={{ color:'#94A3B8' }}>Loading…</p>}
              {!loadingDetail && calls.length === 0 && (
                <p className="text-xs text-center py-8" style={{ color:'#94A3B8' }}>No call logs yet</p>
              )}
              {calls.map((c, i) => (
                <div key={c._id || i} className="rounded-xl px-4 py-3 flex items-start gap-3"
                  style={{ background:'#F8FAFC', border:'1px solid #E2E8F0' }}>
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: callTypeColor[c.callType] || '#94A3B8' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold capitalize" style={{ color: callTypeColor[c.callType] || '#64748B' }}>{c.callType}</span>
                      {c.duration>0 && <span className="text-xs font-medium" style={{ color:'#475569' }}>{fmtDur(c.duration)}</span>}
                      {c.callStatus && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background:'rgba(37,99,235,0.08)', color:'#2563EB', border:'1px solid rgba(37,99,235,0.2)' }}>
                          {c.callStatus}
                        </span>
                      )}
                    </div>
                    {c.notes && <p className="text-xs mt-0.5 italic" style={{ color:'#64748B' }}>{c.notes}</p>}
                    <p className="text-[11px] mt-1" style={{ color:'#94A3B8' }}>
                      {c.employeeName || 'Unknown'} · {fmtDateTime(c.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── ACTIVITY / CHANGELOG TAB ── */}
          {activeTab==='activity' && (
            <div className="space-y-2">
              {loadingDetail && <p className="text-xs text-center py-4" style={{ color:'#94A3B8' }}>Loading…</p>}
              {!loadingDetail && changelog.length === 0 && (
                <p className="text-xs text-center py-8" style={{ color:'#94A3B8' }}>No activity yet</p>
              )}
              {changelog.map((entry, i) => (
                <div key={entry._id || i} className="rounded-xl px-4 py-3 flex items-start gap-3"
                  style={{ background:'#F8FAFC', border:'1px solid #E2E8F0' }}>
                  <span className="text-base flex-shrink-0 mt-0.5">{CHANGELOG_ICONS[entry.action] || '•'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold capitalize" style={{ color:'#0F172A' }}>
                      {entry.action?.replace(/_/g,' ')}
                    </p>
                    {entry.details?.text && (
                      <p className="text-xs mt-0.5 italic" style={{ color:'#64748B' }}>"{entry.details.text}"</p>
                    )}
                    {entry.details?.from && (
                      <p className="text-xs mt-0.5" style={{ color:'#64748B' }}>
                        {STATUS_LABELS[entry.details.from] || entry.details.from} → {STATUS_LABELS[entry.details.to] || entry.details.to}
                      </p>
                    )}
                    {entry.details?.callType && !entry.details?.text && !entry.details?.from && (
                      <p className="text-xs mt-0.5" style={{ color:'#64748B' }}>
                        {entry.details.callType} · {fmtDur(entry.details.duration)}
                      </p>
                    )}
                    <p className="text-[11px] mt-0.5" style={{ color:'#94A3B8' }}>
                      {entry.changedByName || 'System'} · {fmtDateTime(entry.changedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 flex gap-2 flex-shrink-0" style={{ borderTop:'1px solid #F1F5F9' }}>
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          {activeTab==='info' && (
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center" style={{ opacity:saving?0.7:1 }}>
              {saving?'Saving…':'Save Changes'}
            </button>
          )}
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
  const [colSearch,    setColSearch]    = useState({ name:'', phone:'', assignedTo:'' });
  const [selected,     setSelected]     = useState(new Set());
  const [showAdd,      setShowAdd]      = useState(false);
  const [showImport,   setShowImport]   = useState(false);
  const [detailLead,   setDetailLead]   = useState(null);
  const [bulkModal,    setBulkModal]    = useState(null);
  const [bulkEmployee, setBulkEmployee] = useState('');
  const [loading,      setLoading]      = useState(false);
  const [form,         setForm]         = useState({ name:'',phone:'',email:'',source:'',status:'new',assignedTo:'',followUpDate:'',tags:'' });

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
      setForm({ name:'',phone:'',email:'',source:'',status:'new',assignedTo:'',followUpDate:'',tags:'' });
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
        <div className="flex gap-2">
          <button onClick={()=>setShowImport(true)} className="btn-secondary">⬆ Import CSV</button>
          <button onClick={()=>setShowAdd(true)} className="btn-primary">+ Add Lead</button>
        </div>
      </div>

      {/* Status chips */}
      <div className="flex gap-2 flex-wrap">
        {['', ...STATUSES].map(s=>{
          const active = filters.status === s;
          return (
            <button key={s} onClick={()=>applyFilters({...filters,status:s})}
              className="px-3 h-8 flex items-center rounded-full text-xs font-semibold transition-all"
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
          <input value={filters.search} placeholder="Name, phone, email…"
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
          <table className="data-table" style={{ minWidth:880 }}>
            <thead>
              <tr>
                <th style={{ width:36 }}>
                  <input type="checkbox" checked={selected.size===leads.length&&leads.length>0} onChange={toggleAll}
                    style={{ accentColor:'#2563EB' }} />
                </th>
                {['Created','Lead','Contact','Attempts','Tags','Assigned To','Status','Last Call','Duration','Note','Follow-up','Actions'].map(h=>(
                  <th key={h}>{h}</th>
                ))}
              </tr>
              {/* Column search row */}
              <tr style={{ background:'#F8FAFC' }}>
                <td style={{ padding:'0 0 8px 16px' }} />
                <td style={{ padding:'0 0 8px 14px' }} />
                <td style={{ padding:'0 14px 8px' }}>
                  <input value={colSearch.name} placeholder="Search…" onChange={e=>setColSearch(s=>({...s,name:e.target.value}))}
                    className="form-input" style={{ padding:'4px 8px', fontSize:11, height:'auto' }} />
                </td>
                <td style={{ padding:'0 14px 8px' }}>
                  <input value={colSearch.phone} placeholder="Search…" onChange={e=>setColSearch(s=>({...s,phone:e.target.value}))}
                    className="form-input" style={{ padding:'4px 8px', fontSize:11, height:'auto' }} />
                </td>
                <td style={{ padding:'0 0 8px' }} /><td style={{ padding:'0 0 8px' }} />
                <td style={{ padding:'0 14px 8px' }}>
                  <input value={colSearch.assignedTo} placeholder="Search…" onChange={e=>setColSearch(s=>({...s,assignedTo:e.target.value}))}
                    className="form-input" style={{ padding:'4px 8px', fontSize:11, height:'auto' }} />
                </td>
                <td style={{ padding:'0 0 8px' }} /><td style={{ padding:'0 0 8px' }} /><td style={{ padding:'0 0 8px' }} />
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
                    <p className="text-xs truncate" style={{ color:lead.lastCallNote?'#374151':'#CBD5E1' }}>
                      {lead.lastCallNote||'—'}
                    </p>
                  </td>
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
                <tr><td colSpan={13} className="py-16 text-center">
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
                {[{k:'name',l:'Full Name',req:true},{k:'phone',l:'Phone',req:true},{k:'email',l:'Email'},{k:'source',l:'Source'},{k:'tags',l:'Tags (comma-separated)'}].map(({k,l,req})=>(
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

      {showImport && (
        <ImportModal
          onClose={()=>setShowImport(false)}
          onDone={()=>{ setShowImport(false); fetchLeads(1, filters); }}
        />
      )}

      {detailLead && (
        <LeadDetailModal lead={detailLead} employees={employees}
          onClose={()=>setDetailLead(null)}
          onUpdate={()=>{ fetchLeads(page,filters); setDetailLead(null); }} />
      )}
    </div>
  );
}
