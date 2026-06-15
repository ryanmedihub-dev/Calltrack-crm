const express = require('express');
const router  = express.Router();
const CallScript = require('../models/CallScript');
const { protect, isManager } = require('../middleware/auth');

// GET /api/scripts
router.get('/', protect, isManager, async (req, res) => {
  try {
    const scripts = await CallScript.find({ managerId: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, data: scripts });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/scripts
router.post('/', protect, isManager, async (req, res) => {
  try {
    const { title, category, content } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, error: 'Title and content required' });
    const script = await CallScript.create({ managerId: req.user._id, title, category: category || 'Custom', content });
    return res.status(201).json({ success: true, data: script });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/scripts/:id
router.put('/:id', protect, isManager, async (req, res) => {
  try {
    const { title, category, content } = req.body;
    const script = await CallScript.findOneAndUpdate(
      { _id: req.params.id, managerId: req.user._id },
      { title, category, content, updatedAt: new Date() },
      { new: true }
    );
    if (!script) return res.status(404).json({ success: false, error: 'Script not found' });
    return res.json({ success: true, data: script });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/scripts/:id
router.delete('/:id', protect, isManager, async (req, res) => {
  try {
    const script = await CallScript.findOneAndDelete({ _id: req.params.id, managerId: req.user._id });
    if (!script) return res.status(404).json({ success: false, error: 'Script not found' });
    return res.json({ success: true, message: 'Script deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
