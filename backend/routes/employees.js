const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');
const { protect, isAdmin, requireManagement } = require('../middleware/auth');
const { getScopedEmployeeIds, validateEmployeeInScope } = require('../lib/scope');
const cache = require('../lib/cache');

// Every write handler below calls this after its DB write resolves — cheaper than picking
// apart which write touched what, and this route module's writes are infrequent enough that
// over-invalidating both cached reads together costs nothing measurable.
const invalidateEmployees = () => cache.invalidate(['employees']);

// GET /api/employees — list employees within user's hierarchy
router.get('/', protect, requireManagement, async (req, res) => {
  try {
    const { search, page = 1, limit = 200 } = req.query;

    // Resolve RBAC scope first — null means "all employees" (admin), an array
    // means "only these employee _ids" (manager or TL scoped view).
    const scopedEmpIds = await getScopedEmployeeIds(req.user);

    // Build a scope-safe cache key. Because different managers see different
    // employee subsets, the key must encode *who* is asking. Admins share one
    // key ('all'); every other user gets their own key keyed by their _id.
    // This prevents one manager's cached list from being served to another.
    const scopeKey = scopedEmpIds === null ? 'all' : req.user._id.toString();

    const data = await cache.cached(
      ['employees', 'list', scopeKey, search || '', page, limit],
      120,
      async () => {
        const filter = { role: 'employee' };

        // RBAC: restrict results to the requesting user's accessible hierarchy
        if (scopedEmpIds !== null) {
          filter._id = { $in: scopedEmpIds };
        }

        // Search across name AND ryanEmployeeCode (main-branch behaviour)
        if (search) {
          filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { ryanEmployeeCode: { $regex: search, $options: 'i' } },
          ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [employees, total] = await Promise.all([
          User.find(filter).sort({ name: 1 }).skip(skip).limit(parseInt(limit)).lean(),
          User.countDocuments(filter),
        ]);
        return { employees, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) };
      }
    );

    return res.json({ success: true, data: data.employees, total: data.total, page: data.page, pages: data.pages });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/employees/tl-names — distinct Team Lead names within the requesting
// user's hierarchy, for filter dropdowns. Must be declared before GET /:id so
// it isn't swallowed by the param route.
router.get('/tl-names', protect, requireManagement, async (req, res) => {
  try {
    const scopedEmpIds = await getScopedEmployeeIds(req.user);

    // Same scope-safe caching strategy as the list route above.
    const scopeKey = scopedEmpIds === null ? 'all' : req.user._id.toString();

    const names = await cache.cached(['employees', 'tl-names', scopeKey], 300, async () => {
      const filter = { role: 'employee', tlName: { $ne: '' } };
      if (scopedEmpIds !== null) {
        filter._id = { $in: scopedEmpIds };
      }
      const distinct = await User.distinct('tlName', filter);
      return distinct.sort((a, b) => a.localeCompare(b));
    });

    return res.json({ success: true, data: names });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/employees (Admin-only) — supports role-safe user creation for all
// roles: admin, manager, tl, employee. Hierarchy validation ensures managerId
// and teamLeadId references are valid before creating the user.
router.post('/', protect, isAdmin, async (req, res) => {
  try {
    const {
      name, email, password, phone, deviceId, tlName,
      ryanEmployeeCode,           // main: unique employee code
      role = 'employee',          // stash: multi-role creation
      managerId,                  // stash: hierarchy — for TL users
      teamLeadId,                 // stash: hierarchy — for employee users
    } = req.body;

    // 1. Validate role
    const targetRole = role || 'employee';
    const allowedRoles = ['admin', 'manager', 'tl', 'employee'];
    if (!allowedRoles.includes(targetRole)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role '${targetRole}'. Allowed roles are: ${allowedRoles.join(', ')}`,
      });
    }

    // 2. Email uniqueness
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, error: 'Email already registered' });

    // 3. ryanEmployeeCode uniqueness (main-branch requirement)
    if (ryanEmployeeCode) {
      const dupe = await User.findOne({ ryanEmployeeCode });
      if (dupe) return res.status(400).json({ success: false, error: 'Employee ID already in use' });
    }

    let resolvedManagerId = null;
    let resolvedTeamLeadId = null;

    // 4. Role-specific hierarchy validation (stash-branch requirement)
    if (targetRole === 'admin' || targetRole === 'manager') {
      if (managerId) {
        return res.status(400).json({ success: false, error: `Users with role "${targetRole}" cannot be assigned a managerId` });
      }
      if (teamLeadId) {
        return res.status(400).json({ success: false, error: `Users with role "${targetRole}" cannot be assigned a teamLeadId` });
      }
    } else if (targetRole === 'tl') {
      if (teamLeadId) {
        return res.status(400).json({ success: false, error: 'Users with role "tl" cannot be assigned a teamLeadId' });
      }
      if (managerId) {
        if (!mongoose.Types.ObjectId.isValid(managerId)) {
          return res.status(400).json({ success: false, error: 'Invalid managerId' });
        }
        const mgrUser = await User.findById(managerId).select('_id role isActive');
        if (!mgrUser) {
          return res.status(400).json({ success: false, error: 'Referenced manager does not exist' });
        }
        if (mgrUser.role !== 'manager') {
          return res.status(400).json({ success: false, error: `Referenced user has role '${mgrUser.role}'; managerId must point to a user with role 'manager'` });
        }
        if (!mgrUser.isActive) {
          return res.status(400).json({ success: false, error: 'Referenced manager is inactive' });
        }
        resolvedManagerId = mgrUser._id;
      }
    } else if (targetRole === 'employee') {
      if (managerId) {
        return res.status(400).json({ success: false, error: 'Users with role "employee" cannot be assigned a managerId directly' });
      }
      if (teamLeadId) {
        if (!mongoose.Types.ObjectId.isValid(teamLeadId)) {
          return res.status(400).json({ success: false, error: 'Invalid teamLeadId' });
        }
        const tlUser = await User.findById(teamLeadId).select('_id role isActive');
        if (!tlUser) {
          return res.status(400).json({ success: false, error: 'Referenced team lead does not exist' });
        }
        if (tlUser.role !== 'tl') {
          return res.status(400).json({ success: false, error: `Referenced user has role '${tlUser.role}'; teamLeadId must point to a user with role 'tl'` });
        }
        if (!tlUser.isActive) {
          return res.status(400).json({ success: false, error: 'Referenced team lead is inactive' });
        }
        resolvedTeamLeadId = tlUser._id;
      }
    }

    const userData = {
      name,
      email,
      password,
      role: targetRole,
      phone,
      deviceId,
      tlName: tlName !== undefined ? tlName : '',
      ryanEmployeeCode: ryanEmployeeCode || null,   // main: store employee code
      managerId: resolvedManagerId,
      teamLeadId: resolvedTeamLeadId,
    };

    const user = await User.create(userData);
    await invalidateEmployees();
    return res.status(201).json({
      success: true,
      data: user,
      message: targetRole === 'employee' ? 'Employee created' : 'User created',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/employees/:id — retrieve single employee within hierarchy
router.get('/:id', protect, async (req, res) => {
  try {
    const isSelf = req.user._id.toString() === req.params.id;
    const inScope = isSelf || (await validateEmployeeInScope(req.user, req.params.id));
    if (!inScope) {
      return res.status(403).json({ success: false, error: 'Access denied: employee outside your hierarchy' });
    }

    const employee = await User.findOne({ _id: req.params.id, role: 'employee' });
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    return res.json({ success: true, data: employee });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/employees/:id/status
router.patch('/:id/status', protect, isAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, error: 'isActive must be a boolean' });
    }
    const employee = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    await invalidateEmployees();
    return res.json({ success: true, data: employee });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/employees/:id/target
router.patch('/:id/target', protect, isAdmin, async (req, res) => {
  try {
    const { dailyTarget } = req.body;
    if (typeof dailyTarget !== 'number' || dailyTarget < 0) {
      return res.status(400).json({ success: false, error: 'dailyTarget must be a non-negative number' });
    }
    const employee = await User.findByIdAndUpdate(req.params.id, { dailyTarget }, { new: true });
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    await invalidateEmployees();
    return res.json({ success: true, data: employee });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/employees/:id
router.put('/:id', protect, isAdmin, async (req, res) => {
  try {
    const { name, phone, deviceId, tlName, ryanEmployeeCode, password } = req.body;

    // ryanEmployeeCode uniqueness check (main-branch requirement)
    if (ryanEmployeeCode) {
      const dupe = await User.findOne({ ryanEmployeeCode, _id: { $ne: req.params.id } });
      if (dupe) return res.status(400).json({ success: false, error: 'Employee ID already in use' });
    }

    const updates = { name, phone, deviceId, tlName };
    if (ryanEmployeeCode !== undefined) updates.ryanEmployeeCode = ryanEmployeeCode || null;

    // Password reset via Admin UI (stash-branch requirement)
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      }
      const bcrypt = require('bcryptjs');
      updates.password = await bcrypt.hash(password, 10);
    }

    const employee = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
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
router.delete('/:id', protect, isAdmin, async (req, res) => {
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
    await invalidateEmployees();
    return res.json({ success: true, message: 'Employee deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
