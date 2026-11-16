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

const isManager = (req, res, next) => {
  if (req.user.role !== 'manager') {
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

// Returns true for accounts that have full administrative access (role 'admin',
// role 'manager' with isSuperAdmin flag, or the legacy 'ryanadmin' pattern).
function isSystemAdmin(user) {
  return Boolean(user && (user.role === 'admin' || user.isSuperAdmin === true));
}

// Middleware: allow only system admins (admin role or isSuperAdmin flag).
// Also allows manager-role users who have isSuperAdmin=true (the production ryanadmin account).
const isAdmin = (req, res, next) => {
  if (!isSystemAdmin(req.user)) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
};

module.exports = { protect, isManager, isEmployee, isAdmin, isSystemAdmin };
