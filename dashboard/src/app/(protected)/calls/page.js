'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../lib/api';
import CallTypeBadge from '../../../components/CallTypeBadge';
import Pagination from '../../../components/Pagination';

function formatDuration(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}


function CreateLeadModal({ call, employees, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: call?.contactName && call.contactName !== 'Unknown' ? call.contactName : '',
    phone: call?.contactNumber || '',
    email: '', source: 'Call', assignedTo: '', status: 'new'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/api/leads/from-call', { ...form, callId: call?._id });
      const msg = res.data.message || 'Lead created';
      toast.success(msg);
      onCreated(res.data.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create lead');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border shadow-modal w-full max-w-md">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-bold text-textPrimary">Create Lead from Call</h3>
            <p className="text-textMuted text-xs mt-0.5">{call?.contactNumber} · {call?.callType}</p>
          </div>
          <button onClick={onClose} className="text-textMuted hover:text-danger text-xl leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {error && <p className="text-danger text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-textSecondary mb-1">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Contact name" required
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-textSecondary mb-1">Phone</label>
            <input value={form.phone} readOnly
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-textMuted" />
          </div>
          <div>
            <label className="block text-xs font-medium text-textSecondary mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-textSecondary mb-1">Assign To</label>
            <select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Unassigned</option>
              {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-border text-textSecondary py-2.5 rounded-xl text-sm font-medium hover:border-danger hover:text-danger transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
              {loading ? 'Creating…' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const TYPE_CHIPS = ['', 'incoming', 'outgoing', 'missed', 'rejected'];
const CHIP_LABELS = { '': 'All', incoming: 'Incoming', outgoing: 'Outgoing', missed: 'Missed', rejected: 'Rejected' };
const CHIP_COLORS = {
  '': { active: 'bg-textPrimary text-white', idle: 'bg-white text-textSecondary border border-border' },
  incoming: { active: 'bg-success text-white', idle: 'bg-green-50 text-success border border-green-200' },
  outgoing: { active: 'bg-warning text-white', idle: 'bg-orange-50 text-warning border border-orange-200' },
  missed: { active: 'bg-danger text-white', idle: 'bg-red-50 text-danger border border-red-200' },
  rejected: { active: 'bg-purple text-white', idle: 'bg-purple-50 text-purple border border-purple-200' },
};

export default function CallLogsPage() {
  const [calls, setCalls] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({ employeeId: '', callType: '', startDate: '', endDate: '', search: '' });
  const [expanded, setExpanded] = useState(null);
  const [createLeadCall, setCreateLeadCall] = useState(null);
  const [noteModal, setNoteModal] = useState(null);
  const [noteText, setNoteText] = useState('');

  const fetchCalls = async (p = page, f = filters) => {
    try {
      const params = { page: p, limit: 20, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) };
      const res = await api.get('/api/calls', { params });
      setCalls(res.data.data.calls);
      setTotal(res.data.data.total);
      setPages(res.data.data.pages);
    } catch {}
  };

  useEffect(() => { api.get('/api/employees').then((r) => setEmployees(r.data.data)).catch(() => {}); }, []);
  useEffect(() => { fetchCalls(); }, [page]);

  const applyFilter = (patch) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    setPage(1);
    fetchCalls(1, next);
  };

  const handleExport = async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const res = await api.get('/api/calls/export', { params, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `calls_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch { toast.error('Export failed'); }
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !noteModal) return;
    try {
      await api.patch(`/api/calls/${noteModal._id}/notes`, { notes: noteText });
      toast.success('Note saved');
      setCalls(prev => prev.map(c => c._id === noteModal._id ? { ...c, notes: noteText } : c));
      setNoteModal(null); setNoteText('');
    } catch { toast.error('Failed to save note'); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-textPrimary">Call Logs</h2>
          <p className="text-textMuted text-sm">{total} total records</p>
        </div>
        <button onClick={handleExport}
          className="flex items-center gap-2 bg-white border border-border text-textSecondary text-sm px-4 py-2 rounded-xl hover:border-primary hover:text-primary transition-colors shadow-sm">
          ⬇ Export CSV
        </button>
      </div>

      {/* Type chips */}
      <div className="flex gap-2 flex-wrap">
        {TYPE_CHIPS.map((t) => {
          const active = filters.callType === t;
          const c = CHIP_COLORS[t];
          return (
            <button key={t} onClick={() => applyFilter({ callType: t })}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${active ? c.active : c.idle}`}>
              {CHIP_LABELS[t]}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-40">
          <label className="block text-textMuted text-xs font-medium mb-1">Search</label>
          <input value={filters.search} placeholder="Number, name, employee…"
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && applyFilter({})}
            className="w-full bg-bg border border-border text-textPrimary text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-textMuted" />
        </div>
        <div>
          <label className="block text-textMuted text-xs font-medium mb-1">Employee</label>
          <select value={filters.employeeId} onChange={(e) => applyFilter({ employeeId: e.target.value })}
            className="bg-bg border border-border text-textPrimary text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
            <option value="">All Employees</option>
            {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-textMuted text-xs font-medium mb-1">From</label>
          <input type="date" value={filters.startDate} onChange={(e) => applyFilter({ startDate: e.target.value })}
            className="bg-bg border border-border text-textPrimary text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <div>
          <label className="block text-textMuted text-xs font-medium mb-1">To</label>
          <input type="date" value={filters.endDate} onChange={(e) => applyFilter({ endDate: e.target.value })}
            className="bg-bg border border-border text-textPrimary text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <button onClick={() => applyFilter({ employeeId: '', callType: '', startDate: '', endDate: '', search: '' })}
          className="border border-border text-textMuted text-sm px-4 py-2 rounded-xl hover:border-danger hover:text-danger transition-colors">
          Reset
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-textMuted text-xs font-semibold uppercase tracking-wide bg-bg">
              <th className="px-5 py-3.5 text-left">Sr.</th>
              <th className="px-5 py-3.5 text-left">Employee</th>
              <th className="px-5 py-3.5 text-left">To Number</th>
              <th className="px-5 py-3.5 text-left">Date</th>
              <th className="px-5 py-3.5 text-left">Time</th>
              <th className="px-5 py-3.5 text-left">Duration</th>
              <th className="px-5 py-3.5 text-left">Call Type</th>
              <th className="px-5 py-3.5 text-left">Notes</th>
              <th className="px-5 py-3.5 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((log, idx) => (
              <>
                <tr key={log._id}
                  className="border-b border-border hover:bg-bg cursor-pointer transition-colors">
                  <td className="px-5 py-3.5 text-textMuted text-xs">{(page - 1) * 20 + idx + 1}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primaryLt text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {(log.employeeName || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-textPrimary font-medium text-xs">{log.employeeName}</p>
                        {log.employeePhone && <p className="text-textMuted text-xs">({log.employeePhone})</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => setExpanded(expanded === log._id ? null : log._id)}
                      className="text-primary font-medium text-xs hover:underline">
                      {log.contactName && log.contactName !== 'Unknown' ? `${log.contactName} (${log.contactNumber})` : log.contactNumber}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-textMuted text-xs whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5 text-textMuted text-xs whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3.5 text-textSecondary font-medium text-xs">{formatDuration(log.duration)}</td>
                  <td className="px-5 py-3.5"><CallTypeBadge type={log.callType} /></td>
                  <td className="px-5 py-3.5 text-textMuted text-xs max-w-32 truncate">{log.notes || '—'}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <button onClick={() => { setNoteModal(log); setNoteText(log.notes || ''); }}
                        className="text-xs text-primary font-semibold hover:underline">
                        Note
                      </button>
                      {!log.leadId && (
                        <button onClick={() => setCreateLeadCall(log)}
                          className="text-xs text-success font-semibold hover:underline whitespace-nowrap">
                          + Lead
                        </button>
                      )}
                      {log.leadId && (
                        <span className="text-xs text-textMuted">Linked</span>
                      )}
                    </div>
                  </td>
                </tr>
                {expanded === log._id && (
                  <tr key={log._id + '_exp'} className="bg-bg">
                    <td colSpan={9} className="px-5 py-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div><p className="text-textMuted font-medium mb-0.5">Contact Name</p><p className="text-textPrimary">{log.contactName || '—'}</p></div>
                        <div><p className="text-textMuted font-medium mb-0.5">Full Number</p><p className="text-textPrimary">{log.contactNumber}</p></div>
                        <div><p className="text-textMuted font-medium mb-0.5">Duration</p><p className="text-textPrimary">{formatDuration(log.duration)}</p></div>
                        <div><p className="text-textMuted font-medium mb-0.5">Notes</p><p className="text-textPrimary">{log.notes || '—'}</p></div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {calls.length === 0 && (
              <tr><td colSpan={9} className="px-5 py-10 text-center">
                <span className="text-3xl block mb-2">📭</span>
                <span className="text-textMuted text-sm">No call logs found</span>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={pages} onPage={setPage} />

      {/* Add Note Modal */}
      {noteModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-border shadow-modal w-full max-w-sm">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-textPrimary">Add Note</h3>
              <button onClick={() => { setNoteModal(null); setNoteText(''); }} className="text-textMuted hover:text-danger text-xl leading-none">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-textMuted text-xs">{noteModal.contactNumber} · {noteModal.callType}</p>
              <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={4}
                placeholder="Enter note…"
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-textMuted" />
              <div className="flex gap-3">
                <button onClick={() => { setNoteModal(null); setNoteText(''); }}
                  className="flex-1 border border-border text-textSecondary py-2.5 rounded-xl text-sm font-medium hover:border-danger hover:text-danger transition-colors">
                  Cancel
                </button>
                <button onClick={handleAddNote}
                  className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Lead Modal */}
      {createLeadCall && (
        <CreateLeadModal
          call={createLeadCall}
          employees={employees}
          onClose={() => setCreateLeadCall(null)}
          onCreated={() => fetchCalls(page, filters)}
        />
      )}
    </div>
  );
}
