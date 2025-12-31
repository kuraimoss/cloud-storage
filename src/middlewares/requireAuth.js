const { HttpError } = require('../utils/httpError');

function requireAuth(req, _res, next) {
  if (!req.session || !req.session.userId) {
    return next(new HttpError(401, 'Unauthorized'));
  }
  return next();
}

module.exports = { requireAuth };

