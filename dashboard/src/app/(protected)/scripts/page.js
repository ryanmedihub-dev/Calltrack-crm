'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../../lib/api';
import { SkeletonTable } from '../../../components/Skeleton';

const CATEGORIES = ['All', 'Intro', 'Follow-Up', 'Objection', 'Closing', 'Custom'];

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border shadow-modal w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <h3 className="font-bold text-textPrimary">{title}</h3>
          <button onClick={onClose}
            className="text-textMuted hover:text-danger transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-dangerLt text-lg">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

function ScriptForm({ initial, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    title:    initial?.title    || '',
    category: initial?.category || 'Custom',
    content:  initial?.content  || '',
  });

  const submit = () => {
    if (!form.title.trim())   return toast.error('Title is required');
    if (!form.content.trim()) return toast.error('Script content is required');
    onSave(form);
  };

  return (
    <div className="p-5 space-y-4">
      <div>
        <label className="block text-xs font-semibold text-textMuted uppercase tracking-wide mb-1.5">Title</label>
        <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
          placeholder="e.g. Cold Call Opener"
          className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-textMuted uppercase tracking-wide mb-1.5">Category</label>
        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
          className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
          {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-textMuted uppercase tracking-wide mb-1.5">Script Content</label>
        <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
          rows={10} placeholder="Write your script here. Use [placeholders] for dynamic values."
          className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-xs leading-relaxed" />
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose}
          className="flex-1 border border-border text-textSecondary py-2.5 rounded-xl text-sm font-medium hover:border-danger hover:text-danger transition-colors">
          Cancel
        </button>
        <button onClick={submit} disabled={saving}
          className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primaryDk transition-colors disabled:opacity-60">
          {saving ? 'Saving…' : 'Save Script'}
        </button>
      </div>
    </div>
  );
}

const CAT_COLORS = {
  Intro:       { color: '#1A6BFF', bg: '#EFF6FF' },
  'Follow-Up': { color: '#10B981', bg: '#ECFDF5' },
  Objection:   { color: '#F59E0B', bg: '#FFFBEB' },
  Closing:     { color: '#8B5CF6', bg: '#F5F3FF' },
  Custom:      { color: '#64748B', bg: '#F8FAFC' },
};

export default function ScriptsPage() {
  const [scripts,  setScripts]  = useState([]);
  const [filter,   setFilter]   = useState('All');
  const [editing,  setEditing]  = useState(null);
  const [creating, setCreating] = useState(false);
  const [preview,  setPreview]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  const fetchScripts = async () => {
    try {
      const res = await api.get('/api/scripts');
      setScripts(res.data.data || []);
    } catch { toast.error('Failed to load scripts'); }
    setLoading(false);
  };

  useEffect(() => { fetchScripts(); }, []);

  const save = async (form) => {
    setSaving(true);
    try {
      if (editing) {
        const res = await api.put(`/api/scripts/${editing._id}`, form);
        setScripts(prev => prev.map(s => s._id === editing._id ? res.data.data : s));
        toast.success('Script updated');
      } else {
        const res = await api.post('/api/scripts', form);
        setScripts(prev => [res.data.data, ...prev]);
        toast.success('Script created');
      }
      setEditing(null);
      setCreating(false);
    } catch { toast.error('Failed to save script'); }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!confirm('Delete this script?')) return;
    try {
      await api.delete(`/api/scripts/${id}`);
      setScripts(prev => prev.filter(s => s._id !== id));
      toast.success('Script deleted');
    } catch { toast.error('Failed to delete script'); }
  };

  const copy = (content) => {
    navigator.clipboard.writeText(content).then(() => toast.success('Copied to clipboard'));
  };

  const visible = filter === 'All' ? scripts : scripts.filter(s => s.category === filter);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-textPrimary">Call Scripts</h2>
          <p className="text-textMuted text-sm mt-0.5">Loading scripts…</p>
        </div>
        <SkeletonTable rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-textPrimary">Call Scripts</h2>
          <p className="text-textMuted text-sm mt-0.5">{scripts.length} script{scripts.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primaryDk transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Script
        </button>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${filter === cat ? 'bg-primary text-white border-primary' : 'bg-white text-textMuted border-border hover:border-primary/40 hover:text-primary'}`}>
            {cat}
            {cat !== 'All' && <span className="ml-1.5 opacity-60">{scripts.filter(s => s.category === cat).length}</span>}
          </button>
        ))}
      </div>

      {/* Scripts grid */}
      {visible.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-12 text-center shadow-card">
          <p className="text-textMuted text-sm">No scripts in this category.</p>
          <button onClick={() => setCreating(true)} className="mt-3 text-sm text-primary font-semibold hover:underline">Create one</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visible.map(script => {
            const { color, bg } = CAT_COLORS[script.category] || CAT_COLORS.Custom;
            return (
              <div key={script._id}
                className="bg-white border border-border rounded-2xl p-5 shadow-card hover:shadow-card-md transition-shadow flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-textPrimary leading-tight">{script.title}</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ color, background: bg }}>
                        {script.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setPreview(script)}
                      className="p-1.5 text-textMuted hover:text-primary rounded-lg hover:bg-primaryLt transition-colors" title="Preview">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button onClick={() => copy(script.content)}
                      className="p-1.5 text-textMuted hover:text-primary rounded-lg hover:bg-primaryLt transition-colors" title="Copy">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                    <button onClick={() => setEditing(script)}
                      className="p-1.5 text-textMuted hover:text-primary rounded-lg hover:bg-primaryLt transition-colors" title="Edit">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={() => remove(script._id)}
                      className="p-1.5 text-textMuted hover:text-danger rounded-lg hover:bg-dangerLt transition-colors" title="Delete">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>
                </div>
                <p className="text-xs text-textMuted leading-relaxed line-clamp-3 font-mono whitespace-pre-wrap">{script.content}</p>
                <button onClick={() => setPreview(script)}
                  className="text-xs text-primary hover:underline text-left font-medium">
                  Read full script →
                </button>
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <Modal title="New Script" onClose={() => setCreating(false)}>
          <ScriptForm onSave={save} onClose={() => setCreating(false)} saving={saving} />
        </Modal>
      )}

      {editing && (
        <Modal title="Edit Script" onClose={() => setEditing(null)}>
          <ScriptForm initial={editing} onSave={save} onClose={() => setEditing(null)} saving={saving} />
        </Modal>
      )}

      {preview && (
        <Modal title={preview.title} onClose={() => setPreview(null)}>
          <div className="p-5 space-y-4">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ color: (CAT_COLORS[preview.category] || CAT_COLORS.Custom).color, background: (CAT_COLORS[preview.category] || CAT_COLORS.Custom).bg }}>
              {preview.category}
            </span>
            <pre className="text-sm text-textPrimary whitespace-pre-wrap font-sans leading-relaxed bg-bg rounded-xl p-4 border border-border">
              {preview.content}
            </pre>
            <button onClick={() => copy(preview.content)}
              className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primaryDk transition-colors">
              Copy to Clipboard
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
