'use client';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../lib/api';
import { fmtDateTime } from '../../../lib/timezone';
import { DataTable } from '../../../components/report-shared';

function Ico({ size = 16, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const DownloadIco = ({ s = 13 }) => <Ico size={s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Ico>;
const TrashIco    = ({ s = 13 }) => <Ico size={s}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></Ico>;
const RefreshIco  = ({ s = 13, spinning = false }) => <Ico size={s}><g className={spinning ? 'animate-spin' : ''} style={{ transformOrigin: 'center' }}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></g></Ico>;

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
  }, [load]);

  // Poll much more often while a file is still being generated, so a
  // "Processing…" row flips to ready/failed within a few seconds instead of
  // sitting there for up to 30s with no visible progress.
  useEffect(() => {
    const hasProcessing = jobs.some((j) => j.status === 'processing');
    const t = setInterval(() => load(true), hasProcessing ? 3000 : 30000);
    return () => clearInterval(t);
  }, [load, jobs]);

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

  const processingCount = jobs.filter((j) => j.status === 'processing').length;

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
        <div className="px-5 py-3.5 flex items-center gap-3" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <h3 className="font-bold text-sm" style={{ color: '#0F172A' }}>{jobs.length} file{jobs.length === 1 ? '' : 's'}</h3>
          {processingCount > 0 && (
            <span className="badge inline-flex items-center gap-1.5" style={{ background: '#EFF6FF', color: '#2563EB' }}>
              <span className="inline-block w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              {processingCount} generating…
            </span>
          )}
        </div>
        <div className="px-5 py-4">
          <DataTable
            loading={loading}
            rows={jobs}
            emptyTitle="No downloads yet"
            emptyHint="Export a report or call/lead list from anywhere in the app and it'll show up here"
            columns={[
              {
                key: 'filename', label: 'File',
                render: (job) => (
                  <>
                    <p className="font-mono text-xs font-medium" style={{ color: '#0F172A' }}>{job.filename}</p>
                    {job.status === 'processing' && (
                      <span className="badge inline-flex items-center gap-1.5" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                        <span className="inline-block w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Processing…
                      </span>
                    )}
                    {job.status === 'failed' && <span className="badge" style={{ background: '#FEF2F2', color: '#DC2626' }}>Failed</span>}
                  </>
                ),
              },
              { key: 'label', label: 'Type', render: (job) => <span className="text-xs" style={{ color: '#475569' }}>{job.label}</span> },
              {
                key: 'sizeBytes', label: 'Size', searchable: false,
                render: (job) => (
                  <span className="text-xs tabular-nums" style={{ color: '#475569' }}>
                    {job.status === 'processing' ? '—' : formatBytes(job.sizeBytes)}
                  </span>
                ),
              },
              { key: 'createdAt', label: 'Created', searchable: false, render: (job) => <span className="text-xs" style={{ color: '#94A3B8' }}>{fmtDateTime(job.createdAt)}</span> },
              { key: 'expiresAt', label: 'Expires In', searchable: false, render: (job) => <span className="text-xs font-medium" style={{ color: '#D97706' }}>{formatExpiresIn(job.expiresAt)}</span> },
              {
                key: 'actions', label: 'Actions', align: 'right', sortable: false, searchable: false,
                render: (job) => {
                  const processing = job.status === 'processing';
                  return (
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleDownload(job)}
                        disabled={busyId === job._id || processing}
                        className="btn-secondary text-[11px] py-1 px-2.5"
                        title={processing ? 'Still generating…' : 'Download'}
                      >
                        {processing
                          ? <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin opacity-50" />
                          : <DownloadIco />}
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
                  );
                },
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
