const AuditLog = require('../models/AuditLog');

async function logAction(req, action, { entity, entityId, details } = {}) {
  try {
    await AuditLog.create({
      userId:   req.user?._id,
      userName: req.user?.name,
      action,
      entity,
      entityId,
      details,
      ip: req.headers['x-forwarded-for']?.split(',')[0] || req.ip,
    });
  } catch {}
}

module.exports = { logAction };
