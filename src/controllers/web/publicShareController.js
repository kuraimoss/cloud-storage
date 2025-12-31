const { asyncHandler } = require('../../utils/asyncHandler');
const { HttpError } = require('../../utils/httpError');
const { env } = require('../../config/env');
const sharesRepo = require('../../repositories/sharesRepo');
const activityRepo = require('../../repositories/activityRepo');
const { verifyShareToken } = require('../../services/shareService');
const { getStoredFilePath } = require('../../utils/uploads');

function shareSecret() {
  return env.shareTokenSecret || env.sessionSecret;
}

const downloadShared = asyncHandler(async (req, res) => {
  const secret = shareSecret();
  if (!secret) throw new HttpError(500, 'Missing server config');

  const token = req.params.token;
  const shareId = verifyShareToken(token, secret);
  if (!shareId) throw new HttpError(404, 'Not found');

  const share = await sharesRepo.findShareById(shareId);
  if (!share) throw new HttpError(404, 'Not found');
  if (!share.is_active) throw new HttpError(403, 'Link revoked');
  if (share.is_deleted) throw new HttpError(404, 'Not found');
  if (share.expires_at && new Date(share.expires_at) <= new Date()) throw new HttpError(403, 'Link expired');

  await activityRepo.logActivity({
    userId: null,
    fileId: share.file_id,
    action: 'share.download',
    meta: { shareId: share.id },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  const filePath = getStoredFilePath(share.user_id, share.stored_name);
  res.download(filePath, share.original_name);
});

module.exports = { downloadShared };

