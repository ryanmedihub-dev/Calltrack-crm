'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../../lib/api';
import useIsAdmin from '../../../lib/useIsAdmin';

const CATEGORIES = ['All', 'Intro', 'Follow-Up', 'Objection', 'Closing', 'Custom'];

const CAT_COLORS = {
  Intro:       { color:'#2563EB', bg:'#EFF6FF' },
  'Follow-Up': { color:'#16A34A', bg:'#F0FDF4' },
  Objection:   { color:'#D97706', bg:'#FFFBEB' },
  Closing:     { color:'#7C3AED', bg:'#F5F3FF' },
  Custom:      { color:'#64748B', bg:'#F8FAFC' },
};

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background:'rgba(0,0,0,0.50)', backdropFilter:'blur(5px)' }}>
      <div className="rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col"
        style={{ background:'#fff', border:'1px solid #E2E8F0', boxShadow:'0 20px 60px rgba(0,0,0,0.18)' }}>
        <div className="flex items-center justify-between p-5 flex-shrink-0" style={{ borderBottom:'1px solid #E2E8F0' }}>
          <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>{title}</h3>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-lg"
            style={{ color:'#94A3B8' }}
            onMouseEnter={e=>{ e.currentTarget.style.background='#FFF1F2'; e.currentTarget.style.color='#EF4444'; }}
            onMouseLeave={e=>{ e.currentTarget.style.background=''; e.currentTarget.style.color='#94A3B8'; }}>
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
    title:    initial?.title||'',
    category: initial?.category||'Custom',
    content:  initial?.content||'',
  });

  const submit = () => {
    if (!form.title.trim())   return toast.error('Title is required');
    if (!form.content.trim()) return toast.error('Script content is required');
    onSave(form);
  };

  return (
    <div className="p-5 space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'#64748B' }}>Title</label>
        <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}
          placeholder="e.g. Cold Call Opener" className="form-input"/>
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'#64748B' }}>Category</label>
        <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="form-input">
          {CATEGORIES.filter(c=>c!=='All').map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'#64748B' }}>Script Content</label>
        <textarea value={form.content} onChange={e=>setForm({...form,content:e.target.value})}
          rows={10} placeholder="Write your script here. Use [placeholders] for dynamic values."
          className="form-input resize-none font-mono text-xs leading-relaxed"/>
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} disabled={saving} className="btn-primary flex-1 justify-center" style={{ opacity:saving?0.65:1 }}>
          {saving?'Saving…':'Save Script'}
        </button>
      </div>
    </div>
  );
}

