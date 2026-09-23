'use client';
import { useState, useRef, useEffect, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../../lib/api';
import {
  CheckIco, XIco, DownloadIco, SearchIco, Field,
} from '../../../../components/report-shared';

function Ico({ size = 16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const UploadIco = ({ s = 40 }) => <Ico size={s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></Ico>;
const FileIco   = ({ s = 26 }) => <Ico size={s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></Ico>;
const AlertIco  = ({ s = 18 }) => <Ico size={s}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></Ico>;

const STEPS = [
  { n: 1, label: 'Import CSV File' },
  { n: 2, label: 'Map Fields' },
  { n: 3, label: 'Validate CSV Data' },
  { n: 4, label: 'Actions' },
  { n: 5, label: 'Summary' },
];

const MAX_ROWS = 5000;

const SYSTEM_FIELDS = [
  { key: '',       label: '— Do not import —' },
  { key: 'name',   label: 'Name', required: true },
  { key: 'phone',  label: 'Phone Number', required: true },
  { key: 'email',  label: 'Email' },
  { key: 'source', label: 'Source' },
  { key: 'tags',   label: 'Tags' },
  { key: 'notes',  label: 'Notes' },
];

const STATUS_OPTIONS = [
  { key: 'new', label: 'New' },
  { key: 'not_connected', label: 'Not Connected' },
  { key: 'low', label: 'Low' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'engaged', label: 'Engaged' },
  { key: 'interested', label: 'Interested' },
  { key: 'warm', label: 'Warm / Strong Interest' },
  { key: 'hot', label: 'Hot' },
  { key: 'high_engagement', label: 'High Engagement' },
  { key: 'not_interested', label: 'Not Interested' },
  { key: 'follow_up', label: 'Follow-up' },
  { key: 'booking_done', label: 'Booking Done' },
  { key: 'converted', label: 'Converted' },
  { key: 'lost', label: 'Lost' },
];

/* ── CSV helpers ─────────────────────────────────────────── */
function splitCSVLine(line) {
  const out = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const rawHeaders = splitCSVLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) => {
    const vals = splitCSVLine(line).map((v) => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    rawHeaders.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
  return { headers: rawHeaders, rows };
}
function guessField(header) {
  const h = header.toLowerCase();
  if (/^name$|full.?name|lead.?name/.test(h)) return 'name';
  if (/phone|mobile|contact|number/.test(h)) return 'phone';
  if (/email/.test(h)) return 'email';
  if (/source/.test(h)) return 'source';
  if (/tag/.test(h)) return 'tags';
  if (/note|remark/.test(h)) return 'notes';
  return '';
}
function normalizePhoneClient(num) {
  if (!num) return '';
  const digits = String(num).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}
function isValidPhone(num) { return /^[6-9]\d{9}$/.test(normalizePhoneClient(num)); }

function downloadCSV(filename, rows) {
  const blob = new Blob([rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function downloadTemplate() {
  downloadCSV('leads-template.csv', [
    ['name', 'phone', 'email', 'source', 'tags', 'notes'],
    ['John Doe', '9876543210', 'john@example.com', 'Website', 'hot;walk-in', 'Initial contact'],
  ]);
}

/* ── Step indicator ──────────────────────────────────────── */
function StepBar({ step }) {
  return (
    <div className="flex items-center">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
              ${step > s.n ? 'bg-blue-600 border-blue-600 text-white' : step === s.n ? 'bg-gray-900 border-blue-500 text-white' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
              {step > s.n ? <CheckIco s={16} /> : s.n}
            </div>
            <span className={`text-[11px] font-medium mt-1.5 whitespace-nowrap ${step >= s.n ? 'text-gray-900' : 'text-gray-400'}`}>{s.label}</span>
          </div>
          {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 mx-2 mb-5 ${step > s.n ? 'bg-blue-500' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  );
}

/* ── Tag chip input ──────────────────────────────────────── */
function TagInput({ tags, setTags, placeholder = 'Add tags & hit Enter' }) {
  const [val, setVal] = useState('');
  const add = () => {
    const t = val.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setVal('');
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
            {t}
            <button onClick={() => setTags(tags.filter((x) => x !== t))} className="hover:text-blue-900"><XIco s={10} /></button>
          </span>
        ))}
      </div>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={placeholder}
        className="form-input"
      />
      <p className="text-[11px] text-gray-400 mt-1">Provide multiple tags separated by Enter</p>
    </div>
  );
}

export default function LeadsUploadsPage() {
  const [step, setStep] = useState(1);
  const inputRef = useRef();

  // Step 1
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [parseError, setParseError] = useState('');

  // Step 2
  const [fieldMap, setFieldMap] = useState({}); // { csvHeader: systemFieldKey }

  // Step 3
  const [validRows, setValidRows] = useState([]);
  const [invalidRows, setInvalidRows] = useState([]);
  const [capExceeded, setCapExceeded] = useState(false);

  // Step 4
  const [assignMode, setAssignMode] = useState('employee'); // 'employee' | 'tag'
  const [employees, setEmployees] = useState([]);
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [autoSplit, setAutoSplit] = useState(false);
  const [tagModeValue, setTagModeValue] = useState('');
  const [duplicateStrategy, setDuplicateStrategy] = useState('skip');
  const [defaultStatus, setDefaultStatus] = useState('new');
  const [globalTags, setGlobalTags] = useState([]);

  // Step 5 / result
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (step === 4 && assignMode === 'employee' && employees.length === 0) {
      api.get('/api/employees').then((r) => setEmployees(r.data?.data || [])).catch(() => {});
    }
  }, [step, assignMode, employees.length]);

  /* ── Step 1: file handling ── */
  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.endsWith('.csv')) { setParseError('Only .csv files are supported.'); return; }
    setParseError('');
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = parseCSV(e.target.result);
      if (!headers.length || !rows.length) { setParseError('This file looks empty.'); return; }
      setCsvHeaders(headers);
      setCsvRows(rows);
      const guessed = {};
      headers.forEach((h) => { guessed[h] = guessField(h); });
      setFieldMap(guessed);
    };
    reader.readAsText(f);
  };
  const handleDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); };
  const resetAll = () => {
    setStep(1); setFile(null); setCsvHeaders([]); setCsvRows([]); setFieldMap({});
    setValidRows([]); setInvalidRows([]); setCapExceeded(false); setResult(null); setSubmitError('');
  };

  /* ── Step 2 → 3: build + validate mapped rows ── */
  const nameHeader = csvHeaders.find((h) => fieldMap[h] === 'name');
  const phoneHeader = csvHeaders.find((h) => fieldMap[h] === 'phone');
  const mappingComplete = !!nameHeader && !!phoneHeader;

  const runValidation = () => {
    if (csvRows.length > MAX_ROWS) { setCapExceeded(true); setStep(3); return; }
    setCapExceeded(false);
    const good = [], bad = [];
    csvRows.forEach((row, i) => {
      const name = (row[nameHeader] || '').trim();
      const phoneRaw = row[phoneHeader] || '';
      const emailH = csvHeaders.find((h) => fieldMap[h] === 'email');
      const sourceH = csvHeaders.find((h) => fieldMap[h] === 'source');
      const tagsH = csvHeaders.find((h) => fieldMap[h] === 'tags');
      const notesH = csvHeaders.find((h) => fieldMap[h] === 'notes');
      const mapped = {
        name,
        phone: phoneRaw,
        email: emailH ? row[emailH] : '',
        source: sourceH ? row[sourceH] : '',
        tags: tagsH ? row[tagsH].split(';').map((t) => t.trim()).filter(Boolean) : [],
        notes: notesH ? row[notesH] : '',
      };
      if (!name) bad.push({ rowNumber: i + 2, reason: 'Name is missing' });
      else if (!isValidPhone(phoneRaw)) bad.push({ rowNumber: i + 2, reason: `Contact Number '${phoneRaw}' is invalid` });
      else good.push(mapped);
    });
    setValidRows(good);
    setInvalidRows(bad);
    setStep(3);
  };

  const downloadInvalid = () => {
    downloadCSV('invalid-rows.csv', [['Row Number', 'Reason'], ...invalidRows.map((r) => [r.rowNumber, r.reason])]);
  };

  /* ── Step 4 helpers ── */
  const filteredEmployees = employees.filter((e) => e.name?.toLowerCase().includes(empSearch.toLowerCase()));
  const toggleEmployee = (id) => setSelectedEmployees((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const toggleAllEmployees = () => setSelectedEmployees(selectedEmployees.length === filteredEmployees.length ? [] : filteredEmployees.map((e) => e._id));

  const canProceedStep4 = assignMode === 'employee' ? selectedEmployees.length > 0 : tagModeValue.trim().length > 0;

  /* ── Step 5: submit ── */
  const handleImport = async () => {
    setImporting(true); setSubmitError('');
    try {
      const payload = {
        leads: validRows.map((r) => ({
          name: r.name,
          phone: normalizePhoneClient(r.phone),
          email: r.email || undefined,
          source: r.source || undefined,
          tags: r.tags,
          notes: r.notes || undefined,
        })),
        assignment: assignMode === 'employee'
          ? { mode: 'employee', employeeIds: selectedEmployees, autoSplit }
          : { mode: 'tag', tag: tagModeValue.trim() },
        duplicateStrategy,
        defaultStatus,
        tags: globalTags,
      };
      const res = await api.post('/api/leads/bulk-upload', payload);
      setResult(res.data?.data || null);
    } catch (e) {
      setSubmitError(e.response?.data?.error || 'Import failed. Please try again.');
    }
    setImporting(false);
  };

  const employeeNames = employees.filter((e) => selectedEmployees.includes(e._id)).map((e) => e.name);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Import Leads</h1>
        <p className="text-sm text-gray-400 mt-0.5">Bulk import leads from a CSV file in a few guided steps</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <StepBar step={step} />

        <div className="mt-8">
          <AnimatePresence mode="wait">
            {/* ══════════ STEP 1 ══════════ */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                    <h3 className="font-bold text-sm text-gray-900 mb-3">Please consider the following while uploading</h3>
                    <ul className="space-y-2 text-xs text-gray-600">
                      <li className="flex gap-2"><span className="text-blue-600 mt-0.5 shrink-0"><CheckIco s={13} /></span> Name and Phone Number are mandatory columns.</li>
                      <li className="flex gap-2"><span className="text-blue-600 mt-0.5 shrink-0"><CheckIco s={13} /></span> For multiple tags in one cell, separate with a semicolon (;).</li>
                      <li className="flex gap-2"><span className="text-blue-600 mt-0.5 shrink-0"><CheckIco s={13} /></span> Maximum {MAX_ROWS.toLocaleString()} leads per upload.</li>
                      <li className="flex gap-2"><span className="text-blue-600 mt-0.5 shrink-0"><CheckIco s={13} /></span> Only .csv files are supported.</li>
                    </ul>
                    <button onClick={downloadTemplate} className="btn-secondary mt-4 text-xs py-1.5 px-3"><DownloadIco s={12} /> Download Template</button>
                  </div>

                  <div
                    className={`rounded-xl border-2 border-dashed p-8 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[200px] ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50/40'}`}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                  >
                    <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
                    {file ? (
                      <>
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 bg-blue-50 text-blue-600"><FileIco /></div>
                        <p className="font-bold text-sm text-gray-900">{file.name}</p>
                        <p className="text-xs mt-1 text-gray-400">{(file.size / 1024).toFixed(1)} KB · {csvRows.length} rows detected</p>
                        <button onClick={(e) => { e.stopPropagation(); setFile(null); setCsvHeaders([]); setCsvRows([]); }} className="mt-3 text-xs font-semibold text-red-600 hover:underline">Remove</button>
                      </>
                    ) : (
                      <>
                        <div className={dragging ? 'text-blue-600 mb-3' : 'text-gray-400 mb-3'}><UploadIco /></div>
                        <p className="font-bold text-sm text-gray-900">Drag & Drop CSV file</p>
                        <p className="text-xs mt-1 text-gray-400">or click to browse · comma separated values</p>
                      </>
                    )}
                  </div>
                </div>

                {parseError && <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg p-3">{parseError}</div>}

                <div className="flex justify-end">
                  <button disabled={!csvRows.length} onClick={() => setStep(2)} className="btn-primary disabled:opacity-40">Next →</button>
                </div>
              </motion.div>
            )}

            {/* ══════════ STEP 2 ══════════ */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-600">Map each column from your CSV to a lead field. <strong>Name</strong> and <strong>Phone Number</strong> are mandatory — unmapped columns will be ignored.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400 sm:col-span-1">Field(s) in your CSV</p>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400 sm:col-span-1">Map to lead field</p>
                  {csvHeaders.map((h) => (
                    <Fragment key={h}>
                      <div className="flex items-center text-sm font-medium text-gray-800 py-1.5">{h}</div>
                      <select value={fieldMap[h] || ''} onChange={(e) => setFieldMap({ ...fieldMap, [h]: e.target.value })} className="form-input">
                        {SYSTEM_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>)}
                      </select>
                    </Fragment>
                  ))}
                </div>

                {!mappingComplete && <p className="text-xs text-red-600">Map at least one column each to Name and Phone Number to continue.</p>}

                <div className="flex justify-between">
                  <button onClick={() => setStep(1)} className="btn-secondary">← Back</button>
                  <button disabled={!mappingComplete} onClick={runValidation} className="btn-primary disabled:opacity-40">Next →</button>
                </div>
              </motion.div>
            )}

            {/* ══════════ STEP 3 ══════════ */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                {capExceeded ? (
                  <>
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4">
                      <AlertIco s={18} /> Sorry! You can upload a maximum of {MAX_ROWS.toLocaleString()} leads at a time. Your file has {csvRows.length.toLocaleString()} rows.
                    </div>
                    <div className="flex justify-between">
                      <button onClick={() => setStep(2)} className="btn-secondary">← Back</button>
                      <button onClick={resetAll} className="btn-secondary">Cancel</button>
                    </div>
                  </>
                ) : invalidRows.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4">
                      <AlertIco s={18} /> The CSV file contains invalid lead data in {invalidRows.length} row{invalidRows.length === 1 ? '' : 's'}.
                    </div>
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead><tr className="bg-gray-50 text-xs uppercase text-gray-500"><th className="text-left px-4 py-2.5">Row Number</th><th className="text-left px-4 py-2.5">Invalid Fields</th></tr></thead>
                        <tbody className="divide-y divide-gray-100">
                          {invalidRows.slice(0, 50).map((r, i) => (
                            <tr key={i}><td className="px-4 py-2 text-gray-600">{r.rowNumber}</td><td className="px-4 py-2 text-gray-600">{r.reason}</td></tr>
                          ))}
                        </tbody>
                      </table>
                      {invalidRows.length > 50 && <p className="text-xs text-gray-400 px-4 py-2 bg-gray-50">+{invalidRows.length - 50} more — download the full list below.</p>}
                    </div>
                    <button onClick={downloadInvalid} className="btn-secondary text-xs"><DownloadIco s={12} /> Download Invalid Rows</button>
                    <div className="flex justify-between">
                      <div className="flex gap-2">
                        <button onClick={() => setStep(2)} className="btn-secondary">← Back</button>
                        <button onClick={resetAll} className="btn-secondary">Cancel</button>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={resetAll} className="btn-secondary">← Correct CSV and Import Again</button>
                        <button disabled={!validRows.length} onClick={() => setStep(4)} className="btn-primary disabled:opacity-40">
                          Ignore Those Rows and Import → ({validRows.length} valid)
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg p-4">
                      <CheckIco s={18} /> All {validRows.length} rows look good — no invalid phone numbers found.
                    </div>
                    <div className="flex justify-between">
                      <button onClick={() => setStep(2)} className="btn-secondary">← Back</button>
                      <button onClick={() => setStep(4)} className="btn-primary">Next →</button>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* ══════════ STEP 4 ══════════ */}
            {step === 4 && (
              <motion.div key="s4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left: Lead Configuration */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-sm text-gray-900 border-l-4 border-blue-600 pl-3">Lead Configuration</h3>
                    <Field label="Assign Lead(s) To *">
                      <select className="form-input" value={assignMode} onChange={(e) => setAssignMode(e.target.value)}>
                        <option value="employee">Specific Employee(s)</option>
                        <option value="tag">Specific Tag(s)</option>
                      </select>
                    </Field>

                    {assignMode === 'employee' ? (
                      <>
                        <Field label="Select Employee(s) *">
                          <div className="border border-gray-200 rounded-lg">
                            <div className="p-2 border-b border-gray-100">
                              <div className="relative">
                                <input value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} placeholder="Search…" className="form-input pl-8 py-1.5 text-xs" />
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"><SearchIco /></span>
                              </div>
                            </div>
                            <label className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 text-xs font-semibold cursor-pointer hover:bg-gray-50">
                              <input type="checkbox" checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0} onChange={toggleAllEmployees} />
                              Select All
                            </label>
                            <div className="max-h-48 overflow-y-auto">
                              {filteredEmployees.map((e) => (
                                <label key={e._id} className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-gray-50">
                                  <input type="checkbox" checked={selectedEmployees.includes(e._id)} onChange={() => toggleEmployee(e._id)} />
                                  {e.name}{e.phone ? ` (+91-${e.phone})` : ''}
                                </label>
                              ))}
                              {filteredEmployees.length === 0 && <p className="text-xs text-gray-400 px-3 py-3">No employees found</p>}
                            </div>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-1">Lead(s) will be assigned to the selected employee(s).</p>
                        </Field>
                        {selectedEmployees.length > 1 && (
                          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={autoSplit} onChange={(e) => setAutoSplit(e.target.checked)} />
                            Auto Split Leads (round-robin across {selectedEmployees.length} employees)
                          </label>
                        )}
                        {selectedEmployees.length > 1 && !autoSplit && (
                          <p className="text-[11px] text-amber-600">Without auto-split, every lead is assigned to the first selected employee ({employeeNames[0]}).</p>
                        )}
                      </>
                    ) : (
                      <Field label="Tag *">
                        <input value={tagModeValue} onChange={(e) => setTagModeValue(e.target.value)} placeholder="e.g. Website Leads" className="form-input" />
                        <p className="text-[11px] text-gray-400 mt-1">Leads are imported unassigned, tagged for manual pickup — this system doesn't yet support tag-based auto-routing.</p>
                      </Field>
                    )}
                  </div>

                  {/* Right: Duplicate handling + status + tags */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-sm text-gray-900 border-l-4 border-blue-600 pl-3">How should we handle duplicate leads? *</h3>
                    <div className="space-y-3">
                      {[
                        { key: 'skip', title: 'Keep existing and ignore new assignments', desc: 'If an uploaded phone number already exists, the existing lead and its assignment stay untouched.' },
                        { key: 'replace', title: 'Remove existing and add new assignments', desc: 'If an uploaded phone number already exists, it gets reassigned to the new employee(s)/tag chosen here.' },
                        { key: 'both', title: 'Keep Existing and add new assignments', desc: "Not supported yet — a lead can only have one assignee in this system. Choose one of the options above instead.", disabled: true },
                      ].map((opt) => (
                        <label key={opt.key} className={`flex gap-2.5 p-3 rounded-lg border ${opt.disabled ? 'opacity-50 cursor-not-allowed border-gray-100' : 'border-gray-200 cursor-pointer hover:border-blue-300'} ${duplicateStrategy === opt.key ? 'border-blue-400 bg-blue-50/50' : ''}`}>
                          <input type="radio" className="mt-1" disabled={opt.disabled} checked={duplicateStrategy === opt.key} onChange={() => setDuplicateStrategy(opt.key)} />
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{opt.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>

                    <Field label="Choose Default Lead Status">
                      <select className="form-input" value={defaultStatus} onChange={(e) => setDefaultStatus(e.target.value)}>
                        {STATUS_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                      <p className="text-[11px] text-gray-400 mt-1">Applied to newly created leads only — existing leads keep their current status.</p>
                    </Field>

                    <Field label="Add Tags to Organize Leads">
                      <TagInput tags={globalTags} setTags={setGlobalTags} />
                    </Field>
                  </div>
                </div>

                <div className="flex justify-between border-t border-gray-100 pt-4">
                  <button onClick={() => setStep(3)} className="btn-secondary">← Back</button>
                  <button disabled={!canProceedStep4} onClick={() => setStep(5)} className="btn-primary disabled:opacity-40">Next →</button>
                </div>
              </motion.div>
            )}

            {/* ══════════ STEP 5 ══════════ */}
            {step === 5 && (
              <motion.div key="s5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                {!result ? (
                  <>
                    <h3 className="font-bold text-sm text-gray-900">Review before importing</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-gray-50 rounded-lg p-3"><p className="text-2xl font-extrabold text-gray-900">{validRows.length}</p><p className="text-xs text-gray-400">Leads to import</p></div>
                      <div className="bg-gray-50 rounded-lg p-3"><p className="text-sm font-bold text-gray-900">{assignMode === 'employee' ? `${selectedEmployees.length} employee(s)` : `Tag: ${tagModeValue}`}</p><p className="text-xs text-gray-400">Assignment</p></div>
                      <div className="bg-gray-50 rounded-lg p-3"><p className="text-sm font-bold text-gray-900 capitalize">{duplicateStrategy === 'skip' ? 'Keep existing' : 'Replace existing'}</p><p className="text-xs text-gray-400">Duplicate handling</p></div>
                      <div className="bg-gray-50 rounded-lg p-3"><p className="text-sm font-bold text-gray-900">{STATUS_OPTIONS.find((s) => s.key === defaultStatus)?.label}</p><p className="text-xs text-gray-400">Default status</p></div>
                    </div>
                    {assignMode === 'employee' && (
                      <p className="text-xs text-gray-500">Assigning to: <span className="font-medium text-gray-700">{employeeNames.join(', ')}</span>{selectedEmployees.length > 1 && (autoSplit ? ' (auto-split round robin)' : ` (all to ${employeeNames[0]})`)}</p>
                    )}
                    {globalTags.length > 0 && <p className="text-xs text-gray-500">Tags applied to all: {globalTags.join(', ')}</p>}

                    {submitError && <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg p-3">{submitError}</div>}

                    <div className="flex justify-between">
                      <button onClick={() => setStep(4)} className="btn-secondary">← Back</button>
                      <button onClick={handleImport} disabled={importing} className="btn-primary px-8 disabled:opacity-70">
                        {importing ? 'Importing…' : `Import ${validRows.length} Leads`}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl border border-gray-200 border-l-4 border-l-emerald-600 bg-emerald-50 p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-600 text-white"><CheckIco s={16} /></div>
                        <p className="font-bold text-sm text-emerald-700">Import Complete</p>
                      </div>
                      <div className="flex gap-6 flex-wrap">
                        <div><p className="text-2xl font-extrabold tabular-nums text-emerald-700">{result.inserted || 0}</p><p className="text-xs text-gray-500">Imported</p></div>
                        {result.updated > 0 && <div><p className="text-2xl font-extrabold tabular-nums text-blue-600">{result.updated}</p><p className="text-xs text-gray-500">Reassigned</p></div>}
                        {result.skipped > 0 && <div><p className="text-2xl font-extrabold tabular-nums text-gray-500">{result.skipped}</p><p className="text-xs text-gray-500">Skipped (duplicates)</p></div>}
                        {result.errors > 0 && <div><p className="text-2xl font-extrabold tabular-nums text-red-600">{result.errors}</p><p className="text-xs text-gray-500">Errors</p></div>}
                        <div><p className="text-2xl font-extrabold tabular-nums text-gray-900">{result.total || 0}</p><p className="text-xs text-gray-500">Total Processed</p></div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button onClick={resetAll} className="btn-primary">Import Another File</button>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}