import toast from 'react-hot-toast';
import api from './api';

const STARTED_MSG = 'Your download has started in the background — check the Downloads page for your file.';

function saveBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// axios with responseType:'blob' returns a Blob even for JSON error bodies —
// unwrap it back to text so the real backend error message can be shown.
async function extractErrorMessage(err) {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      return parsed.error || 'Download failed';
    } catch {
      return 'Download failed';
    }
  }
  return data?.error || err?.message || 'Download failed';
}

// For endpoints that stream a file directly (e.g. /api/calls/export, /api/leads/export).
export async function triggerServerExport({ endpoint, params, filename }) {
  toast(STARTED_MSG, { icon: '⬇️', duration: 4000 });
  try {
    const res = await api.get(endpoint, { params, responseType: 'blob' });
    saveBlob(res.data, filename);
    toast.success(`Saved: ${filename}`);
  } catch (err) {
    toast.error(await extractErrorMessage(err));
  }
}

// For CSVs already built client-side from data the page already fetched —
// saves it immediately (unchanged UX) and also logs it into the Downloads Center.
export async function triggerLocalExport({ label, filename, csv, mimeType = 'text/csv' }) {
  toast(STARTED_MSG, { icon: '⬇️', duration: 4000 });
  saveBlob(new Blob([csv], { type: mimeType }), filename);
  try {
    await api.post('/api/downloads/register', { label, filename, mimeType, content: csv });
    toast.success(`Saved: ${filename}`);
  } catch (err) {
    // The file already saved locally — registration failing is a soft error only.
    toast.error('Saved locally, but could not add to Downloads history');
  }
}
