'use client';
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../lib/api';
import { parseUTC } from '../../../lib/timezone';
import { DataTable } from '../../../components/report-shared';
import { STATUSES, STATUS_LABELS, statusStyle, statusLabel } from '../../../lib/leadStatus';

const VALID_STATUSES = new Set(STATUSES);
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

function CloseIco() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function UploadIco() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
}
function PlusIco() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}

const MODAL_BACKDROP = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm';
const MODAL_PANEL = 'w-full rounded-2xl bg-white border border-gray-200 shadow-2xl flex flex-col';
const backdropMotion = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
const panelMotion = { initial: { opacity: 0, scale: 0.96, y: 12 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.96, y: 12 } };

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
    <motion.div {...backdropMotion} className={MODAL_BACKDROP} onClick={onClose}>
      <motion.div {...panelMotion} className={`${MODAL_PANEL} max-w-lg max-h-[90vh]`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-bold text-sm text-gray-900">Import Leads via CSV</h3>
            <p className="text-xs text-gray-400 mt-0.5">Paste CSV data with Name, Phone, Status columns</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
            <CloseIco />
          </button>
        </div>

        <div className="flex items-center gap-0 px-5 py-3 border-b border-gray-100 shrink-0">
          {[{n:1,l:'Paste CSV'},{n:2,l:'Preview'},{n:3,l:'Done'}].map((s,i,arr)=>(
            <div key={s.n} className="flex items-center gap-0 flex-1">
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  step>s.n ? 'bg-emerald-600 text-white' : step===s.n ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                  {step>s.n?'✓':s.n}
                </div>
                <span className={`text-xs font-semibold whitespace-nowrap ${step===s.n ? 'text-blue-600' : 'text-gray-400'}`}>{s.l}</span>
              </div>
              {i<arr.length-1&&<div className="flex-1 h-px mx-2 bg-gray-200"/>}
            </div>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          <AnimatePresence mode="wait">
            {step===1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-4">
                <div className="rounded-xl p-4 text-sm space-y-1 bg-blue-50 border border-blue-100">
                  <p className="font-semibold text-xs text-blue-700">How to upload</p>
                  <p className="text-xs text-blue-800">1. Open your Excel / Google Sheet</p>
                  <p className="text-xs text-blue-800">2. Ensure columns: <b>Name, Phone, Status</b> (Status optional)</p>
                  <p className="text-xs text-blue-800">3. Select all rows → Copy → Paste below</p>
                </div>
                <div className="rounded-xl p-3 bg-gray-50 border border-gray-200">
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5 text-gray-400">Example format</p>
                  <pre className="text-xs font-mono text-gray-600">{`Name,Phone,Status\nRahul Sharma,9876543210,interested\nPriya Singh,8765432109,new`}</pre>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5 text-gray-500">Paste CSV data</label>
                  <textarea value={csvText} onChange={e=>setCsvText(e.target.value)} rows={8}
                    placeholder={'Name,Phone,Status\nRahul Sharma,9876543210,new\n…'}
                    className="form-input resize-none font-mono text-xs leading-relaxed"/>
                </div>
                {parseErrors.length>0&&(
                  <div className="rounded-xl p-3 text-xs space-y-1 bg-red-50 border border-red-200">
                    {parseErrors.map((e,i)=><p key={i} className="text-red-600">⚠ {e}</p>)}
                  </div>
                )}
                <button onClick={handleParse} disabled={!csvText.trim()} className="btn-primary w-full justify-center disabled:opacity-45">
                  Parse &amp; Preview →
                </button>
              </motion.div>
            )}

            {step===2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{parsed.length} leads ready</span>
                  {parseErrors.length>0&&<span className="text-xs font-semibold text-amber-600">{parseErrors.length} rows skipped</span>}
                </div>
                {parseErrors.length>0&&(
                  <div className="rounded-xl p-3 text-xs space-y-1 bg-amber-50 border border-amber-200">
                    {parseErrors.map((e,i)=><p key={i} className="text-amber-800">⚠ {e}</p>)}
                  </div>
                )}
                <div className="rounded-xl overflow-hidden border border-gray-200">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-gray-50">
                      <th className="text-left px-3 py-2 font-bold uppercase tracking-wide text-[10px] text-gray-400">Name</th>
                      <th className="text-left px-3 py-2 font-bold uppercase tracking-wide text-[10px] text-gray-400">Phone</th>
                      <th className="text-left px-3 py-2 font-bold uppercase tracking-wide text-[10px] text-gray-400">Status</th>
                    </tr></thead>
                    <tbody>
                      {parsed.slice(0,20).map((r,i)=>(
                        <tr key={i} className={`border-t border-gray-100 ${i%2===1?'bg-gray-50/60':''}`}>
                          <td className="px-3 py-2 font-medium truncate max-w-[160px] text-gray-900">{r.name}</td>
                          <td className="px-3 py-2 text-gray-600">{r.phone}</td>
                          <td className="px-3 py-2 font-semibold text-blue-600">{r.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.length>20&&<p className="text-xs text-center py-2 text-gray-400">…and {parsed.length-20} more rows</p>}
                </div>
                <div className="flex gap-3">
                  <button onClick={()=>setStep(1)} className="btn-secondary flex-1 justify-center">← Back</button>
                  <button onClick={handleUpload} disabled={uploading} className="btn-primary flex-[2] justify-center disabled:opacity-70">
                    {uploading?'Uploading…':`Upload ${parsed.length} Leads ✓`}
                  </button>
                </div>
              </motion.div>
            )}

            {step===3&&result&&(
              <motion.div key="s3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 py-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl bg-emerald-50">🎉</div>
                <p className="text-lg font-bold text-gray-900">Upload Complete!</p>
                <div className="flex gap-4">
                  {[
                    {v:result.inserted??result.data?.inserted??0,l:'Inserted',c:'text-emerald-600',bg:'bg-emerald-50'},
                    {v:result.skipped??result.data?.skipped??0,l:'Skipped',c:'text-amber-600',bg:'bg-amber-50'},
                    {v:result.errors??result.data?.errors??0,l:'Errors',c:'text-red-600',bg:'bg-red-50'},
                  ].map(({v,l,c,bg})=>(
                    <div key={l} className={`flex flex-col items-center rounded-xl px-6 py-4 gap-1 ${bg}`}>
                      <span className={`text-3xl font-black ${c}`}>{v}</span>
                      <span className={`text-xs font-bold ${c}`}>{l}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400">Skipped = duplicates already in the system</p>
                <button onClick={onDone} className="btn-primary px-8 justify-center">View Leads →</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

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

const CALL_TYPE_COLOR = { incoming:'text-emerald-600', outgoing:'text-amber-600', missed:'text-red-600', rejected:'text-violet-600' };
const CALL_TYPE_DOT = { incoming:'bg-emerald-500', outgoing:'bg-amber-500', missed:'bg-red-500', rejected:'bg-violet-500' };

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

  return (
    <motion.div {...backdropMotion} className={MODAL_BACKDROP} onClick={onClose}>
      <motion.div {...panelMotion} className={`${MODAL_PANEL} max-w-2xl max-h-[90vh]`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-bold text-gray-900">{lead.name}</h3>
            <p className="text-xs mt-0.5 text-gray-400">{lead.phone}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
            <CloseIco />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-5 border-b border-gray-100 shrink-0">
          {[['info','Info'],['calls','Call Logs'],['activity','Activity']].map(([k,l])=>(
            <button key={k} onClick={()=>setActiveTab(k)}
              className={`relative px-4 py-3 text-xs font-semibold transition-colors ${activeTab===k ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}>
              {l}
              {activeTab===k && <motion.span layoutId="leadModalTabUnderline" className="absolute left-3 right-3 -bottom-px h-[2.5px] bg-blue-600 rounded-full" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <AnimatePresence mode="wait">
            {/* ── INFO TAB ── */}
            {activeTab==='info' && (
              <motion.div key="info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[{k:'name',l:'Full Name'},{k:'phone',l:'Phone'},{k:'email',l:'Email'},{k:'source',l:'Source'},{k:'tags',l:'Tags (comma-separated)'}].map(({k,l})=>(
                    <div key={k}>
                      <label className="block text-xs font-medium mb-1 text-gray-600">{l}</label>
                      <input value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} className="form-input" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-600">Status</label>
                    <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="form-input">
                      {STATUSES.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-600">Assign To</label>
                    <select value={form.assignedTo} onChange={e=>setForm({...form,assignedTo:e.target.value})} className="form-input">
                      <option value="">Unassigned</option>
                      {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-600">Follow-up Date</label>
                    <input type="date" value={form.followUpDate} onChange={e=>setForm({...form,followUpDate:e.target.value})} className="form-input" />
                  </div>
                </div>

                {/* Add Note */}
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-600">Add Note</label>
                  <div className="flex gap-2">
                    <input value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Add a note…" className="form-input flex-1"
                      onKeyDown={e=>e.key==='Enter'&&handleNote()} />
                    <button onClick={handleNote} className="btn-primary text-xs px-3">Add</button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── CALL LOGS TAB ── */}
            {activeTab==='calls' && (
              <motion.div key="calls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                {loadingDetail && <p className="text-xs text-center py-4 text-gray-400">Loading…</p>}
                {!loadingDetail && calls.length === 0 && (
                  <p className="text-xs text-center py-8 text-gray-400">No call logs yet</p>
                )}
                {calls.map((c, i) => (
                  <div key={c._id || i} className="rounded-xl px-4 py-3 flex items-start gap-3 bg-gray-50 border border-gray-200">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${CALL_TYPE_DOT[c.callType] || 'bg-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold capitalize ${CALL_TYPE_COLOR[c.callType] || 'text-gray-600'}`}>{c.callType}</span>
                        {c.duration>0 && <span className="text-xs font-medium text-gray-600">{fmtDur(c.duration)}</span>}
                        {c.callStatus && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600 border border-blue-200">
                            {c.callStatus}
                          </span>
                        )}
                      </div>
                      {c.notes && <p className="text-xs mt-0.5 italic text-gray-600">{c.notes}</p>}
                      <p className="text-[11px] mt-1 text-gray-400">
                        {c.employeeName || 'Unknown'} · {fmtDateTime(c.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* ── ACTIVITY / CHANGELOG TAB ── */}
            {activeTab==='activity' && (
              <motion.div key="activity" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                {loadingDetail && <p className="text-xs text-center py-4 text-gray-400">Loading…</p>}
                {!loadingDetail && changelog.length === 0 && (
                  <p className="text-xs text-center py-8 text-gray-400">No activity yet</p>
                )}
                {changelog.map((entry, i) => (
                  <div key={entry._id || i} className="rounded-xl px-4 py-3 flex items-start gap-3 bg-gray-50 border border-gray-200">
                    <span className="text-base shrink-0 mt-0.5">{CHANGELOG_ICONS[entry.action] || '•'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold capitalize text-gray-900">
                        {entry.action?.replace(/_/g,' ')}
                      </p>
                      {entry.details?.text && (
                        <p className="text-xs mt-0.5 italic text-gray-600">"{entry.details.text}"</p>
                      )}
                      {entry.details?.from && (
                        <p className="text-xs mt-0.5 text-gray-600">
                          {statusLabel(entry.details.from)} → {statusLabel(entry.details.to)}
                        </p>
                      )}
                      {entry.details?.callType && !entry.details?.text && !entry.details?.from && (
                        <p className="text-xs mt-0.5 text-gray-600">
                          {entry.details.callType} · {fmtDur(entry.details.duration)}
                        </p>
                      )}
                      <p className="text-[11px] mt-0.5 text-gray-400">
                        {entry.changedByName || 'System'} · {fmtDateTime(entry.changedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-5 flex gap-2 shrink-0 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          {activeTab==='info' && (
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center disabled:opacity-70">
              {saving?'Saving…':'Save Changes'}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function LeadsPage() {
  const [leads,        setLeads]        = useState([]);
  const [employees,    setEmployees]    = useState([]);
  const [page,         setPage]         = useState(1);
  const [pages,        setPages]        = useState(1);
  const [total,        setTotal]        = useState(0);
  const [limit,        setLimit]        = useState(20);
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
      const params = { page:p, limit, ...Object.fromEntries(Object.entries(f).filter(([,v])=>v)) };
      const res = await api.get('/api/leads', { params });
      setLeads(res.data.data.leads);
      setTotal(res.data.data.total);
      setPages(res.data.data.pages);
    } catch {}
  }, [page, filters, limit]);

  useEffect(() => { api.get('/api/employees').then(r=>setEmployees(r.data.data)).catch(()=>{}); }, []);
  useEffect(() => { fetchLeads(page, filters); }, [page, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = (f) => { setFilters(f); setPage(1); setSelected(new Set()); fetchLeads(1, f); };
  const toggleSelect  = (id) => { const n=new Set(selected); n.has(id)?n.delete(id):n.add(id); setSelected(n); };
  const toggleAll     = (ids) => setSelected((prev) => (ids.length > 0 && ids.every((id) => prev.has(id)) ? new Set() : new Set(ids)));

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
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Leads</h2>
          <p className="text-sm mt-0.5 text-gray-400">{total.toLocaleString()} total leads</p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setShowImport(true)} className="btn-secondary flex items-center gap-1.5"><UploadIco /> Import CSV</button>
          <button onClick={()=>setShowAdd(true)} className="btn-primary flex items-center gap-1.5"><PlusIco /> Add Lead</button>
        </div>
      </motion.div>

      {/* Status chips */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="flex gap-2 flex-wrap">
        {['', ...STATUSES].map(s=>{
          const active = filters.status === s;
          return (
            <button key={s||'all'} onClick={()=>applyFilters({...filters,status:s})}
              className={`px-3 h-8 flex items-center rounded-full text-xs font-semibold transition-all ${
                active ? 'bg-gray-900 text-white border border-gray-900' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'}`}>
              {s===''?`All (${total})`:STATUS_LABELS[s]}
            </button>
          );
        })}
      </motion.div>

      {/* Filter bar */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5 text-gray-500">Search</label>
          <input value={filters.search} placeholder="Name, phone, email…"
            onChange={e=>setFilters({...filters,search:e.target.value})}
            onKeyDown={e=>e.key==='Enter'&&applyFilters(filters)}
            className="form-input" />
        </div>
        <div className="min-w-40">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5 text-gray-500">Assigned To</label>
          <select value={filters.assignedTo} onChange={e=>applyFilters({...filters,assignedTo:e.target.value})} className="form-input">
            <option value="">All Employees</option>
            {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2 pb-0.5">
          <button onClick={()=>applyFilters({status:'',assignedTo:'',search:''})} className="btn-secondary text-xs py-1.5">Reset</button>
          <button onClick={()=>applyFilters(filters)} className="btn-primary text-xs py-1.5">Apply</button>
        </div>
      </motion.div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap bg-blue-50 border border-blue-200">
              <span className="text-sm font-semibold text-blue-700">{selected.size} selected</span>
              <div className="flex gap-2 ml-auto flex-wrap">
                {[
                  {a:'assign',l:'Assign',c:'border-blue-600 text-blue-600 hover:bg-blue-600'},
                  {a:'transfer',l:'Transfer',c:'border-amber-600 text-amber-600 hover:bg-amber-600'},
                  {a:'delete',l:'Delete',c:'border-red-600 text-red-600 hover:bg-red-600'},
                ].map(({a,l,c})=>(
                  <button key={a} onClick={()=>setBulkModal(a)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors hover:text-white ${c}`}>
                    {l}
                  </button>
                ))}
                <button onClick={()=>setSelected(new Set())} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                  Clear
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick filter — narrows the rows visible on this page only (server pagination
          means only the current page's leads are loaded, so this can't search the full list) */}
      <div className="flex flex-wrap gap-2 items-center px-1">
        <input value={colSearch.name} placeholder="Filter name…" onChange={e=>setColSearch(s=>({...s,name:e.target.value}))}
          className="form-input max-w-[160px] !py-1 !px-2 text-[11px] !h-auto" />
        <input value={colSearch.phone} placeholder="Filter phone…" onChange={e=>setColSearch(s=>({...s,phone:e.target.value}))}
          className="form-input max-w-[160px] !py-1 !px-2 text-[11px] !h-auto" />
        <input value={colSearch.assignedTo} placeholder="Filter assigned to…" onChange={e=>setColSearch(s=>({...s,assignedTo:e.target.value}))}
          className="form-input max-w-[180px] !py-1 !px-2 text-[11px] !h-auto" />
        <span className="text-[11px] text-gray-300">(this page only)</span>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}>
        <DataTable
          serverMode
          page={page}
          totalPages={pages}
          totalCount={total}
          onPageChange={setPage}
          onPageSizeChange={(n) => { setLimit(n); setPage(1); }}
          pageSize={limit}
          selectable
          selectedIds={selected}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleAll}
          emptyTitle="No leads found"
          columns={[
            {
              key: 'createdAt', label: 'Created',
              render: (lead) => <span className="text-xs whitespace-nowrap text-gray-400">{fmtDate(lead.createdAt)}</span>,
            },
            {
              key: 'name', label: 'Lead',
              render: (lead) => (
                <button onClick={() => setDetailLead(lead)} className="flex items-center gap-2 text-left group">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0 bg-blue-600">
                    {lead.name[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {lead.name}
                  </span>
                </button>
              ),
            },
            {
              key: 'phone', label: 'Contact',
              render: (lead) => <span className="text-xs font-medium text-blue-600">{lead.phone}</span>,
            },
            {
              key: 'attempts', label: 'Attempts', className: 'text-center',
              render: (lead) => <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{lead.attempts || 0}</span>,
            },
            {
              key: 'tags', label: 'Tags', sortable: false, searchable: false,
              render: (lead) => (lead.tags || []).length > 0 ? (
                <div className="flex gap-1 flex-wrap">
                  {lead.tags.slice(0, 2).map(t => (
                    <span key={t} className="text-[11px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200">
                      {t}
                    </span>
                  ))}
                  {lead.tags.length > 2 && <span className="text-[11px] text-gray-400">+{lead.tags.length - 2}</span>}
                </div>
              ) : <span className="text-xs text-gray-300">—</span>,
            },
            {
              key: 'assignedTo', label: 'Assigned To', sortable: false, searchable: false,
              render: (lead) => lead.assignedTo ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-bold shrink-0 bg-blue-600">
                    {lead.assignedTo.name[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs truncate max-w-[90px] text-gray-600">{lead.assignedTo.name}</span>
                </div>
              ) : <span className="text-xs text-gray-300">Unassigned</span>,
            },
            {
              key: 'status', label: 'Status', sortable: false, searchable: false,
              render: (lead) => {
                const s = statusStyle(lead.status);
                return (
                  <select value={lead.status} onChange={e => handleStatusChange(lead._id, e.target.value)}
                    onClick={e => e.stopPropagation()}
                    className={`text-[11px] rounded-full px-2 py-0.5 font-semibold focus:outline-none cursor-pointer border ${s.bg} ${s.text} ${s.border}`}>
                    {STATUSES.map(st => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
                  </select>
                );
              },
            },
            {
              key: 'lastCallAt', label: 'Last Call',
              render: (lead) => <span className="text-xs whitespace-nowrap text-gray-600">{lead.lastCallAt ? fmtDate(lead.lastCallAt) : '—'}</span>,
            },
            {
              key: 'lastCallDuration', label: 'Duration',
              render: (lead) => <span className="text-xs font-medium text-gray-600">{fmtDur(lead.lastCallDuration)}</span>,
            },
            {
              key: 'lastCallNote', label: 'Note', className: 'max-w-[110px]', sortable: false, searchable: false,
              render: (lead) => <p className={`text-xs truncate ${lead.lastCallNote ? 'text-gray-700' : 'text-gray-300'}`}>{lead.lastCallNote || '—'}</p>,
            },
            {
              key: 'followUpDate', label: 'Follow-up',
              render: (lead) => lead.followUpDate ? (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap bg-amber-50 text-amber-600 border border-amber-200">
                  {fmtDate(lead.followUpDate)}
                </span>
              ) : <span className="text-xs text-gray-300">—</span>,
            },
            {
              key: 'actions', label: 'Actions', sortable: false, searchable: false,
              render: (lead) => (
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setDetailLead(lead)} className="text-xs font-semibold text-blue-600 hover:opacity-70 transition-opacity">Edit</button>
                  <button onClick={() => handleDelete(lead._id)} className="text-xs font-semibold text-red-500 hover:opacity-70 transition-opacity">Del</button>
                </div>
              ),
            },
          ]}
          rows={filteredLeads}
        />
      </motion.div>

      {/* Add Lead Modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div {...backdropMotion} className={MODAL_BACKDROP} onClick={()=>setShowAdd(false)}>
            <motion.div {...panelMotion} className={`${MODAL_PANEL} max-w-lg max-h-[90vh]`} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                <div>
                  <h3 className="font-bold text-gray-900">Add New Lead</h3>
                  <p className="text-xs mt-0.5 text-gray-400">Fill in contact details</p>
                </div>
                <button onClick={()=>setShowAdd(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                  <CloseIco />
                </button>
              </div>
              <form onSubmit={handleAddLead} className="p-5 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  {[{k:'name',l:'Full Name',req:true},{k:'phone',l:'Phone',req:true},{k:'email',l:'Email'},{k:'source',l:'Source'},{k:'tags',l:'Tags (comma-separated)'}].map(({k,l,req})=>(
                    <div key={k}>
                      <label className="block text-xs font-medium mb-1 text-gray-600">{l}</label>
                      <input type="text" required={!!req} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} className="form-input" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-600">Status</label>
                    <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="form-input">
                      {STATUSES.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-600">Assign To</label>
                    <select value={form.assignedTo} onChange={e=>setForm({...form,assignedTo:e.target.value})} className="form-input">
                      <option value="">Unassigned</option>
                      {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-600">Follow-up Date</label>
                    <input type="date" value={form.followUpDate} onChange={e=>setForm({...form,followUpDate:e.target.value})} className="form-input" />
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <button type="button" onClick={()=>setShowAdd(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                  <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center disabled:opacity-70">
                    {loading?'Creating…':'Create Lead'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk assign/transfer modal */}
      <AnimatePresence>
        {(bulkModal==='assign'||bulkModal==='transfer') && (
          <motion.div {...backdropMotion} className={MODAL_BACKDROP} onClick={()=>{setBulkModal(null);setBulkEmployee('');}}>
            <motion.div {...panelMotion} className={`${MODAL_PANEL} max-w-sm`} onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-bold capitalize text-gray-900">{bulkModal} {selected.size} Leads</h3>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-600">Select Employee</label>
                  <select value={bulkEmployee} onChange={e=>setBulkEmployee(e.target.value)} className="form-input">
                    <option value="">— Select —</option>
                    {employees.map(e=><option key={e._id} value={e._id}>{e.name}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>{setBulkModal(null);setBulkEmployee('');}} className="btn-secondary flex-1 justify-center">Cancel</button>
                  <button onClick={handleBulkAction} disabled={!bulkEmployee} className="btn-primary flex-1 justify-center disabled:opacity-40">Confirm</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showImport && (
          <ImportModal
            onClose={()=>setShowImport(false)}
            onDone={()=>{ setShowImport(false); fetchLeads(1, filters); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailLead && (
          <LeadDetailModal lead={detailLead} employees={employees}
            onClose={()=>setDetailLead(null)}
            onUpdate={()=>{ fetchLeads(page,filters); setDetailLead(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}
