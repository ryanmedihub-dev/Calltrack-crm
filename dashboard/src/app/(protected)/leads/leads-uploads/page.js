'use client';
import { useState, useRef } from 'react';
import api from '../../../../lib/api';

function Ico({ size=16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const UploadIco  = ({s=48}) => <Ico size={s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></Ico>;
const FileIco    = ({s=16}) => <Ico size={s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></Ico>;
const CheckIco   = ({s=16}) => <Ico size={s}><polyline points="20 6 9 17 4 12"/></Ico>;
const DownloadIco= ({s=14}) => <Ico size={s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Ico>;

const REQUIRED_COLS = ['name','phone'];
const OPTIONAL_COLS = ['email','source','status','assignedTo','notes'];

function downloadTemplate() {
  const headers = [...REQUIRED_COLS, ...OPTIONAL_COLS].join(',');
  const example = 'John Doe,+919876543210,john@example.com,Website,new,,Initial contact';
  const csv     = `${headers}\n${example}`;
  const blob    = new Blob([csv], { type:'text/csv' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a'); a.href=url; a.download='leads-template.csv'; a.click();
}

function parseCSV(text) {
  const lines   = text.trim().split('\n');
  const headers = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/\s+/g,'_'));
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj  = {};
    headers.forEach((h,i) => { obj[h] = (vals[i]||'').trim(); });
    return obj;
  }).filter(r => r.name||r.phone);
}

export default function LeadsUploadsPage() {
  const [file,      setFile]      = useState(null);
  const [preview,   setPreview]   = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState('');
  const [dragging,  setDragging]  = useState(false);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.endsWith('.csv')) { setError('Only .csv files are supported.'); return; }
    setError(''); setResult(null);
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const rows = parseCSV(e.target.result);
      setPreview(rows.slice(0,5));
    };
    reader.readAsText(f);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true); setError(''); setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const r = await api.post('/api/leads/upload', formData, {
        headers: { 'Content-Type':'multipart/form-data' },
      });
      setResult(r.data?.data||{ imported:0, failed:0, total:0 });
      setFile(null); setPreview([]);
    } catch (e) {
      setError(e.response?.data?.error||'Upload failed. Please check your CSV format and try again.');
    }
    setUploading(false);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Leads Upload</h2>
        <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Bulk import leads from a CSV file</p>
      </div>

      {/* Instructions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { step:'1', title:'Download Template', desc:'Get the CSV template with the correct column format', action:downloadTemplate, btn:'Download Template' },
          { step:'2', title:'Fill in Your Data', desc:'Add your leads with name, phone and optional fields', action:null, btn:null },
          { step:'3', title:'Upload & Import', desc:'Drop your file below and click Import', action:null, btn:null },
        ].map((s,i)=>(
          <div key={i} className="page-card p-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-black mb-3"
              style={{ background:'linear-gradient(135deg,#2563EB,#60A5FA)' }}>{s.step}</div>
            <p className="font-bold text-sm" style={{ color:'#0F172A' }}>{s.title}</p>
            <p className="text-xs mt-1" style={{ color:'#94A3B8' }}>{s.desc}</p>
            {s.action && (
              <button onClick={s.action} className="btn-secondary mt-3 text-xs py-1.5 px-3">
                <DownloadIco s={12}/> {s.btn}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* CSV format info */}
      <div className="page-card p-5">
        <h3 className="font-bold text-sm mb-3" style={{ color:'#0F172A' }}>CSV Format</h3>
        <div className="flex flex-wrap gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color:'#DC2626' }}>Required Columns</p>
            <div className="flex gap-1.5 flex-wrap">
              {REQUIRED_COLS.map(c=>(
                <span key={c} className="badge" style={{ background:'#FFF1F2', color:'#DC2626', border:'1px solid #FECACA' }}>{c}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color:'#94A3B8' }}>Optional Columns</p>
            <div className="flex gap-1.5 flex-wrap">
              {OPTIONAL_COLS.map(c=>(
                <span key={c} className="badge" style={{ background:'#F1F5F9', color:'#64748B', border:'1px solid #CBD5E1' }}>{c}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 p-3 rounded-lg font-mono text-xs overflow-x-auto" style={{ background:'#F8FAFC', color:'#475569', border:'1px solid #E2E8F0' }}>
          name,phone,email,source,status<br/>
          John Doe,+919876543210,john@example.com,Website,new<br/>
          Jane Smith,+919123456789,jane@company.com,Referral,contacted
        </div>
      </div>

      {/* Drop zone */}
      <div
        className="page-card p-10 flex flex-col items-center justify-center cursor-pointer transition-all"
        style={{ border:`2px dashed ${dragging?'#2563EB':'#CBD5E1'}`, background:dragging?'#EFF6FF':'#FAFBFC', minHeight:200 }}
        onDragOver={e=>{e.preventDefault();setDragging(true);}}
        onDragLeave={()=>setDragging(false)}
        onDrop={handleDrop}
        onClick={()=>inputRef.current?.click()}>
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={e=>handleFile(e.target.files[0])}/>
        {file ? (
          <>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background:'#EFF6FF', color:'#2563EB' }}>
              <FileIco s={26}/>
            </div>
            <p className="font-bold text-sm" style={{ color:'#0F172A' }}>{file.name}</p>
            <p className="text-xs mt-1" style={{ color:'#94A3B8' }}>{(file.size/1024).toFixed(1)} KB · {preview.length}+ rows detected</p>
            <button onClick={e=>{e.stopPropagation();setFile(null);setPreview([]);}} className="mt-3 text-xs font-semibold" style={{ color:'#DC2626' }}>Remove</button>
          </>
        ) : (
          <>
            <div className="mb-3" style={{ color:dragging?'#2563EB':'#94A3B8' }}>
              <UploadIco s={40}/>
            </div>
            <p className="font-bold text-sm" style={{ color:'#0F172A' }}>Drop your CSV here or click to browse</p>
            <p className="text-xs mt-1" style={{ color:'#94A3B8' }}>Supports .csv files only · Max 10MB</p>
          </>
        )}
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="page-card overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
            <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Preview (first {preview.length} rows)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr>{Object.keys(preview[0]).map(k=><th key={k}>{k}</th>)}</tr></thead>
              <tbody>
                {preview.map((r,i)=>(
                  <tr key={i}>{Object.values(r).map((v,j)=><td key={j} className="text-xs">{v||'—'}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && <div className="page-card p-4 text-xs" style={{ background:'#FFF1F2', color:'#DC2626', border:'1px solid #FECACA' }}>{error}</div>}

      {/* Result */}
      {result && (
        <div className="page-card p-5" style={{ borderLeft:'4px solid #16A34A', background:'#F0FDF4' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background:'#16A34A', color:'#fff' }}>
              <CheckIco s={16}/>
            </div>
            <p className="font-bold text-sm" style={{ color:'#16A34A' }}>Upload Complete!</p>
          </div>
          <div className="flex gap-6">
            <div><p className="text-2xl font-extrabold tabular-nums" style={{ color:'#16A34A' }}>{result.imported||0}</p><p className="text-xs" style={{ color:'#64748B' }}>Imported</p></div>
            {result.failed > 0 && <div><p className="text-2xl font-extrabold tabular-nums" style={{ color:'#DC2626' }}>{result.failed}</p><p className="text-xs" style={{ color:'#64748B' }}>Failed</p></div>}
            <div><p className="text-2xl font-extrabold tabular-nums" style={{ color:'#0F172A' }}>{result.total||result.imported||0}</p><p className="text-xs" style={{ color:'#64748B' }}>Total Processed</p></div>
          </div>
        </div>
      )}

      {/* Upload button */}
      {file && (
        <div className="flex justify-end">
          <button onClick={upload} disabled={uploading} className="btn-primary px-8 py-2.5"
            style={{ opacity:uploading?0.7:1 }}>
            {uploading ? 'Importing…' : `Import ${preview.length>0?preview.length+'+':''} Leads`}
          </button>
        </div>
      )}
    </div>
  );
}
