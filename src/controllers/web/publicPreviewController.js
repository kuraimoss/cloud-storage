const { asyncHandler } = require('../../utils/asyncHandler');
const { HttpError } = require('../../utils/httpError');
const { env } = require('../../config/env');
const filesRepo = require('../../repositories/filesRepo');
const { detectPreviewKind } = require('../../services/previewService');
const { verifyToken } = require('../../services/publicTokenService');
const previewTokensRepo = require('../../repositories/previewTokensRepo');
const { getStoredFilePath } = require('../../utils/uploads');
const { streamFile } = require('../../utils/fileStreaming');

function tokenSecret() {
  return env.shareTokenSecret || env.sessionSecret;
}

const rawOfficePreview = asyncHandler(async (req, res) => {
  const secret = tokenSecret();
  if (!secret) throw new HttpError(500, 'Missing server config');

  const token = String(req.params.token || '').trim();
  let userId = '';
  let fileId = '';
  let tokenRowId = null;

  const row = await previewTokensRepo.findActivePreviewToken({ token, purpose: 'office_preview' });
  if (row) {
    tokenRowId = row.id;
    userId = row.user_id;
    fileId = row.file_id;
  } else {
    // Legacy fallback (older stateless token)
    const payload = verifyToken(token, secret);
    if (!payload) throw new HttpError(404, 'Not found');
    const now = Date.now();
    const expMs = Number(payload.expMs || 0);
    if (!expMs || !Number.isFinite(expMs) || expMs <= now) throw new HttpError(403, 'Link expired');
    if (payload.purpose !== 'office_preview') throw new HttpError(404, 'Not found');
    fileId = String(payload.fileId || '');
    userId = String(payload.userId || '');
    if (!fileId || !userId) throw new HttpError(404, 'Not found');
  }

  const file = await filesRepo.findFileByIdForUser(fileId, userId);
  if (!file) throw new HttpError(404, 'Not found');

  const kind = detectPreviewKind({ mimeType: file.mime_type, name: file.original_name });
  if (kind !== 'office') throw new HttpError(415, 'Preview not supported');

  const filePath = getStoredFilePath(userId, file.stored_name);
  res.setHeader('Cache-Control', 'private, max-age=0, no-store');

  await streamFile(req, res, {
    filePath,
    filename: file.original_name,
    mimeType: file.mime_type || 'application/octet-stream',
    disposition: 'inline',
  });

  if (tokenRowId) {
    try {
      await previewTokensRepo.consumePreviewToken({ id: tokenRowId });
    } catch {
      // ignore
    }
  }
});

module.exports = { rawOfficePreview };
