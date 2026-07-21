const DownloadJob = require('../models/DownloadJob');

const MAX_CONTENT_BYTES = 8 * 1024 * 1024; // 8MB — well under Mongo's 16MB doc limit
const TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

async function createDownloadJob({ ownerId, label, filename, mimeType = 'text/csv', content }) {
  const sizeBytes = Buffer.byteLength(content, 'utf8');
  if (sizeBytes > MAX_CONTENT_BYTES) {
    const err = new Error(`File too large (${sizeBytes} bytes, max ${MAX_CONTENT_BYTES})`);
    err.status = 413;
    throw err;
  }
  return DownloadJob.create({
    owner: ownerId,
    label,
    filename,
    mimeType,
    content,
    sizeBytes,
    status: 'ready',
    expiresAt: new Date(Date.now() + TTL_MS),
  });
}

// Registers the job before its file content exists, so the Downloads Center
// shows a "Processing…" row the moment a large server-side export (CallLog/Lead
// cursor scans that can take a while) starts, instead of nothing appearing
// until the whole CSV has been built.
async function createPendingDownloadJob({ ownerId, label, filename, mimeType = 'text/csv' }) {
  return DownloadJob.create({
    owner: ownerId,
    label,
    filename,
    mimeType,
    status: 'processing',
    expiresAt: new Date(Date.now() + TTL_MS),
  });
}

async function completeDownloadJob(jobId, content) {
  const sizeBytes = Buffer.byteLength(content, 'utf8');
  if (sizeBytes > MAX_CONTENT_BYTES) {
    return failDownloadJob(jobId, `File too large (${sizeBytes} bytes, max ${MAX_CONTENT_BYTES})`);
  }
  return DownloadJob.findByIdAndUpdate(jobId, { content, sizeBytes, status: 'ready' }, { new: true });
}

async function failDownloadJob(jobId, errorMessage) {
  return DownloadJob.findByIdAndUpdate(jobId, { status: 'failed', error: errorMessage }, { new: true });
}

module.exports = {
  createDownloadJob,
  createPendingDownloadJob,
  completeDownloadJob,
  failDownloadJob,
  MAX_CONTENT_BYTES,
};
