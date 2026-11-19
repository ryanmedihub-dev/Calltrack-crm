'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../../lib/api';
import { parseUTC } from '../../../../lib/timezone';
import { STATUSES, STATUS_LABELS, statusStyle } from '../../../../lib/leadStatus';
import { PageHeader, fmtNum } from '../../../../components/report-shared';

const EASE_OUT = [0.23, 1, 0.32, 1];
const LIMIT = 500;
const shortDate = (ts) => parseUTC(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

function LeadCard({ lead, onClick }) {
  const overdue = lead.followUpDate && parseUTC(lead.followUpDate) < new Date();
  return (
    <button onClick={() => onClick(lead)}
      className="w-full text-left rounded-lg bg-white border border-line p-3 transition-[border-color,transform] duration-150 hover:border-gray-300 active:scale-[0.99]">
      <p className="text-[13px] font-medium text-ink truncate">{lead.name || 'Unnamed lead'}</p>
      <p className="text-xs text-ink-3 tabular-nums mt-0.5">{lead.phone}</p>
      {lead.lastCallNote && <p className="text-xs text-ink-2 mt-2 line-clamp-2">{lead.lastCallNote}</p>}
      {(lead.followUpDate || lead.assignedTo?.name) && (
        <div className="flex items-center justify-between gap-2 mt-2.5">
          {lead.followUpDate
            ? <span className={`badge ${overdue ? 'bg-[var(--behind-50)] text-behind' : 'bg-[var(--warn-50)] text-[var(--warn)]'}`}>Follow-up {shortDate(lead.followUpDate)}</span>
            : <span />}
          {lead.assignedTo?.name && <span className="text-xs text-ink-3 truncate">{lead.assignedTo.name}</span>}
        </div>
      )}
    </button>
  );
}

function LeadModal({ lead, onClose, onUpdate }) {
  const [status, setStatus] = useState(lead.status || 'new');
  const [note, setNote] = useState(lead.lastCallNote || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/api/leads/${lead._id}`, { status, lastCallNote: note });
      toast.success('Lead updated'); onUpdate(); onClose();
    } catch { toast.error('Couldn’t update the lead. Try again.'); }
    finally { setSaving(false); }
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE_OUT }}>
      <div className="absolute inset-0 bg-[rgba(26,23,38,0.45)]" onClick={onClose} />
      <motion.div role="dialog" aria-modal="true" aria-labelledby="lead-title"
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.25, ease: EASE_OUT }}
        className="relative w-full max-w-md bg-white rounded-xl shadow-2xl">
        <div className="flex items-start justify-between px-5 pt-5">
          <div className="min-w-0">
            <h2 id="lead-title" className="text-base font-semibold text-ink truncate">{lead.name || 'Unnamed lead'}</h2>
            <p className="text-[13px] text-ink-3 mt-0.5 tabular-nums">{lead.phone}{lead.source ? ` · ${lead.source}` : ''}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="btn-ghost btn-icon btn-sm w-8 -mr-1.5 -mt-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <label className="block">
            <span className="form-label">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-input">
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="form-label">Call note</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="form-input" />
          </label>
          {(lead.email || lead.followUpDate || lead.assignedTo?.name) && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
              {lead.assignedTo?.name && <><dt className="text-ink-3">Assigned to</dt><dd className="text-ink text-right">{lead.assignedTo.name}</dd></>}
              {lead.email && <><dt className="text-ink-3">Email</dt><dd className="text-ink text-right truncate">{lead.email}</dd></>}
              {lead.followUpDate && <><dt className="text-ink-3">Follow-up</dt><dd className="text-ink text-right">{parseUTC(lead.followUpDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</dd></>}
            </dl>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary min-w-[120px]">{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function PipelinePage() {
  const [leads, setLeads] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hideEmpty, setHideEmpty] = useState(false);

  const load = async () => {
    try {
      const res = await api.get(`/api/leads?limit=${LIMIT}`);
      setLeads(res.data.data?.leads || res.data.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const grouped = {};
  STATUSES.forEach((s) => { grouped[s] = []; });
  leads.forEach((lead) => {
    const s = (lead.status || 'new').replace(' ', '_').toLowerCase();
    (grouped[s] || grouped.new).push(lead);
  });
  const columns = hideEmpty && !loading ? STATUSES.filter((s) => grouped[s].length) : STATUSES;

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description={loading ? 'Loading leads…' : `Latest ${fmtNum(leads.length)} leads by status${leads.length >= LIMIT ? ' · open the Leads report for all of them' : ''}`}
        actions={
          <div className="seg" role="group" aria-label="Columns">
            <button aria-pressed={!hideEmpty} onClick={() => setHideEmpty(false)}>All stages</button>
            <button aria-pressed={hideEmpty} onClick={() => setHideEmpty(true)}>Hide empty</button>
          </div>
        }
      />

      <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4">
        <div className="flex gap-3 items-start" style={{ minWidth: `${columns.length * 276}px` }}>
          {columns.map((s) => {
            const st = statusStyle(s);
            const col = grouped[s] || [];
            return (
              <section key={s} aria-label={STATUS_LABELS[s]} className="w-[264px] shrink-0 rounded-xl bg-[#EEF0F3] flex flex-col max-h-[calc(100vh-200px)]">
                <header className="flex items-center justify-between gap-2 px-3 h-11 shrink-0">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                    <span className="text-[13px] font-medium text-ink truncate">{STATUS_LABELS[s]}</span>
                  </span>
                  <span className="text-xs text-ink-3 tabular-nums">{loading ? '' : fmtNum(col.length)}</span>
                </header>
                <div className="overflow-y-auto px-2 pb-2 space-y-2 min-h-[120px]">
                  {loading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-[68px] !bg-white/70" />)
                    : col.length === 0 ? <p className="text-xs text-ink-3 text-center py-8">No leads</p>
                    : col.map((lead) => <LeadCard key={lead._id} lead={lead} onClick={setSelected} />)}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selected && <LeadModal lead={selected} onClose={() => setSelected(null)} onUpdate={() => { load(); setSelected(null); }} />}
      </AnimatePresence>
    </div>
  );
}
