const jwt = require('jsonwebtoken');
const User = require('../models/User');

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
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

const requireRole = (...roles) => {
  const allowedRoles = roles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Access denied: insufficient permissions' });
    }
    next();
  };
};

const isSystemAdmin = (user) => Boolean(user && (user.role === 'admin' || user.isSuperAdmin === true));

const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  if (!isSystemAdmin(req.user)) {
    return res.status(403).json({ success: false, error: 'Access denied: insufficient permissions' });
  }
  next();
};

const isManager = requireRole('manager');
const isTL = requireRole('tl');
const isEmployee = requireRole('employee');
const requireManagement = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  if (isSystemAdmin(req.user) || ['manager', 'tl'].includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ success: false, error: 'Access denied: insufficient permissions' });
};

module.exports = { protect, requireRole, isSystemAdmin, isAdmin, isManager, isTL, isEmployee, requireManagement };

