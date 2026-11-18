const express = require('express');
const router  = express.Router();
const AuditLog = require('../models/AuditLog');
const { protect, requireFullAccess } = require('../middleware/auth');

// GET /api/audit-logs
router.get('/', protect, requireFullAccess, async (req, res) => {
  try {
    const { page = 1, limit = 50, userId, action } = req.query;
    const filter = {};
    if (userId) filter.userId = userId;
    if (action) filter.action = { $regex: action, $options: 'i' };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      AuditLog.countDocuments(filter),
    ]);
    return res.json({
      success: true,
      data: { logs, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
