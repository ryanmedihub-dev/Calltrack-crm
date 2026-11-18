const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { tlNameMatch } = require('../lib/tlFilter');

// Returns true for accounts that have full administrative access (role 'admin',
// role 'manager' with isSuperAdmin flag, or the legacy 'ryanadmin' pattern).
function isSystemAdmin(user) {
  return Boolean(user && (user.role === 'admin' || user.isSuperAdmin === true));
}

// Admins and integration logins (ryan-crm's CALLBY_SERVICE_TOKEN) see every employee.
function hasFullAccess(user) {
  return isSystemAdmin(user) || user?.isServiceAccount === true;
}

// The employee ids whose data this user may see. null = everything.
// Manager/TL: employees whose tlName matches the manager/TL's account name, ignoring case and
// surrounding spaces (flat, no chain).
// Employee: only themselves.
async function teamIdsFor(user) {
  if (hasFullAccess(user)) return null;
  if (user.role === 'manager' || user.role === 'tl') {
    return User.distinct('_id', { role: 'employee', tlName: tlNameMatch(user.name) });
  }
  return [user._id];
}

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    req.user = user;
    req.teamIds = await teamIdsFor(user);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

// ── Scoping helpers — every route that returns employee data goes through these ──

// Adds "field ∈ caller's team" to a Mongo filter / $match. No-op for full-access users.
// Uses $and so it composes with whatever employee/tlName filter the route already built.
function scoped(req, filter = {}, field = 'employeeId') {
  if (req.teamIds) (filter.$and ||= []).push({ [field]: { $in: req.teamIds } });
  return filter;
}

function canAccessEmployee(req, employeeId) {
  if (!req.teamIds) return true;
  const id = String(employeeId?._id ?? employeeId);
  return req.teamIds.some((t) => String(t) === id);
}

// Cache-key segment so a manager never gets another manager's (or the admin's) cached result.
function scopeKey(req) {
  return req.teamIds ? `u:${req.user._id}` : 'all';
}

// ── Gates ──

// Dashboard read access: admins (everything) plus managers/TLs (their own team, via req.teamIds).
const isManager = (req, res, next) => {
  if (!hasFullAccess(req.user) && req.user.role !== 'manager' && req.user.role !== 'tl') {
    return res.status(403).json({ success: false, error: 'Manager access required' });
  }
  next();
};

const isEmployee = (req, res, next) => {
  if (req.user.role !== 'employee') {
    return res.status(403).json({ success: false, error: 'Employee access required' });
  }
  next();
};

// Middleware: allow only system admins (admin role or isSuperAdmin flag).
// Also allows manager-role users who have isSuperAdmin=true (the production ryanadmin account).
const isAdmin = (req, res, next) => {
  if (!isSystemAdmin(req.user)) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
};

// Org-wide writes and integration endpoints: admins + service accounts only.
const requireFullAccess = (req, res, next) => {
  if (!hasFullAccess(req.user)) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
};

module.exports = {
  protect, isManager, isEmployee, isAdmin, requireFullAccess,
  isSystemAdmin, hasFullAccess, scoped, canAccessEmployee, scopeKey,
};
