const express = require('express');
const router  = express.Router();
const CallScript = require('../models/CallScript');
const { protect, isAdmin } = require('../middleware/auth');
const cache = require('../lib/cache');

// GET /api/scripts — scoped to the requesting admin, so the cache key MUST include their id:
// serving one admin's scripts to another would be a correctness bug, not a perf trade-off.
router.get('/', protect, isAdmin, async (req, res) => {
  try {
    const scripts = await cache.cached(['scripts', req.user._id.toString()], 300, () =>
      CallScript.find({ managerId: req.user._id }).sort({ createdAt: -1 }).lean()
    );
    return res.json({ success: true, data: scripts });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/scripts
router.post('/', protect, isAdmin, async (req, res) => {
  try {
    const { title, category, content } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, error: 'Title and content required' });
    const script = await CallScript.create({ managerId: req.user._id, title, category: category || 'Custom', content });
    await cache.invalidate(['scripts', req.user._id.toString()]);
    return res.status(201).json({ success: true, data: script });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/scripts/:id
router.put('/:id', protect, isAdmin, async (req, res) => {
  try {
    const { title, category, content } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, error: 'Title and content required' });
    const script = await CallScript.findOneAndUpdate(
      { _id: req.params.id, managerId: req.user._id },
      { title, category, content, updatedAt: new Date() },
      { new: true }
    );
    if (!script) return res.status(404).json({ success: false, error: 'Script not found' });
    await cache.invalidate(['scripts', req.user._id.toString()]);
    return res.json({ success: true, data: script });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/scripts/:id
router.delete('/:id', protect, isAdmin, async (req, res) => {
  try {
    const script = await CallScript.findOneAndDelete({ _id: req.params.id, managerId: req.user._id });
    if (!script) return res.status(404).json({ success: false, error: 'Script not found' });
    await cache.invalidate(['scripts', req.user._id.toString()]);
    return res.json({ success: true, message: 'Script deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
