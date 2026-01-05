const { asyncHandler } = require('../../utils/asyncHandler');
const { HttpError } = require('../../utils/httpError');
const filesRepo = require('../../repositories/filesRepo');
const sharesRepo = require('../../repositories/sharesRepo');
const activityRepo = require('../../repositories/activityRepo');
const { env } = require('../../config/env');
const { generateShareCode } = require('../../services/shareService');

function getBaseUrl(req) {
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}`;
}

function getPublicShareBaseUrl(req) {
  const base = String(env.publicShareBaseUrl || getBaseUrl(req)).replace(/\/+$/, '');
  if (/^https?:\/\//i.test(base)) return base;
  if (base.startsWith('//')) return `https:${base}`;
  return `https://${base}`;
}

async function ensureShortCode(share) {
  if (!share) return null;
  if (share.short_code) return share.short_code;

  const attempts = 12;
  for (let i = 0; i < attempts; i += 1) {
    const code = generateShareCode(env.shareCodeLength);
    try {
      const updated = await sharesRepo.setShareShortCode({ shareId: share.id, shortCode: code });
      if (updated?.short_code) return updated.short_code;
      const latest = await sharesRepo.findShareById(share.id);
      if (latest?.short_code) return latest.short_code;
    } catch (err) {
      if (err?.code === '23505') continue;
      throw err;
    }
  }
  throw new HttpError(500, 'Failed to allocate share code');
}

async function createShareWithUniqueCode({ fileId, expiresAt }) {
  const attempts = 12;
  for (let i = 0; i < attempts; i += 1) {
    const shortCode = generateShareCode(env.shareCodeLength);
    try {
      return await sharesRepo.createShare({ fileId, shortCode, expiresAt });
    } catch (err) {
      if (err?.code === '23505') continue;
      throw err;
    }
  }
  throw new HttpError(500, 'Failed to allocate share code');
}

const toggle = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const fileId = req.params.id;
  const enable = Boolean(req.body?.enable);
  const regenerate = Boolean(req.body?.regenerate);
  const expiresAtRaw = req.body?.expiresAt;

  const file = await filesRepo.findFileByIdForUser(fileId, userId);
  if (!file) throw new HttpError(404, 'File not found');

  let expiresAt = null;
  if (expiresAtRaw) {
    const d = new Date(expiresAtRaw);
    if (!Number.isNaN(d.getTime())) expiresAt = d.toISOString();
  }

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
      const code = await ensureShortCode(existing);
      const base = getPublicShareBaseUrl(req);
      return res.json({
        ok: true,
        isShared: true,
        shareCode: code,
        shareUrl: `${base}/f/${code}`,
        shareRawUrl: `${base}/f/${code}/raw`,
      });
    }

    const latest = await sharesRepo.findLatestShareByFileId(fileId);
    if (latest && !latest.is_active && (!latest.expires_at || new Date(latest.expires_at) > new Date())) {
      const reactivated = await sharesRepo.reactivateShare({ shareId: latest.id, expiresAt: expiresAt });
      const code = await ensureShortCode(reactivated);
      const base = getPublicShareBaseUrl(req);
      return res.json({
        ok: true,
        isShared: true,
        shareCode: code,
        shareUrl: `${base}/f/${code}`,
        shareRawUrl: `${base}/f/${code}/raw`,
      });
    }
  }

  await sharesRepo.revokeSharesByFileId(fileId);
  const share = await createShareWithUniqueCode({ fileId, expiresAt });
  const base = getPublicShareBaseUrl(req);

  await activityRepo.logActivity({
    userId,
    fileId,
    action: 'file.share.enable',
    meta: {},
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({
    ok: true,
    isShared: true,
    shareCode: share.short_code,
    shareUrl: `${base}/f/${share.short_code}`,
    shareRawUrl: `${base}/f/${share.short_code}/raw`,
  });
});

const list = asyncHandler(async (req, res) => {
  const userId = req.session.userId;

  const shares = await sharesRepo.listSharesByUser(userId);
  const baseUrl = getPublicShareBaseUrl(req);

  const normalized = await Promise.all(
    shares.map(async (s) => {
      const code = s.short_code ? s.short_code : await ensureShortCode(s);
      return { ...s, short_code: code };
    }),
  );

  res.json({
    ok: true,
    shares: normalized.map((s) => ({
      id: s.id,
      fileId: s.file_id,
      fileName: s.original_name,
      sizeBytes: Number(s.size_bytes),
      createdAt: s.created_at,
      isActive: Boolean(s.is_active),
      expiresAt: s.expires_at,
      viewCount: Number(s.view_count || 0),
      shareCode: s.short_code || null,
      shareUrl: s.is_active && s.short_code ? `${baseUrl}/f/${s.short_code}` : null,
    })),
  });
});

module.exports = { list, toggle };
