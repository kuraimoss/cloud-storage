const { asyncHandler } = require('../../utils/asyncHandler');
const usersRepo = require('../../repositories/usersRepo');
const dashboardService = require('../../services/dashboardService');
const { HttpError } = require('../../utils/httpError');

const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const user = await usersRepo.findUserById(userId);
  if (!user) throw new HttpError(401, 'Unauthorized');

  const data = await dashboardService.getDashboard(userId, user.storage_quota_bytes);
  res.json({ ok: true, user, dashboard: data });
});

module.exports = { getDashboard };

