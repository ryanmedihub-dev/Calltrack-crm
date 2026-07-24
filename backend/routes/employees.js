const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Lead = require('../models/Lead');
const { protect, isManager } = require('../middleware/auth');

// GET /api/employees
router.get('/', protect, isManager, async (req, res) => {
  try {
    const { search, page = 1, limit = 200 } = req.query;
    const filter = { role: 'employee' };
    if (search) filter.name = { $regex: search, $options: 'i' };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [employees, total] = await Promise.all([
      User.find(filter).sort({ name: 1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(filter),
    ]);
    return res.json({ success: true, data: employees, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/employees/tl-names — distinct Team Lead names, for filter dropdowns.
// Must be declared before GET /:id so it isn't swallowed by the param route.
router.get('/tl-names', protect, isManager, async (req, res) => {
  try {
    const names = await User.distinct('tlName', { role: 'employee', tlName: { $ne: '' } });
    return res.json({ success: true, data: names.sort((a, b) => a.localeCompare(b)) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/employees
router.post('/', protect, isManager, async (req, res) => {
  try {
    const { name, email, password, phone, deviceId, tlName } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, error: 'Email already registered' });
    const user = await User.create({ name, email, password, role: 'employee', phone, deviceId, tlName });
    return res.status(201).json({ success: true, data: user, message: 'Employee created' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/employees/:id
router.get('/:id', protect, isManager, async (req, res) => {
  try {
    const employee = await User.findOne({ _id: req.params.id, role: 'employee' });
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    return res.json({ success: true, data: employee });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/employees/:id/status
router.patch('/:id/status', protect, isManager, async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, error: 'isActive must be a boolean' });
    }
    const employee = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    return res.json({ success: true, data: employee });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/employees/:id/target
router.patch('/:id/target', protect, isManager, async (req, res) => {
  try {
    const { dailyTarget } = req.body;
    if (typeof dailyTarget !== 'number' || dailyTarget < 0) {
      return res.status(400).json({ success: false, error: 'dailyTarget must be a non-negative number' });
    }
    const employee = await User.findByIdAndUpdate(req.params.id, { dailyTarget }, { new: true });
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    return res.json({ success: true, data: employee });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/employees/:id
router.put('/:id', protect, isManager, async (req, res) => {
  try {
    const { name, phone, deviceId, tlName } = req.body;
    const employee = await User.findByIdAndUpdate(req.params.id, { name, phone, deviceId, tlName }, { new: true });
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    return res.json({ success: true, data: employee });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/employees/:id — if the employee has leads assigned, the caller
// must say what to do with them: reassignTo another employee, or deleteLeads
// to remove them too. Without either, the request is rejected (409) so the
// frontend can prompt the manager instead of silently orphaning leads.
router.delete('/:id', protect, isManager, async (req, res) => {
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

    await User.deleteOne({ _id: employee._id });
    return res.json({ success: true, message: 'Employee deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
