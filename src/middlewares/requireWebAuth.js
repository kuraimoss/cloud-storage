function requireWebAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  return next();
}

module.exports = { requireWebAuth };

