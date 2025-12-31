const { asyncHandler } = require('../../utils/asyncHandler');
const authService = require('../../services/authService');
const usersRepo = require('../../repositories/usersRepo');
const { HttpError } = require('../../utils/httpError');

const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  const user = await authService.login({ username, password });

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;

  res.json({ ok: true, user });
});

const logout = asyncHandler(async (req, res) => {
  if (!req.session) return res.json({ ok: true });
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

const me = asyncHandler(async (req, res) => {
  if (!req.session || !req.session.userId) throw new HttpError(401, 'Unauthorized');
  const user = await usersRepo.findUserById(req.session.userId);
  res.json({ ok: true, user });
});

module.exports = {
  login,
  logout,
  me,
};
