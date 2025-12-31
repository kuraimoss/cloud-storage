const { asyncHandler } = require('../../utils/asyncHandler');
const { HttpError } = require('../../utils/httpError');
const filesRepo = require('../../repositories/filesRepo');
const sharesRepo = require('../../repositories/sharesRepo');
const activityRepo = require('../../repositories/activityRepo');
const { env } = require('../../config/env');
const { signShareId } = require('../../services/shareService');

function getBaseUrl(req) {
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}`;
}

function shareSecret() {
  return env.shareTokenSecret || env.sessionSecret;
}

const toggle = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const fileId = req.params.id;
  const enable = Boolean(req.body?.enable);
  const regenerate = Boolean(req.body?.regenerate);

  const secret = shareSecret();
  if (!secret) throw new HttpError(500, 'Missing server config');

  const file = await filesRepo.findFileByIdForUser(fileId, userId);
  if (!file) throw new HttpError(404, 'File not found');

  if (!enable) {
    await sharesRepo.revokeSharesByFileId(fileId);
    await activityRepo.logActivity({
      userId,
      fileId,
      action: 'file.share.disable',
      meta: {},
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.json({ ok: true, isShared: false, shareUrl: null });
  }

  if (!regenerate) {
    const existing = await sharesRepo.findActiveShareByFileId(fileId);
    if (existing) {
      const token = signShareId(existing.id, secret);
      const url = `${getBaseUrl(req)}/s/${token}`;
      return res.json({ ok: true, isShared: true, shareUrl: url });
    }
  }

  await sharesRepo.revokeSharesByFileId(fileId);
  const share = await sharesRepo.createShare({ fileId, expiresAt: null });

  const token = signShareId(share.id, secret);
  const url = `${getBaseUrl(req)}/s/${token}`;

  await activityRepo.logActivity({
    userId,
    fileId,
    action: 'file.share.enable',
    meta: {},
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ ok: true, isShared: true, shareUrl: url });
});

const list = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const secret = shareSecret();
  if (!secret) throw new HttpError(500, 'Missing server config');

  const shares = await sharesRepo.listSharesByUser(userId);
  const baseUrl = getBaseUrl(req);

  res.json({
    ok: true,
    shares: shares.map((s) => ({
      id: s.id,
      fileId: s.file_id,
      fileName: s.original_name,
      sizeBytes: Number(s.size_bytes),
      createdAt: s.created_at,
      isActive: Boolean(s.is_active),
      expiresAt: s.expires_at,
      shareUrl: s.is_active ? `${baseUrl}/s/${signShareId(s.id, secret)}` : null,
    })),
  });
});

module.exports = { list, toggle };