export default function ScriptsPage() {
  const isAdmin = useIsAdmin();
  const [scripts,  setScripts]  = useState([]);
  const [filter,   setFilter]   = useState('All');
  const [editing,  setEditing]  = useState(null);
  const [creating, setCreating] = useState(false);
  const [preview,  setPreview]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  const fetchScripts = async () => {
    try { const res = await api.get('/api/scripts'); setScripts(res.data.data||[]); }
    catch { toast.error('Failed to load scripts'); }
    setLoading(false);
  };

  useEffect(() => { fetchScripts(); }, []);

  const save = async (form) => {
    setSaving(true);
    try {
      if (editing) {
        const res = await api.put(`/api/scripts/${editing._id}`, form);
        setScripts(prev=>prev.map(s=>s._id===editing._id?res.data.data:s));
        toast.success('Script updated');
      } else {
        const res = await api.post('/api/scripts', form);
        setScripts(prev=>[res.data.data,...prev]);
        toast.success('Script created');
      }
      setEditing(null); setCreating(false);
    } catch { toast.error('Failed to save script'); }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!confirm('Delete this script?')) return;
    try {
      await api.delete(`/api/scripts/${id}`);
      setScripts(prev=>prev.filter(s=>s._id!==id));
      toast.success('Script deleted');
    } catch { toast.error('Failed to delete script'); }
  };

  const copy = (content) => {
    navigator.clipboard.writeText(content).then(()=>toast.success('Copied to clipboard'));
  };

  const visible = filter==='All' ? scripts : scripts.filter(s=>s.category===filter);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-8 w-48 rounded-lg"/>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{[1,2,3,4].map(i=><div key={i} className="skeleton h-40 rounded-xl"/>)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Call Scripts</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>{scripts.length} script{scripts.length!==1?'s':''}</p>
        </div>
        {isAdmin && <button onClick={()=>setCreating(true)} className="btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Script
        </button>}
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat=>{
          const active = filter===cat;
          return (
            <button key={cat} onClick={()=>setFilter(cat)}
              className="px-3.5 h-8 flex items-center rounded-full text-xs font-semibold transition-all"
              style={active
                ? { background:'#2563EB', color:'#fff', border:'1px solid #2563EB' }
                : { background:'#fff', color:'#64748B', border:'1px solid #E2E8F0' }}
              onMouseEnter={e=>{ if(!active){ e.currentTarget.style.borderColor='#BFDBFE'; e.currentTarget.style.color='#2563EB'; } }}
              onMouseLeave={e=>{ if(!active){ e.currentTarget.style.borderColor='#E2E8F0'; e.currentTarget.style.color='#64748B'; } }}>
              {cat}
              {cat!=='All'&&<span className="ml-1.5 opacity-60">{scripts.filter(s=>s.category===cat).length}</span>}
            </button>
          );
        })}
      </div>

      {/* Scripts grid */}
      {visible.length === 0 ? (
        <div className="page-card p-12 text-center">
          <p className="text-sm" style={{ color:'#94A3B8' }}>No scripts in this category.</p>
          {isAdmin && <button onClick={()=>setCreating(true)} className="mt-3 text-sm font-semibold" style={{ color:'#2563EB' }}>Create one</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger">
          {visible.map(script=>{
            const { color, bg } = CAT_COLORS[script.category]||CAT_COLORS.Custom;
            return (
              <div key={script._id} className="page-card p-5 flex flex-col gap-3"
                onMouseEnter={e=>e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.10)'}
                onMouseLeave={e=>e.currentTarget.style.boxShadow=''}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm leading-tight" style={{ color:'#0F172A' }}>{script.title}</h3>
                      <span className="badge text-[10px] font-bold flex-shrink-0" style={{ color, background:bg }}>
                        {script.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {[
                      { icon:'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', extra:<circle cx="12" cy="12" r="3"/>, title:'Preview', onClick:()=>setPreview(script), danger:false },
                      { icon:'M9 9h13v13H9z', extra:<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>, title:'Copy', onClick:()=>copy(script.content), danger:false },
                      { icon:'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7', extra:<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>, title:'Edit', onClick:()=>setEditing(script), danger:false },
                      { icon:'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2', title:'Delete', onClick:()=>remove(script._id), danger:true },
                    ].filter((btn)=>isAdmin || btn.title==='Preview' || btn.title==='Copy').map((btn,bi)=>(
                      <button key={bi} onClick={btn.onClick} title={btn.title}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color:'#94A3B8' }}
                        onMouseEnter={e=>{ e.currentTarget.style.background=btn.danger?'#FFF1F2':'#EFF6FF'; e.currentTarget.style.color=btn.danger?'#EF4444':'#2563EB'; }}
                        onMouseLeave={e=>{ e.currentTarget.style.background=''; e.currentTarget.style.color='#94A3B8'; }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d={btn.icon}/>{btn.extra}
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs leading-relaxed line-clamp-3 font-mono whitespace-pre-wrap" style={{ color:'#94A3B8' }}>{script.content}</p>
                <button onClick={()=>setPreview(script)} className="text-xs font-medium text-left" style={{ color:'#2563EB' }}>
                  Read full script →
                </button>
              </div>
            );
          })}
        </div>
      )}

      {creating && <Modal title="New Script" onClose={()=>setCreating(false)}><ScriptForm onSave={save} onClose={()=>setCreating(false)} saving={saving}/></Modal>}
      {editing  && <Modal title="Edit Script" onClose={()=>setEditing(null)}><ScriptForm initial={editing} onSave={save} onClose={()=>setEditing(null)} saving={saving}/></Modal>}

      {preview && (
        <Modal title={preview.title} onClose={()=>setPreview(null)}>
          <div className="p-5 space-y-4">
            <span className="badge text-xs font-bold"
              style={{ color:(CAT_COLORS[preview.category]||CAT_COLORS.Custom).color, background:(CAT_COLORS[preview.category]||CAT_COLORS.Custom).bg }}>
              {preview.category}
            </span>
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed rounded-xl p-4"
              style={{ color:'#0F172A', background:'#F8FAFC', border:'1px solid #E2E8F0' }}>
              {preview.content}
            </pre>
            <button onClick={()=>copy(preview.content)} className="btn-primary w-full justify-center">
              Copy to Clipboard
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
