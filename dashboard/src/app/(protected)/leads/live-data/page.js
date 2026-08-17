'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../../../lib/api';
import { fmtDateTime } from '../../../../lib/timezone';
import { DataTable, StatCard, Field, Truncate, Ico } from '../../../../components/report-shared';

const POLL_MS = 10_000;
const MAX_ROWS = 5000; // mirrors MAX_BULK_UPLOAD on the server

const UploadIco   = () => <Ico size={14}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></Ico>;
const RefreshIco  = ({ spinning }) => <Ico size={14} className={spinning ? 'animate-spin' : ''}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></Ico>;
const InboxIco    = () => <Ico size={16}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></Ico>;
const CheckIco    = () => <Ico size={16}><polyline points="20 6 9 17 4 12" /></Ico>;
const LayersIco   = () => <Ico size={16}><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></Ico>;
const ClockIco    = () => <Ico size={16}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></Ico>;

/* ── CSV parsing ───────────────────────────────────────────────────────────────
   Hand-rolled to match the existing import wizard (leads-uploads) rather than pulling in a
   parser dependency. Handles quoted fields containing commas, which a naive split does not. */
function splitCSVLine(line) {
  const out = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }  // escaped quote
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = splitCSVLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) => {
    const vals = splitCSVLine(line).map((v) => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
  return { headers, rows };
}

// These files come from Meta exports, agency sheets and hand-built lists, so accept the common
// spellings instead of forcing one template on people who don't control the export.
const FIELD_PATTERNS = [
  ['name',   /^(name|full[\s_-]?name|lead[\s_-]?name)$/i],
  ['phone',  /^(phone|phone[\s_-]?number|mobile|contact|number)$/i],
  ['email',  /^(email|email[\s_-]?address)$/i],
  ['city',   /^(city|location)$/i],
  ['source', /^(source|campaign|platform)$/i],
];

function mapHeaders(headers) {
  const map = {};
  headers.forEach((h) => {
    const clean = h.trim();
    const hit = FIELD_PATTERNS.find(([, re]) => re.test(clean));
    if (hit && !map[hit[0]]) map[hit[0]] = h;
  });
  return map;
}

function normalizePhoneClient(num) {
  if (!num) return '';
  const digits = String(num).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}
const isValidPhone = (p) => /^[6-9]\d{9}$/.test(normalizePhoneClient(p));

function waitingSince(ts) {
  if (!ts) return '—';
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function LiveDataPage() {
  const [leads, setLeads]       = useState([]);
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]     = useState('');
  const [uploading, setUploading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  // Per-campaign questions differ, so a column per question isn't viable — the answers live in
  // an expandable row instead, leaving the collapsed table exactly as it was.
  const [expandedId, setExpandedId] = useState(null);
  const fileRef = useRef(null);
  const searchRef = useRef('');

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const q = searchRef.current;
      const [poolRes, statsRes] = await Promise.all([
        api.get('/api/lead-pool', { params: { limit: 100, ...(q ? { search: q } : {}) } }),
        api.get('/api/lead-pool/stats').catch(() => null),
      ]);
      setLeads(poolRes.data?.data?.leads || []);
      if (statsRes) setStats(statsRes.data?.data || null);
    } catch {
      // Keep the previous rows. This page is polled continuously and may be left up on a wall
      // display — one failed request must not blank the board.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const iv = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(iv);
  }, [load]);

  // Debounced so typing doesn't fire a request per keystroke on top of the 10s poll.
  useEffect(() => {
    searchRef.current = search;
    const t = setTimeout(() => load(true), 350);
    return () => clearTimeout(t);
  }, [search, load]);

  const handleFile = (file) => {
    if (!file) return;
    if (!/\.(csv|xlsx?)$/i.test(file.name)) {
      toast.error('Upload a .csv file (export XLSX as CSV first)');
      return;
    }
    if (/\.xlsx?$/i.test(file.name)) {
      // Being explicit beats silently parsing binary XLSX as text and producing garbage rows.
      toast.error('XLSX isn\'t supported directly — save the sheet as CSV and re-upload.');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const { headers, rows } = parseCSV(e.target.result);
        if (!rows.length) { toast.error('That file looks empty.'); return; }

        const map = mapHeaders(headers);
        if (!map.phone) {
          toast.error('No phone column found. Expected one of: phone, mobile, contact, number.');
          return;
        }
        if (rows.length > MAX_ROWS) {
          toast.error(`Max ${MAX_ROWS.toLocaleString()} rows per upload — split the file.`);
          return;
        }

        let invalid = 0;
        const payload = [];
        rows.forEach((r) => {
          const phone = r[map.phone];
          if (!isValidPhone(phone)) { invalid++; return; }   // no phone = not a lead
          payload.push({
            name:   (map.name ? r[map.name] : '').trim() || normalizePhoneClient(phone),
            phone:  normalizePhoneClient(phone),
            email:  map.email  ? r[map.email]  : undefined,
            city:   map.city   ? r[map.city]   : undefined,
            source: (map.source ? r[map.source] : '') || 'Upload',
          });
        });

        if (!payload.length) {
          toast.error(`No valid rows — all ${invalid} had a missing or malformed phone number.`);
          return;
        }

        const res = await api.post('/api/leads/bulk-upload', {
          leads: payload,
          assignment: { mode: 'pool' },   // leaves every row unassigned → straight into the pool
          duplicateStrategy: 'skip',
          defaultStatus: 'new',
        });
        const d = res.data?.data || {};
        toast.success(
          `Added ${d.inserted ?? 0} · skipped ${d.skipped ?? 0} duplicate(s) · ${(d.errors ?? 0) + invalid} invalid`
        );
        load(true);
      } catch (err) {
        toast.error(err?.response?.data?.error || 'Upload failed');
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    };
    reader.onerror = () => { toast.error('Could not read that file.'); setUploading(false); };
    reader.readAsText(file);
  };

  const webhookUrl = `${process.env.NEXT_PUBLIC_API_URL || 'https://api.learcrm.com'}/api/lead-pool/meta-webhook`;

  return (
    <div className="min-h-screen">
      <div className="space-y-5">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              Leads <span className="text-gray-300">/</span> <span className="text-gray-500">Live Data</span>
            </p>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5 flex items-center gap-2">
              Live Data
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#FEE2E2', color: '#DC2626' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#DC2626' }} />
                LIVE
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(true)}
              className="flex items-center gap-2 px-3.5 py-2 border border-gray-200 bg-white text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              <RefreshIco spinning={refreshing} /> Refresh
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-3.5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium shadow-sm disabled:opacity-50"
            >
              <UploadIco /> {uploading ? 'Uploading…' : 'Upload leads'}
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Available now"  value={(stats?.available ?? 0).toLocaleString()} color="#2563EB" icon={<InboxIco />} loading={loading} />
          <StatCard label="Attended today" value={(stats?.claimedToday ?? 0).toLocaleString()} color="#16A34A" icon={<CheckIco />} loading={loading} />
          <StatCard label="Sources"        value={(stats?.bySource?.length ?? 0).toLocaleString()} color="#7C3AED" icon={<LayersIco />} loading={loading} />
          <StatCard label="Oldest waiting" value={waitingSince(stats?.oldestWaitingSince)} color="#D97706" icon={<ClockIco />} loading={loading} />
        </div>

        {/* ── Pool table ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Unclaimed leads</h3>
              <p className="text-xs text-gray-400">Any agent can attend these from the app</p>
            </div>
            <div className="w-56">
              <Field label="Search">
                <input
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-blue-400"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name or phone…"
                />
              </Field>
            </div>
          </div>

          <DataTable
            loading={loading}
            showRowNumber
            rows={leads}
            pageSize={25}
            emptyTitle="Pool is empty"
            emptyHint="Upload a CSV or wait for Meta leads to arrive."
            expandedId={expandedId}
            onToggleExpand={(id) => setExpandedId((cur) => (cur === id ? null : id))}
            renderExpanded={(row) => (
              row.extraDetails?.length ? (
                <div className="px-2 py-1">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Form answers
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                    {row.extraDetails.map((d, i) => (
                      <div key={`${d.label}-${i}`}>
                        <p className="text-[11px] text-gray-400">{d.label}</p>
                        <p className="text-sm font-medium text-gray-800 mt-0.5 break-words">{d.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 px-2 py-1">No extra details captured for this lead.</p>
              )
            )}
            columns={[
              { key: 'name',   label: 'Name',   width: 170, render: (r) => <Truncate text={r.name} max={22} /> },
              { key: 'phone',  label: 'Phone',  width: 130, render: (r) => <span className="tabular-nums">{r.phone}</span> },
              {
                key: 'source', label: 'Source', width: 120,
                render: (r) => (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: '#EFF6FF', color: '#2563EB' }}>
                    {r.source || 'Unknown'}
                  </span>
                ),
              },
              { key: 'city', label: 'City', width: 120, render: (r) => r.city ? <Truncate text={r.city} max={16} /> : <span className="text-gray-300">—</span> },
              {
                key: 'tags', label: 'Tags', width: 140, searchable: false, wrap: true,
                render: (r) => (r.tags?.length
                  ? <span className="text-xs text-gray-600">{r.tags.slice(0, 3).join(', ')}</span>
                  : <span className="text-gray-300">—</span>),
              },
              {
                // Without a visible affordance nobody discovers that the row expands.
                key: 'extraDetails', label: 'Details', width: 100, searchable: false, sortable: false,
                render: (r) => (r.extraDetails?.length
                  ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: '#F5F3FF', color: '#7C3AED' }}>
                      {r.extraDetails.length} {expandedId === r._id ? '▴' : '▾'}
                    </span>
                  )
                  : <span className="text-gray-300">—</span>),
              },
              {
                key: 'waiting', label: 'Waiting', width: 90, align: 'right', searchable: false,
                render: (r) => <span className="text-amber-600 font-medium">{waitingSince(r.pooledAt || r.createdAt)}</span>,
              },
              {
                key: 'added', label: 'Added', width: 150, searchable: false,
                render: (r) => fmtDateTime(r.pooledAt || r.createdAt),
              },
            ]}
          />
        </div>

        {/* ── Meta webhook help ── */}
        <div className="bg-white rounded-xl border border-gray-200">
          <button
            onClick={() => setShowHelp((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left"
          >
            <span className="text-sm font-semibold text-gray-800">Connecting Meta lead ads</span>
            <span className="text-xs text-gray-400">{showHelp ? 'Hide' : 'Show'}</span>
          </button>
          {showHelp && (
            <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-3 text-xs text-gray-600">
              <p>Point your Meta lead-ads integration (or any middleware, e.g. Zapier/Make) at this endpoint. Leads arrive unassigned and appear in the pool immediately.</p>
              <div>
                <p className="font-semibold text-gray-700 mb-1">Endpoint</p>
                <code className="block bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 break-all">POST {webhookUrl}</code>
              </div>
              <div>
                <p className="font-semibold text-gray-700 mb-1">Auth header</p>
                <code className="block bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 break-all">X-Webhook-Token: &lt;META_WEBHOOK_TOKEN&gt;</code>
                <p className="mt-1 text-gray-400">Set <code>META_WEBHOOK_TOKEN</code> in the backend env. Until it is set, the endpoint rejects everything.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700 mb-1">Body</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 overflow-x-auto">{`{ "name": "Asha R", "phone": "9876543210", "city": "Jaipur", "email": "a@b.com" }

// or a batch:
{ "leads": [ { "name": "...", "phone": "..." }, ... ] }`}</pre>
              </div>
              <p className="text-gray-400">
                Verification handshake: Meta calls <code>GET {webhookUrl}</code> with <code>hub.verify_token</code>, matched against <code>META_VERIFY_TOKEN</code>.
                Duplicate phone numbers are skipped, never re-pooled — an existing lead may already be assigned and actively worked.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
