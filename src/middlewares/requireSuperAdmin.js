const { HttpError } = require('../utils/httpError');

function requireSuperAdmin(req, _res, next) {
  if (!req.session || !req.session.userId) return next(new HttpError(401, 'Unauthorized'));
  if (req.session.role !== 'super_admin') return next(new HttpError(403, 'Forbidden'));
  return next();
}

module.exports = { requireSuperAdmin };

