const { asyncHandler } = require('../../utils/asyncHandler');
const { HttpError } = require('../../utils/httpError');
const { env } = require('../../config/env');
const sharesRepo = require('../../repositories/sharesRepo');
const activityRepo = require('../../repositories/activityRepo');
const { verifyShareToken, generateShareCode } = require('../../services/shareService');
const { detectPreviewKind } = require('../../services/previewService');
const { bytesToHuman } = require('../../utils/bytes');
const { getStoredFilePath } = require('../../utils/uploads');
const { streamFile, streamFilePrefix } = require('../../utils/fileStreaming');

function getRequestBaseUrl(req) {
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}`;
}

function getPublicShareBaseUrl(req) {
  const base = String(env.publicShareBaseUrl || getRequestBaseUrl(req)).replace(/\/+$/, '');
  if (/^https?:\/\//i.test(base)) return base;
  if (base.startsWith('//')) return `https:${base}`;
  return `https://${base}`;
}

function shareSecret() {
  return env.shareTokenSecret || env.sessionSecret;
}

function assertShareAccessible(share) {
  if (!share) throw new HttpError(404, 'Not found');
  if (!share.is_active) throw new HttpError(403, 'Link revoked');
  if (share.is_deleted) throw new HttpError(404, 'Not found');
  if (share.expires_at && new Date(share.expires_at) <= new Date()) throw new HttpError(403, 'Link expired');
}

async function ensureShareShortCode(shareId, currentCode) {
  if (currentCode) return currentCode;
  const attempts = 12;
  for (let i = 0; i < attempts; i += 1) {
    const code = generateShareCode(env.shareCodeLength);
    try {
      const updated = await sharesRepo.setShareShortCode({ shareId, shortCode: code });
      if (updated?.short_code) return updated.short_code;
      const latest = await sharesRepo.findShareById(shareId);
      if (latest?.short_code) return latest.short_code;
    } catch (err) {
      if (err?.code === '23505') continue;
      throw err;
    }
  }
  throw new HttpError(500, 'Failed to allocate share code');
}

const viewShared = asyncHandler(async (req, res) => {
  const code = String(req.params.code || '').trim();
  if (!/^[0-9A-Za-z]{4,16}$/.test(code)) throw new HttpError(404, 'Not found');

  const share = await sharesRepo.findShareByShortCode(code);
  assertShareAccessible(share);

  await sharesRepo.incrementShareViewCount(share.id);
  await activityRepo.logActivity({
    userId: null,
    fileId: share.file_id,
    action: 'share.view',
    meta: { shareId: share.id, shortCode: share.short_code },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  const base = getPublicShareBaseUrl(req);
  const shareUrl = `${base}/f/${share.short_code}`;
  const rawUrl = `${base}/f/${share.short_code}/raw`;
  const downloadUrl = `${base}/f/${share.short_code}/download`;

  res.render('pages/public-share', {
    title: share.original_name,
    pageId: 'public-share',
    bodyClass: 'public',
    share: {
      code: share.short_code,
      url: shareUrl,
      rawUrl,
      downloadUrl,
      fileName: share.original_name,
      mimeType: share.mime_type,
      sizeHuman: bytesToHuman(share.size_bytes),
      createdAt: share.created_at,
      expiresAt: share.expires_at,
      viewCount: Number(share.view_count || 0) + 1,
    },
  });
});

const rawShared = asyncHandler(async (req, res) => {
  const code = String(req.params.code || '').trim();
  if (!/^[0-9A-Za-z]{4,16}$/.test(code)) throw new HttpError(404, 'Not found');

  const share = await sharesRepo.findShareByShortCode(code);
  assertShareAccessible(share);

  const kind = detectPreviewKind({ mimeType: share.mime_type, name: share.original_name });
  if (kind === 'none') throw new HttpError(415, 'Preview not supported');

  const filePath = getStoredFilePath(share.user_id, share.stored_name);
  res.setHeader('Cache-Control', 'private, max-age=0, no-store');

  if (kind === 'text') {
    await streamFilePrefix(req, res, {
      filePath,
      filename: share.original_name,
      maxBytes: 512 * 1024,
      mimeType: 'text/plain; charset=utf-8',
    });
    return;
  }

  await streamFile(req, res, {
    filePath,
    filename: share.original_name,
    mimeType: share.mime_type || 'application/octet-stream',
    disposition: 'inline',
  });
});

const downloadShared = asyncHandler(async (req, res) => {
  const code = String(req.params.code || '').trim();
  if (!/^[0-9A-Za-z]{4,16}$/.test(code)) throw new HttpError(404, 'Not found');

  const share = await sharesRepo.findShareByShortCode(code);
  assertShareAccessible(share);

  await sharesRepo.incrementShareDownloadCount(share.id);
  await activityRepo.logActivity({
    userId: null,
    fileId: share.file_id,
    action: 'share.download',
    meta: { shareId: share.id, shortCode: share.short_code },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  const filePath = getStoredFilePath(share.user_id, share.stored_name);
  res.download(filePath, share.original_name);
});

const legacyTokenRedirect = asyncHandler(async (req, res) => {
  const secret = shareSecret();
  if (!secret) throw new HttpError(500, 'Missing server config');

  const token = req.params.token;
  const shareId = verifyShareToken(token, secret);
  if (!shareId) throw new HttpError(404, 'Not found');

  const share = await sharesRepo.findShareById(shareId);
  assertShareAccessible(share);

  const code = await ensureShareShortCode(share.id, share.short_code);
  const base = getPublicShareBaseUrl(req);
  res.redirect(302, `${base}/f/${code}`);
});

module.exports = {
  downloadShared,
  legacyTokenRedirect,
  rawShared,
  viewShared,
};
