const mongoose = require('mongoose');
const User = require('../models/User');

function isSystemAdmin(user) {
  return Boolean(user && (user.role === 'admin' || user.isSuperAdmin === true));
}

/**
 * Resolves the list of Team Lead ObjectIds managed by the given user.
 * - admin / isSuperAdmin: null (unrestricted)
 * - manager: array of TL ObjectIds where TL.managerId === user._id
 * - tl: [user._id]
 * - employee: []
 */
async function getScopedTLIds(user) {
  if (!user) return [];
  if (isSystemAdmin(user)) return null;
  if (user.role === 'manager') {
    return User.distinct('_id', { role: 'tl', managerId: user._id });
  }
  if (user.role === 'tl') {
    return [user._id];
  }
  return [];
}

/**
 * Resolves the list of Employee/Agent ObjectIds within the given user's hierarchy.
 * - admin / isSuperAdmin: null (unrestricted, matches all employees)
 * - manager: array of Employee ObjectIds whose teamLeadId belongs to one of this Manager's TLs
 * - tl: array of Employee ObjectIds whose teamLeadId === user._id
 * - employee: [user._id] (self only)
 */
async function getScopedEmployeeIds(user) {
  if (!user) return [];
  if (isSystemAdmin(user)) return null;

  if (user.role === 'manager') {
    const tlIds = await User.distinct('_id', { role: 'tl', managerId: user._id });
    if (!tlIds.length) return [];
    return User.distinct('_id', { role: 'employee', teamLeadId: { $in: tlIds } });
  }

  if (user.role === 'tl') {
    return User.distinct('_id', { role: 'employee', teamLeadId: user._id });
  }

  if (user.role === 'employee') {
    return [user._id];
  }

  return [];
}

/**
 * Validates whether a specific employeeId falls within the user's permitted hierarchy.
 * Returns boolean (true/false).
 */
async function validateEmployeeInScope(user, employeeId) {
  if (!user || !employeeId) return false;
  if (isSystemAdmin(user)) return true;

  const empIdStr = employeeId.toString();

  if (user.role === 'employee') {
    return empIdStr === user._id.toString();
  }

  if (user.role === 'tl') {
    const exists = await User.exists({
      _id: employeeId,
      role: 'employee',
      teamLeadId: user._id,
    });
    return !!exists;
  }

  if (user.role === 'manager') {
    const emp = await User.findOne({ _id: employeeId, role: 'employee' }).select('teamLeadId').lean();
    if (!emp || !emp.teamLeadId) return false;
    const tlExists = await User.exists({
      _id: emp.teamLeadId,
      role: 'tl',
      managerId: user._id,
    });
    return !!tlExists;
  }

  return false;
}

/**
 * Validates whether a specific TL falls within the user's permitted hierarchy.
 */
async function validateTLInScope(user, tlId) {
  if (!user || !tlId) return false;
  if (isSystemAdmin(user)) return true;

  const tlIdStr = tlId.toString();

  if (user.role === 'tl') {
    return tlIdStr === user._id.toString();
  }

  if (user.role === 'manager') {
    const exists = await User.exists({
      _id: tlId,
      role: 'tl',
      managerId: user._id,
    });
    return !!exists;
  }

  return false;
}

/**
 * Helper for read endpoints. Resolves the scoped employee filter.
 *
 * @param {Object} user - Logged in user (req.user)
 * @param {string|Array<string>|null} requestedEmployeeIdOrIds - Client-supplied query param
 * @param {string} fieldName - DB field name (e.g. 'employeeId' or 'assignedTo')
 * @returns {Promise<{ allowed: boolean, filter: Object, error?: string }>}
 */
async function resolveEmployeeFilter(user, requestedEmployeeIdOrIds, fieldName = 'employeeId') {
  // System Admin (admin or isSuperAdmin) is unrestricted unless explicitly filtering
  if (isSystemAdmin(user)) {
    if (!requestedEmployeeIdOrIds) {
      return { allowed: true, filter: {} };
    }
    if (Array.isArray(requestedEmployeeIdOrIds)) {
      const valid = requestedEmployeeIdOrIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
      return { allowed: true, filter: { [fieldName]: { $in: valid } } };
    }
    if (mongoose.Types.ObjectId.isValid(requestedEmployeeIdOrIds)) {
      return { allowed: true, filter: { [fieldName]: requestedEmployeeIdOrIds } };
    }
    return { allowed: true, filter: { [fieldName]: requestedEmployeeIdOrIds } };
  }

  // Manager & TL require server-derived scoping
  const scopedEmployeeIds = await getScopedEmployeeIds(user);
  const scopedIdStrings = new Set(scopedEmployeeIds.map((id) => id.toString()));

  // 1. Client specified a single employee
  if (typeof requestedEmployeeIdOrIds === 'string' && requestedEmployeeIdOrIds.length > 0) {
    if (!scopedIdStrings.has(requestedEmployeeIdOrIds)) {
      return { allowed: false, error: 'Access denied: requested employee is outside your hierarchy' };
    }
    return { allowed: true, filter: { [fieldName]: requestedEmployeeIdOrIds } };
  }

  // 2. Client specified multiple employees
  if (Array.isArray(requestedEmployeeIdOrIds) && requestedEmployeeIdOrIds.length > 0) {
    const intersected = requestedEmployeeIdOrIds.filter((id) => scopedIdStrings.has(id.toString()));
    if (!intersected.length) {
      return { allowed: false, error: 'Access denied: none of the requested employees are in your hierarchy' };
    }
    return { allowed: true, filter: { [fieldName]: { $in: intersected } } };
  }

  // 3. No explicit employee requested -> apply the entire hierarchy scope
  return { allowed: true, filter: { [fieldName]: { $in: scopedEmployeeIds } } };
}

module.exports = {
  getScopedTLIds,
  getScopedEmployeeIds,
  validateEmployeeInScope,
  validateTLInScope,
  resolveEmployeeFilter,
};
