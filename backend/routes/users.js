const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, isAdmin } = require('../middleware/auth');

// Safe field projection — never returns password, fcmToken, or deviceId.
const SAFE_FIELDS = 'name email role phone tlName isActive isDeleted dailyTarget createdAt ryanEmployeeCode isSuperAdmin';

// GET /api/users
// List all system users across all roles. Admin-protected (role=admin or isSuperAdmin=true).
// Supports search (name, email, phone, ryanEmployeeCode), role filter, status filter, pagination.
// Excludes soft-deleted users.
router.get('/', protect, isAdmin, async (req, res) => {
  try {
    const { search, role, status, page = 1, limit = 200 } = req.query;
    const filter = { isDeleted: { $ne: true } };

    if (role) {
      filter.role = role;
    }

    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'inactive') {
      filter.isActive = false;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { ryanEmployeeCode: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 200);
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(SAFE_FIELDS)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: users,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.SAFE_FIELDS = SAFE_FIELDS;
module.exports = router;

