'use client';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../lib/api';
import { fmtDateTime } from '../../../lib/timezone';

function Ico({ size = 16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const DownloadIco = ({ s = 13 }) => <Ico size={s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Ico>;
const TrashIco    = ({ s = 13 }) => <Ico size={s}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></Ico>;
const RefreshIco  = ({ s = 13, spinning = false }) => <Ico size={s}><g className={spinning ? 'animate-spin' : ''} style={{ transformOrigin: 'center' }}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></g></Ico>;
const InboxIco    = ({ s = 32 }) => <Ico size={s}><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></Ico>;

function formatBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatExpiresIn(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return `${Math.max(1, Math.floor(ms / (1000 * 60)))}m`;
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export default function DownloadsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const res = await api.get('/api/downloads');
      setJobs(res.data?.data || []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [load]);

  const handleDownload = async (job) => {
    setBusyId(job._id);
    try {
      const res = await api.get(`/api/downloads/${job._id}/file`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = job.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('This file has expired or could not be found');
      load(true);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (job) => {
    setBusyId(job._id);
    try {
      await api.delete(`/api/downloads/${job._id}`);
      setJobs((prev) => prev.filter((j) => j._id !== job._id));
      toast.success('File deleted');
    } catch {
      toast.error('Could not delete file');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Downloads</h2>
          <p className="page-subtitle">Files exported from any page in the app — automatically removed 2 days after creation</p>
        </div>
        <button onClick={() => load(true)} className="btn-secondary text-xs py-1.5 px-3">
          <RefreshIco spinning={refreshing} /> Refresh
        </button>
      </div>

      <div className="page-card overflow-hidden">
        <div className="px-5 py-3.5" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <h3 className="font-bold text-sm" style={{ color: '#0F172A' }}>{jobs.length} file{jobs.length === 1 ? '' : 's'}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th>File</th>
                <th>Type</th>
                <th>Size</th>
                <th>Created</th>
                <th>Expires In</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j}><div className="skeleton h-4 rounded" /></td>)}</tr>
                ))
              ) : jobs.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="flex flex-col items-center py-14 gap-3">
                    <InboxIco />
                    <p className="text-sm font-medium" style={{ color: '#64748B' }}>No downloads yet</p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>Export a report or call/lead list from anywhere in the app and it'll show up here</p>
                  </div>
                </td></tr>
              ) : jobs.map((job) => (
                <tr key={job._id}>
                  <td>
                    <p className="font-mono text-xs font-medium" style={{ color: '#0F172A' }}>{job.filename}</p>
                    {job.status === 'failed' && <span className="badge" style={{ background: '#FEF2F2', color: '#DC2626' }}>Failed</span>}
                  </td>
                  <td className="text-xs" style={{ color: '#475569' }}>{job.label}</td>
                  <td className="text-xs tabular-nums" style={{ color: '#475569' }}>{formatBytes(job.sizeBytes)}</td>
                  <td className="text-xs" style={{ color: '#94A3B8' }}>{fmtDateTime(job.createdAt)}</td>
                  <td className="text-xs font-medium" style={{ color: '#D97706' }}>{formatExpiresIn(job.expiresAt)}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleDownload(job)}
                        disabled={busyId === job._id}
                        className="btn-secondary text-[11px] py-1 px-2.5"
                        title="Download"
                      >
                        <DownloadIco />
                      </button>
                      <button
                        onClick={() => handleDelete(job)}
                        disabled={busyId === job._id}
                        className="btn-secondary text-[11px] py-1 px-2.5"
                        style={{ color: '#DC2626' }}
                        title="Delete"
                      >
                        <TrashIco />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
