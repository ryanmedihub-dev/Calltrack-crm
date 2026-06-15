'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../../lib/api';

const COLUMNS = [
  { key: 'new',            label: 'New',            color: '#64748B', bg: '#F8FAFC' },
  { key: 'interested',     label: 'Interested',     color: '#10B981', bg: '#F0FDF4' },
  { key: 'callback',       label: 'Callback',       color: '#1A6BFF', bg: '#EFF6FF' },
  { key: 'price_enquiry',  label: 'Price Enquiry',  color: '#F59E0B', bg: '#FFFBEB' },
  { key: 'converted',      label: 'Converted',      color: '#059669', bg: '#D1FAE5' },
  { key: 'not_interested', label: 'Not Interested', color: '#EF4444', bg: '#FEF2F2' },
];

function LeadCard({ lead, onClick }) {
  return (
    <div onClick={() => onClick(lead)}
      className="bg-white border border-border rounded-xl p-3.5 shadow-sm hover:shadow-md hover:border-primary/40 cursor-pointer transition-all group">
      <p className="text-sm font-semibold text-textPrimary group-hover:text-primary transition-colors leading-snug truncate">
        {lead.name || 'Unknown'}
      </p>
      <p className="text-xs text-textMuted font-mono mt-0.5">{lead.phone}</p>
      {lead.company && <p className="text-xs text-textSecondary truncate mt-1">{lead.company}</p>}
      {lead.followUpDate && (
        <div className="mt-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5 font-semibold">
          Follow-up {new Date(lead.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </div>
      )}
      {lead.lastCallNote && (
        <p className="text-xs text-textMuted mt-1.5 line-clamp-2 italic">&ldquo;{lead.lastCallNote}&rdquo;</p>
      )}
    </div>
  );
}

function LeadModal({ lead, onClose, onUpdate }) {
  const [status, setStatus] = useState(lead.status || 'new');
  const [note,   setNote]   = useState(lead.lastCallNote || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/api/leads/${lead._id}`, { status, lastCallNote: note });
      toast.success('Lead updated');
      onUpdate();
      onClose();
    } catch { toast.error('Failed to update lead'); }
    finally  { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border shadow-modal w-full max-w-md">
        <div className="p-5 border-b border-border flex items-start justify-between">
          <div>
            <h3 className="font-bold text-textPrimary text-lg leading-none">{lead.name}</h3>
            <p className="text-textMuted text-sm mt-1">
              {lead.phone}{lead.company ? ` · ${lead.company}` : ''}
            </p>
          </div>
          <button onClick={onClose}
            className="text-textMuted hover:text-danger transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-dangerLt text-lg leading-none flex-shrink-0">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-textMuted uppercase tracking-wide mb-1.5">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-textMuted uppercase tracking-wide mb-1.5">Call Notes</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm text-textSecondary">
            {lead.source && <div><span className="font-medium text-textPrimary">Source:</span> {lead.source}</div>}
            {lead.email  && <div><span className="font-medium text-textPrimary">Email:</span> {lead.email}</div>}
            {lead.followUpDate && (
              <div className="col-span-2">
                <span className="font-medium text-textPrimary">Follow-up:</span>{' '}
                {new Date(lead.followUpDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-border flex gap-3">
          <button onClick={onClose}
            className="flex-1 border border-border text-textSecondary py-2.5 rounded-xl text-sm font-medium hover:border-danger hover:text-danger transition-colors">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primaryDk disabled:opacity-60 transition-colors">
            {saving ? 'Saving…' : 'Save Changes'}
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
      setLeads(res.data.data?.leads || res.data.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const grouped = {};
  COLUMNS.forEach(c => { grouped[c.key] = []; });
  leads.forEach(lead => {
    const s = (lead.status || 'new').replace(' ', '_').toLowerCase();
    if (grouped[s]) grouped[s].push(lead);
    else grouped['new'].push(lead);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-textPrimary">Pipeline</h2>
        <p className="text-textMuted text-sm mt-0.5">
          {leads.length} lead{leads.length !== 1 ? 's' : ''} across {COLUMNS.length} stages
        </p>
      </div>

      {/* Stage counts */}
      <div className="flex flex-wrap gap-2">
        {COLUMNS.map(col => (
          <span key={col.key} className="text-xs font-semibold px-3 py-1.5 rounded-full border"
            style={{ color: col.color, background: col.bg, borderColor: `${col.color}40` }}>
            {col.label}: {(grouped[col.key] || []).length}
          </span>
        ))}
      </div>

      {/* Board */}
      <div className="overflow-x-auto pb-6">
        <div className="flex gap-4" style={{ minWidth: `${COLUMNS.length * 296}px` }}>
          {COLUMNS.map(col => {
            const colLeads = grouped[col.key] || [];
            return (
              <div key={col.key} className="w-72 flex-shrink-0">
                {/* Column header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                    <span className="text-sm font-semibold text-textPrimary">{col.label}</span>
                  </div>
                  <span className="text-xs font-semibold bg-white border border-border rounded-full px-2 py-0.5 text-textMuted">{colLeads.length}</span>
                </div>

                {/* Cards */}
                <div className="rounded-2xl p-2.5 space-y-2.5 min-h-[14rem]"
                  style={{ background: col.bg, border: `1.5px solid ${col.color}25` }}>
                  {loading ? (
                    <>
                      {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white rounded-xl animate-pulse border border-border" />)}
                    </>
                  ) : colLeads.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-xs text-textMuted select-none">
                      No leads here
                    </div>
                  ) : colLeads.map(lead => (
                    <LeadCard key={lead._id} lead={lead} onClick={setSelected} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lead detail modal */}
      {selected && (
        <LeadModal
          lead={selected}
          onClose={() => setSelected(null)}
          onUpdate={() => { load(); setSelected(null); }}
        />
      )}
    </div>
  );
}
