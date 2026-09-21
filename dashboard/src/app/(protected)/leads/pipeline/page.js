'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../../lib/api';
import { parseUTC } from '../../../../lib/timezone';
import { X } from 'lucide-react';
import { STATUSES, STATUS_LABELS, statusStyle } from '../../../../lib/leadStatus';

function LeadCard({ lead, onClick, index }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.2) }}
      whileHover={{ y: -2 }}
      onClick={() => onClick(lead)}
      className="rounded-xl p-3.5 cursor-pointer bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-shadow"
    >
      <p className="text-sm font-semibold truncate text-gray-900">{lead.name || 'Unknown'}</p>
      <p className="text-xs font-mono mt-0.5 text-gray-400">{lead.phone}</p>
      {lead.company && <p className="text-xs truncate mt-1 text-gray-600">{lead.company}</p>}
      {lead.followUpDate && (
        <div className="mt-2 inline-block text-[10px] px-2 py-0.5 rounded-lg font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          Follow-up {parseUTC(lead.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}
        </div>
      )}
      {lead.lastCallNote && (
        <p className="text-xs mt-1.5 line-clamp-2 italic text-gray-400">&ldquo;{lead.lastCallNote}&rdquo;</p>
      )}
    </motion.div>
  );
}

function LeadModal({ lead, onClose, onUpdate }) {
  const [status, setStatus] = useState(lead.status || 'new');
  const [note, setNote] = useState(lead.lastCallNote || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/api/leads/${lead._id}`, { status, lastCallNote: note });
      toast.success('Lead updated'); onUpdate(); onClose();
    } catch { toast.error('Failed to update lead'); }
    finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 flex items-start justify-between border-b border-gray-100">
          <div>
            <h3 className="font-bold text-lg leading-none text-gray-900">{lead.name}</h3>
            <p className="text-sm mt-1 text-gray-400">{lead.phone}{lead.company ? ` · ${lead.company}` : ''}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5 text-gray-500">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="form-input">
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5 text-gray-500">Call Notes</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className="form-input resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
            {lead.source && <div><span className="font-medium text-gray-900">Source:</span> {lead.source}</div>}
            {lead.email && <div><span className="font-medium text-gray-900">Email:</span> {lead.email}</div>}
            {lead.followUpDate && (
              <div className="col-span-2">
                <span className="font-medium text-gray-900">Follow-up:</span>{' '}
                {parseUTC(lead.followUpDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 flex gap-3 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center disabled:opacity-70">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function PipelinePage() {
  const [leads, setLeads] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await api.get('/api/leads?limit=500');
      setLeads(res.data.data?.leads || res.data.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const grouped = {};
  STATUSES.forEach(s => { grouped[s] = []; });
  leads.forEach(lead => {
    const s = (lead.status || 'new').replace(' ', '_').toLowerCase();
    (grouped[s] || grouped.new).push(lead);
  });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-lg font-bold text-gray-900 tracking-tight">Pipeline</h2>
        <p className="text-sm mt-0.5 text-gray-400">
          {leads.length} lead{leads.length !== 1 ? 's' : ''} across {STATUSES.length} stages
        </p>
      </motion.div>

      {/* Stage counts */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="flex flex-wrap gap-2">
        {STATUSES.map(s => {
          const st = statusStyle(s);
          return (
            <span key={s} className={`text-xs px-2.5 py-1 rounded-full font-medium border ${st.bg} ${st.text} ${st.border}`}>
              {STATUS_LABELS[s]}: {(grouped[s] || []).length}
            </span>
          );
        })}
      </motion.div>

      {/* Board */}
      <div className="overflow-x-auto pb-6">
        <div className="flex gap-4" style={{ minWidth: `${STATUSES.length * 288}px` }}>
          {STATUSES.map((s, colIdx) => {
            const st = statusStyle(s);
            const colLeads = grouped[s] || [];
            return (
              <motion.div key={s} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: colIdx * 0.03 }}
                className="w-72 shrink-0">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${st.dot}`} />
                    <span className="text-sm font-semibold text-gray-900">{STATUS_LABELS[s]}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white text-gray-400 border border-gray-200">{colLeads.length}</span>
                </div>
                <div className={`rounded-xl p-2.5 space-y-2.5 min-h-[14rem] border ${st.bg} border-gray-200/60`}>
                  {loading ? (
                    <>{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl animate-pulse bg-white/60" />)}</>
                  ) : colLeads.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-xs select-none text-gray-400">
                      No leads here
                    </div>
                  ) : colLeads.map((lead, i) => (
                    <LeadCard key={lead._id} lead={lead} index={i} onClick={setSelected} />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <LeadModal lead={selected} onClose={() => setSelected(null)} onUpdate={() => { load(); setSelected(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}
