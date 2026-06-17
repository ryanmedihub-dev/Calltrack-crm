'use client';
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../../lib/api';
import Pagination from '../../../components/Pagination';

const STATUSES = ['new', 'contacted', 'interested', 'not_interested', 'converted', 'lost'];
const STATUS_LABELS = { new: 'New', contacted: 'Contacted', interested: 'Interested', not_interested: 'Not Interested', converted: 'Converted', lost: 'Lost' };
const STATUS_COLOR = {
  new: 'bg-blue-50 text-primary border-blue-200',
  contacted: 'bg-purple-50 text-purple border-purple-200',
  interested: 'bg-orange-50 text-warning border-orange-200',
  not_interested: 'bg-red-50 text-danger border-red-200',
  converted: 'bg-green-50 text-success border-green-200',
  lost: 'bg-gray-50 text-textMuted border-gray-200'
};

function fmtDuration(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function CallTypePill({ type }) {
  const cfg = {
    incoming: 'bg-green-50 text-success border border-green-200',
    outgoing: 'bg-orange-50 text-warning border border-orange-200',
    missed: 'bg-red-50 text-danger border border-red-200',
    rejected: 'bg-purple-50 text-purple border border-purple-200'
  };
  const icons = { incoming: '↙', outgoing: '↗', missed: '↩', rejected: '✗' };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg[type] || 'bg-gray-50 text-textMuted'}`}>
      {icons[type]} {type}
    </span>
  );
}

function LeadDetailModal({ lead, employees, onClose, onUpdate }) {
  const [form, setForm] = useState({
    name: lead.name, phone: lead.phone, email: lead.email || '',
    company: lead.company || '', address1: lead.address1 || '',
    city: lead.city || '', state: lead.state || '', country: lead.country || '',
    status: lead.status, assignedTo: lead.assignedTo?._id || '',
    followUpDate: lead.followUpDate ? new Date(lead.followUpDate).toISOString().slice(0, 10) : '',
    tags: (lead.tags || []).join(', '), source: lead.source || ''
  });
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [] };
      await api.put(`/api/leads/${lead._id}`, payload);
      toast.success('Lead updated');
      onUpdate();
      onClose();
    } catch { toast.error('Failed to update'); }
    finally { setSaving(false); }
  };

  const handleNote = async () => {
    if (!noteText.trim()) return;
    try {
      await api.post(`/api/leads/${lead._id}/note`, { text: noteText });
      toast.success('Note added');
      setNoteText('');
      onUpdate();
    } catch { toast.error('Failed to add note'); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border shadow-modal w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-bold text-textPrimary text-lg">{lead.name}</h3>
            <p className="text-textMuted text-xs mt-0.5">{lead.phone}</p>
          </div>
          <button onClick={onClose} className="text-textMuted hover:text-danger text-xl leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'name', label: 'Full Name' },
              { key: 'phone', label: 'Phone' },
              { key: 'email', label: 'Email' },
              { key: 'company', label: 'Company' },
              { key: 'address1', label: 'Address' },
              { key: 'city', label: 'City' },
              { key: 'state', label: 'State' },
              { key: 'country', label: 'Country' },
              { key: 'source', label: 'Source' },
              { key: 'tags', label: 'Tags (comma separated)' }
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-textSecondary mb-1">{label}</label>
                <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-textSecondary mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-textSecondary mb-1">Assign To</label>
              <select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Unassigned</option>
                {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-textSecondary mb-1">Follow-up Date</label>
              <input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-textSecondary mb-1">Add Note</label>
            <div className="flex gap-2">
              <input value={noteText} onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note…"
                className="flex-1 bg-bg border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <button onClick={handleNote}
                className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
                Add
              </button>
            </div>
            {(lead.notes || []).length > 0 && (
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {lead.notes.slice().reverse().map((n, i) => (
                  <div key={i} className="bg-bg rounded-lg px-3 py-2 text-xs text-textSecondary">
                    <p>{n.text}</p>
                    <p className="text-textMuted mt-0.5">{new Date(n.addedAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="p-5 border-t border-border flex gap-3">
          <button onClick={onClose}
            className="flex-1 border border-border text-textSecondary py-2.5 rounded-xl text-sm font-medium hover:border-danger hover:text-danger transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ status: '', assignedTo: '', search: '' });
  const [colSearch, setColSearch] = useState({ name: '', phone: '', company: '', assignedTo: '' });
  const [selected, setSelected] = useState(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [detailLead, setDetailLead] = useState(null);
  const [bulkModal, setBulkModal] = useState(null);
  const [bulkEmployee, setBulkEmployee] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', company: '', source: '',
    status: 'new', assignedTo: '', followUpDate: '', tags: ''
  });

  const fetchLeads = useCallback(async (p = page, f = filters) => {
    try {
      const params = { page: p, limit: 20, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) };
      const res = await api.get('/api/leads', { params });
      setLeads(res.data.data.leads);
      setTotal(res.data.data.total);
      setPages(res.data.data.pages);
    } catch {}
  }, [page, filters]);

  useEffect(() => {
    api.get('/api/employees').then((r) => setEmployees(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchLeads(page, filters); }, [page]);

  const applyFilters = (newFilters) => {
    setFilters(newFilters);
    setPage(1);
    setSelected(new Set());
    fetchLeads(1, newFilters);
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === leads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(leads.map(l => l._id)));
    }
  };

  const handleAddLead = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [] };
      await api.post('/api/leads', payload);
      toast.success('Lead created');
      setShowAdd(false);
      setForm({ name: '', phone: '', email: '', company: '', source: '', status: 'new', assignedTo: '', followUpDate: '', tags: '' });
      fetchLeads(1, filters);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create lead');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this lead?')) return;
    try {
      await api.delete(`/api/leads/${id}`);
      toast.success('Lead deleted');
      fetchLeads(page, filters);
    } catch { toast.error('Failed to delete'); }
  };

  const handleBulkAction = async () => {
    if (!selected.size) return;
    const ids = [...selected];
    try {
      if (bulkModal === 'assign' || bulkModal === 'transfer') {
        await api.post(`/api/leads/bulk-${bulkModal === 'assign' ? 'assign' : 'transfer'}`, {
          leadIds: ids, employeeId: bulkEmployee, toEmployeeId: bulkEmployee
        });
        toast.success(`${ids.length} leads ${bulkModal === 'assign' ? 'assigned' : 'transferred'}`);
      } else if (bulkModal === 'delete') {
        if (!confirm(`Delete ${ids.length} leads? This cannot be undone.`)) return;
        await api.delete('/api/leads/bulk-delete', { data: { leadIds: ids } });
        toast.success(`${ids.length} leads deleted`);
      }
      setBulkModal(null); setBulkEmployee(''); setSelected(new Set());
      fetchLeads(page, filters);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bulk action failed');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.put(`/api/leads/${id}`, { status });
      setLeads(prev => prev.map(l => l._id === id ? { ...l, status } : l));
    } catch { toast.error('Failed to update status'); }
  };

  const filteredLeads = leads.filter(l => {
    const q = (s) => (s || '').toLowerCase();
    if (colSearch.name   && !q(l.name).includes(q(colSearch.name)))         return false;
    if (colSearch.phone  && !q(l.phone).includes(q(colSearch.phone)))        return false;
    if (colSearch.company && !q(l.company).includes(q(colSearch.company)))   return false;
    if (colSearch.assignedTo && !q(l.assignedTo?.name).includes(q(colSearch.assignedTo))) return false;
    return true;
  });

  const hasColSearch = Object.values(colSearch).some(Boolean);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-textPrimary">My Leads</h2>
          <p className="text-textMuted text-sm">{total} total leads</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)}
            className="bg-primary hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
            + Add Lead
          </button>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 flex-wrap">
        {['', ...STATUSES].map((s) => (
          <button key={s} onClick={() => applyFilters({ ...filters, status: s })}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              filters.status === s
                ? 'bg-textPrimary text-white border-textPrimary'
                : 'bg-white text-textSecondary border-border hover:border-primary hover:text-primary'
            }`}>
            {s === '' ? `All (${total})` : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-textMuted text-xs font-medium mb-1">Search</label>
          <input value={filters.search} placeholder="Name, phone, company…"
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters(filters)}
            className="w-full bg-bg border border-border text-textPrimary text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-textMuted" />
        </div>
        <div>
          <label className="block text-textMuted text-xs font-medium mb-1">Assigned To</label>
          <select value={filters.assignedTo} onChange={(e) => applyFilters({ ...filters, assignedTo: e.target.value })}
            className="bg-bg border border-border text-textPrimary text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
            <option value="">All Employees</option>
            {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
          </select>
        </div>
        <button onClick={() => applyFilters({ status: '', assignedTo: '', search: '' })}
          className="border border-border text-textMuted text-sm px-4 py-2 rounded-xl hover:border-danger hover:text-danger transition-colors">
          Reset
        </button>
        <button onClick={() => applyFilters(filters)}
          className="bg-primary text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors">
          Apply
        </button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-primaryLt border border-blue-200 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-primary text-sm font-semibold">{selected.size} selected</span>
          <div className="flex gap-2 ml-auto flex-wrap">
            <button onClick={() => setBulkModal('assign')}
              className="text-xs border border-primary text-primary px-3 py-1.5 rounded-xl font-semibold hover:bg-primary hover:text-white transition-colors">
              Assign
            </button>
            <button onClick={() => setBulkModal('transfer')}
              className="text-xs border border-warning text-warning px-3 py-1.5 rounded-xl font-semibold hover:bg-warning hover:text-white transition-colors">
              Transfer
            </button>
            <button onClick={() => setBulkModal('delete')}
              className="text-xs border border-danger text-danger px-3 py-1.5 rounded-xl font-semibold hover:bg-danger hover:text-white transition-colors">
              Delete
            </button>
            <button onClick={() => setSelected(new Set())}
              className="text-xs text-textMuted hover:text-danger transition-colors px-2">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Column search active chips */}
      {hasColSearch && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-textMuted font-medium">Column filters:</span>
          {Object.entries(colSearch).filter(([, v]) => v).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5 bg-primaryLt text-primary border border-blue-200 text-xs font-semibold px-2.5 py-1 rounded-full">
              {k}: "{v}"
              <button onClick={() => setColSearch(s => ({ ...s, [k]: '' }))} className="hover:text-danger transition-colors">✕</button>
            </span>
          ))}
          <button onClick={() => setColSearch({ name: '', phone: '', company: '', assignedTo: '' })}
            className="text-xs text-textMuted hover:text-danger transition-colors font-medium">Clear all</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 900 }}>
          <thead>
            <tr className="border-b-0 text-textMuted text-xs font-semibold uppercase tracking-wide bg-bg">
              <th className="px-4 pt-3.5 pb-2 text-left w-10">
                <input type="checkbox" checked={selected.size === leads.length && leads.length > 0}
                  onChange={toggleAll}
                  className="rounded border-border" />
              </th>
              <th className="px-4 pt-3.5 pb-2 text-left">Created</th>
              <th className="px-4 pt-3.5 pb-2 text-left">Lead Name</th>
              <th className="px-4 pt-3.5 pb-2 text-left">Contact No.</th>
              <th className="px-4 pt-3.5 pb-2 text-left">Attempts</th>
              <th className="px-4 pt-3.5 pb-2 text-left">Tags</th>
              <th className="px-4 pt-3.5 pb-2 text-left">Assign To</th>
              <th className="px-4 pt-3.5 pb-2 text-left">Status</th>
              <th className="px-4 pt-3.5 pb-2 text-left">Last Call</th>
              <th className="px-4 pt-3.5 pb-2 text-left">Duration</th>
              <th className="px-4 pt-3.5 pb-2 text-left">Last Note</th>
              <th className="px-4 pt-3.5 pb-2 text-left">Company</th>
              <th className="px-4 pt-3.5 pb-2 text-left">Follow-up</th>
              <th className="px-4 pt-3.5 pb-2 text-left">Actions</th>
            </tr>
            {/* Column search row */}
            <tr className="border-b border-border bg-bg">
              <td className="px-4 pb-2" />
              <td className="px-4 pb-2" />
              <td className="px-4 pb-2">
                <input value={colSearch.name} placeholder="Search name…"
                  onChange={e => setColSearch(s => ({ ...s, name: e.target.value }))}
                  className="w-full bg-white border border-border rounded-lg px-2 py-1 text-xs text-textPrimary focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-textMuted" />
              </td>
              <td className="px-4 pb-2">
                <input value={colSearch.phone} placeholder="Search phone…"
                  onChange={e => setColSearch(s => ({ ...s, phone: e.target.value }))}
                  className="w-full bg-white border border-border rounded-lg px-2 py-1 text-xs text-textPrimary focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-textMuted" />
              </td>
              <td className="px-4 pb-2" />
              <td className="px-4 pb-2" />
              <td className="px-4 pb-2">
                <input value={colSearch.assignedTo} placeholder="Search employee…"
                  onChange={e => setColSearch(s => ({ ...s, assignedTo: e.target.value }))}
                  className="w-full bg-white border border-border rounded-lg px-2 py-1 text-xs text-textPrimary focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-textMuted" />
              </td>
              <td className="px-4 pb-2" />
              <td className="px-4 pb-2" />
              <td className="px-4 pb-2" />
              <td className="px-4 pb-2" />
              <td className="px-4 pb-2">
                <input value={colSearch.company} placeholder="Search company…"
                  onChange={e => setColSearch(s => ({ ...s, company: e.target.value }))}
                  className="w-full bg-white border border-border rounded-lg px-2 py-1 text-xs text-textPrimary focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-textMuted" />
              </td>
              <td className="px-4 pb-2" />
              <td className="px-4 pb-2" />
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map((lead) => (
              <tr key={lead._id} className="border-b border-border hover:bg-bg/60 transition-colors">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(lead._id)} onChange={() => toggleSelect(lead._id)}
                    className="rounded border-border" />
                </td>
                <td className="px-4 py-3 text-textMuted text-xs whitespace-nowrap">{fmtDate(lead.createdAt)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => setDetailLead(lead)} className="flex items-center gap-2 text-left hover:text-primary transition-colors">
                    <div className="w-7 h-7 rounded-xl bg-primaryLt text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {lead.name[0]?.toUpperCase()}
                    </div>
                    <span className="text-textPrimary font-semibold hover:text-primary">{lead.name}</span>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span className="text-primary font-medium text-xs">{lead.phone}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="bg-primaryLt text-primary text-xs px-2 py-0.5 rounded-full font-bold">
                    {lead.attempts || 0}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {(lead.tags || []).length > 0 ? (
                    <div className="flex gap-1 flex-wrap">
                      {lead.tags.slice(0, 2).map((t) => (
                        <span key={t} className="bg-purple-50 text-purple border border-purple-200 text-xs px-1.5 py-0.5 rounded-full">{t}</span>
                      ))}
                      {lead.tags.length > 2 && <span className="text-textMuted text-xs">+{lead.tags.length - 2}</span>}
                    </div>
                  ) : <span className="text-textMuted text-xs">—</span>}
                </td>
                <td className="px-4 py-3">
                  {lead.assignedTo ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-primaryLt text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {lead.assignedTo.name[0]?.toUpperCase()}
                      </div>
                      <span className="text-textSecondary text-xs truncate max-w-24">{lead.assignedTo.name}</span>
                    </div>
                  ) : <span className="text-textMuted text-xs">Unassigned</span>}
                </td>
                <td className="px-4 py-3">
                  <select value={lead.status} onChange={(e) => handleStatusChange(lead._id, e.target.value)}
                    className={`text-xs rounded-full px-2 py-1 border font-medium focus:outline-none ${STATUS_COLOR[lead.status] || 'bg-gray-50 text-textMuted border-gray-200'}`}>
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {lead.lastCallAt ? (
                    <div>
                      <p className="text-xs text-textSecondary">{fmtDate(lead.lastCallAt)}</p>
                      {lead.lastCallType && <CallTypePill type={lead.lastCallType} />}
                    </div>
                  ) : <span className="text-textMuted text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-textSecondary text-xs">{fmtDuration(lead.lastCallDuration)}</td>
                <td className="px-4 py-3 max-w-32">
                  {lead.lastCallNote ? (
                    <p className="text-xs text-textSecondary truncate">{lead.lastCallNote}</p>
                  ) : (lead.notes?.length > 0 ? (
                    <p className="text-xs text-textSecondary truncate">{lead.notes[lead.notes.length - 1].text}</p>
                  ) : <span className="text-textMuted text-xs">—</span>)}
                </td>
                <td className="px-4 py-3 text-textSecondary text-xs">{lead.company || '—'}</td>
                <td className="px-4 py-3">
                  {lead.followUpDate ? (
                    <span className="bg-orange-50 text-warning border border-orange-200 text-xs px-2 py-0.5 rounded-full font-medium">
                      {fmtDate(lead.followUpDate)}
                    </span>
                  ) : <span className="text-textMuted text-xs">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => setDetailLead(lead)}
                      className="text-xs text-primary font-semibold hover:underline">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(lead._id)}
                      className="text-xs text-danger font-semibold hover:underline">
                      Del
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr><td colSpan={14} className="px-5 py-10 text-center">
                <span className="text-4xl block mb-2">🎯</span>
                <span className="text-textMuted text-sm">No leads found</span>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={pages} onPage={setPage} />

      {/* Add Lead Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-border shadow-modal w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="text-textPrimary font-bold text-lg">Add New Lead</h3>
              <button onClick={() => setShowAdd(false)} className="text-textMuted hover:text-danger text-xl leading-none">✕</button>
            </div>
            <form onSubmit={handleAddLead} className="p-5 overflow-y-auto space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'name', label: 'Full Name', req: true },
                  { key: 'phone', label: 'Phone', req: true },
                  { key: 'email', label: 'Email', req: false },
                  { key: 'company', label: 'Company', req: false },
                  { key: 'source', label: 'Source', req: false },
                  { key: 'tags', label: 'Tags (comma separated)', req: false }
                ].map(({ key, label, req }) => (
                  <div key={key}>
                    <label className="block text-textSecondary text-xs font-medium mb-1">{label}</label>
                    <input type="text" required={req} value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-textMuted" />
                  </div>
                ))}
                <div>
                  <label className="block text-textSecondary text-xs font-medium mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full bg-bg border border-border text-textPrimary text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-textSecondary text-xs font-medium mb-1">Assign To</label>
                  <select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                    className="w-full bg-bg border border-border text-textPrimary text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">Unassigned</option>
                    {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-textSecondary text-xs font-medium mb-1">Follow-up Date</label>
                  <input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)}
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
      )}

      {/* Bulk Action Modal (assign/transfer) */}
      {(bulkModal === 'assign' || bulkModal === 'transfer') && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-border shadow-modal w-full max-w-sm">
            <div className="p-5 border-b border-border">
              <h3 className="font-bold text-textPrimary capitalize">{bulkModal} {selected.size} Leads</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-textSecondary mb-1">Select Employee</label>
                <select value={bulkEmployee} onChange={(e) => setBulkEmployee(e.target.value)}
                  className="w-full bg-bg border border-border text-textPrimary text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">— Select —</option>
                  {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setBulkModal(null); setBulkEmployee(''); }}
                  className="flex-1 border border-border text-textSecondary py-2.5 rounded-xl text-sm font-medium hover:border-danger hover:text-danger transition-colors">
                  Cancel
                </button>
                <button onClick={handleBulkAction} disabled={!bulkEmployee}
                  className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lead Detail Modal */}
      {detailLead && (
        <LeadDetailModal
          lead={detailLead}
          employees={employees}
          onClose={() => setDetailLead(null)}
          onUpdate={() => { fetchLeads(page, filters); setDetailLead(null); }}
        />
      )}
    </div>
  );
}
