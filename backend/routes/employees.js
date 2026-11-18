const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Lead = require('../models/Lead');
const { protect, isManager, requireFullAccess, scoped, canAccessEmployee, scopeKey } = require('../middleware/auth');
const cache = require('../lib/cache');

// Every write handler below calls this after its DB write resolves — cheaper than picking
// apart which write touched what, and this route module's writes are infrequent enough that
// over-invalidating both cached reads together costs nothing measurable.
const invalidateEmployees = () => cache.invalidate(['employees']);

// Safe field projection — never returns password, fcmToken, or deviceId.
// Includes all fields needed by employee screens, dropdowns, reports, hierarchy
// and call-log attribution.
const ROLES = User.schema.path('role').enumValues;
const SAFE_EMPLOYEE_FIELDS = 'name email role phone tlName dailyTarget isActive isDeleted deletedAt createdAt ryanEmployeeCode isSuperAdmin';

// GET /api/employees
router.get('/', protect, isManager, async (req, res) => {
  try {
    const { search, page = 1, limit = 200 } = req.query;
    const data = await cache.cached(['employees', 'list', scopeKey(req), search || '', page, limit], 120, async () => {
      const filter = scoped(req, { role: 'employee', isDeleted: { $ne: true } }, '_id');
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { ryanEmployeeCode: { $regex: search, $options: 'i' } },
        ];
      }
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [employees, total] = await Promise.all([
        User.find(filter).select(SAFE_EMPLOYEE_FIELDS).sort({ name: 1 }).skip(skip).limit(parseInt(limit)).lean(),
        User.countDocuments(filter),
      ]);
      return { employees, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) };
    });
    return res.json({ success: true, data: data.employees, total: data.total, page: data.page, pages: data.pages });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/employees/tl-names — distinct Team Lead names, for filter dropdowns.
// Must be declared before GET /:id so it isn't swallowed by the param route.
router.get('/tl-names', protect, isManager, async (req, res) => {
  try {
    // A manager/TL's only team is their own.
    if (req.teamIds) return res.json({ success: true, data: [req.user.name] });
    const names = await cache.cached(['employees', 'tl-names'], 300, async () => {
      const distinct = await User.distinct('tlName', { role: 'employee', tlName: { $ne: '' }, isDeleted: { $ne: true } });
      // One entry per team even if spelled "Rahul" / "rahul " on different employees.
      const seen = new Map();
      for (const n of distinct) { const k = n.trim().toLowerCase(); if (k && !seen.has(k)) seen.set(k, n.trim()); }
      return [...seen.values()].sort((a, b) => a.localeCompare(b));
    });
    return res.json({ success: true, data: names });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/employees
router.post('/', protect, requireFullAccess, async (req, res) => {
  try {
    const { name, email, password, phone, deviceId, tlName, ryanEmployeeCode, role = 'employee' } = req.body;
    if (!ROLES.includes(role)) return res.status(400).json({ success: false, error: 'Invalid role' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, error: 'Email already registered' });
    if (ryanEmployeeCode) {
      const dupe = await User.findOne({ ryanEmployeeCode });
      if (dupe) return res.status(400).json({ success: false, error: 'Employee ID already in use' });
    }
    const user = await User.create({ name, email, password, role, phone, deviceId, tlName, ryanEmployeeCode: ryanEmployeeCode || null });
    await invalidateEmployees();
    return res.status(201).json({ success: true, data: user.toJSON(), message: 'Employee created' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/employees/:id
router.get('/:id', protect, isManager, async (req, res) => {
  try {
    if (!canAccessEmployee(req, req.params.id)) return res.status(404).json({ success: false, error: 'Employee not found' });
    const employee = await User.findOne({ _id: req.params.id, role: 'employee' }).select(SAFE_EMPLOYEE_FIELDS).lean();
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    return res.json({ success: true, data: employee });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/employees/:id/status
router.patch('/:id/status', protect, requireFullAccess, async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, error: 'isActive must be a boolean' });
    }
    // Reactivating an employee also clears the soft-deletion flag so they
    // appear in active employee lists again.
    const update = { isActive };
    if (isActive === true) {
      update.isDeleted = false;
      update.deletedAt = null;
    }
    const employee = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select(SAFE_EMPLOYEE_FIELDS).lean();
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    await invalidateEmployees();
    return res.json({ success: true, data: employee });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/employees/:id/target
router.patch('/:id/target', protect, requireFullAccess, async (req, res) => {
  try {
    const { dailyTarget } = req.body;
    if (typeof dailyTarget !== 'number' || dailyTarget < 0) {
      return res.status(400).json({ success: false, error: 'dailyTarget must be a non-negative number' });
    }
    const employee = await User.findByIdAndUpdate(req.params.id, { dailyTarget }, { new: true }).select(SAFE_EMPLOYEE_FIELDS).lean();
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    await invalidateEmployees();
    return res.json({ success: true, data: employee });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/employees/:id
router.put('/:id', protect, requireFullAccess, async (req, res) => {
  try {
    const { name, phone, deviceId, tlName, ryanEmployeeCode, role } = req.body;
    if (role !== undefined && !ROLES.includes(role)) return res.status(400).json({ success: false, error: 'Invalid role' });
    if (ryanEmployeeCode) {
      const dupe = await User.findOne({ ryanEmployeeCode, _id: { $ne: req.params.id } });
      if (dupe) return res.status(400).json({ success: false, error: 'Employee ID already in use' });
    }
    const update = { name, phone, deviceId, tlName, role };
    if (ryanEmployeeCode !== undefined) update.ryanEmployeeCode = ryanEmployeeCode || null;
    const employee = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select(SAFE_EMPLOYEE_FIELDS).lean();
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    await invalidateEmployees();
    return res.json({ success: true, data: employee });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/employees/:id — if the employee has leads assigned, the caller
// must say what to do with them: reassignTo another employee, or deleteLeads
// to remove them too. Without either, the request is rejected (409) so the
// frontend can prompt the manager instead of silently orphaning leads.
// Uses soft deletion: marks isDeleted=true and records deletedAt timestamp.
// Historical call-log attribution is preserved via the stored employeeName field.
router.delete('/:id', protect, requireFullAccess, async (req, res) => {
  try {
    const { reassignTo, deleteLeads } = req.body || {};
    const employee = await User.findOne({ _id: req.params.id, role: 'employee' });
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });

    const leadCount = await Lead.countDocuments({ assignedTo: employee._id });
    if (leadCount > 0) {
      if (reassignTo) {
        if (reassignTo === employee._id.toString()) {
          return res.status(400).json({ success: false, error: 'Cannot reassign leads to the same employee being removed' });
        }
        const target = await User.findOne({ _id: reassignTo, role: 'employee' });
        if (!target) return res.status(400).json({ success: false, error: 'Target employee not found' });
        await Lead.updateMany({ assignedTo: employee._id }, { $set: { assignedTo: reassignTo } });
      } else if (deleteLeads) {
        await Lead.deleteMany({ assignedTo: employee._id });
      } else {
        return res.status(409).json({ success: false, error: 'Employee has assigned leads', leadCount });
      }
    }

    // Soft delete — preserves historical call-log attribution
    await User.updateOne(
      { _id: employee._id },
      { $set: { isActive: false, isDeleted: true, deletedAt: new Date() } }
    );
    await invalidateEmployees();
    return res.json({ success: true, message: 'Employee deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.SAFE_EMPLOYEE_FIELDS = SAFE_EMPLOYEE_FIELDS;
module.exports = router;
