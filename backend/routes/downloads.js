const express = require('express');
const router = express.Router();
const DownloadJob = require('../models/DownloadJob');
const { protect } = require('../middleware/auth');
const { createDownloadJob, MAX_CONTENT_BYTES } = require('../lib/downloadJobs');

// GET /api/downloads — list current user's generated files
router.get('/', protect, async (req, res) => {
  try {
    const jobs = await DownloadJob.find({ owner: req.user._id }).select('-content').sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: jobs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/downloads/register — log a client-generated file into the center
router.post('/register', protect, async (req, res) => {
  try {
    const { label, filename, mimeType, content } = req.body;
    if (!label || !filename || !content) {
      return res.status(400).json({ success: false, error: 'label, filename and content are required' });
    }
    if (Buffer.byteLength(content, 'utf8') > MAX_CONTENT_BYTES) {
      return res.status(413).json({ success: false, error: 'File too large to register' });
    }
    const job = await createDownloadJob({ ownerId: req.user._id, label, filename, mimeType, content });
    return res.status(201).json({ success: true, data: { _id: job._id, filename: job.filename, expiresAt: job.expiresAt } });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// GET /api/downloads/:id/file — download the stored file content
router.get('/:id/file', protect, async (req, res) => {
  try {
    const job = await DownloadJob.findOne({ _id: req.params.id, owner: req.user._id });
    if (!job) return res.status(404).json({ success: false, error: 'File not found or expired' });
    res.setHeader('Content-Type', job.mimeType || 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`);
    return res.send(job.content);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/downloads/:id — manual early cleanup
router.delete('/:id', protect, async (req, res) => {
  try {
    const job = await DownloadJob.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!job) return res.status(404).json({ success: false, error: 'File not found' });
    return res.json({ success: true, message: 'File deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
