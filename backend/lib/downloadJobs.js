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
    expiresAt: new Date(Date.now() + TTL_MS),
  });
}

module.exports = { createDownloadJob, MAX_CONTENT_BYTES };
