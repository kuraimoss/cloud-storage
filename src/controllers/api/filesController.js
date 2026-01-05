const crypto = require('crypto');
const fs = require('fs');
const { asyncHandler } = require('../../utils/asyncHandler');
const { HttpError } = require('../../utils/httpError');
const { env } = require('../../config/env');
const filesRepo = require('../../repositories/filesRepo');
const usersRepo = require('../../repositories/usersRepo');
const sharesRepo = require('../../repositories/sharesRepo');
const activityRepo = require('../../repositories/activityRepo');
const { validateRename } = require('../../services/filesService');
const { generateShareCode } = require('../../services/shareService');
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
  const base = env.publicShareBaseUrl || getRequestBaseUrl(req);
  return String(base).replace(/\/+$/, '');
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

async function sha256FileHex(filePath) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

const list = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const files = await filesRepo.listFilesByUserWithShareStatus(userId);
  const normalized = await Promise.all(
    files.map(async (f) => {
      if (!f.share_id) return f;
      if (f.share_short_code) return f;
      const code = await ensureShareShortCode(f.share_id, f.share_short_code);
      return { ...f, share_short_code: code };
    }),
  );
  const publicBase = getPublicShareBaseUrl(req);
  res.json({
    ok: true,
    files: normalized.map((f) => {
      const kind = detectPreviewKind({ mimeType: f.mime_type, name: f.original_name });
      const shareCode = f.share_short_code || null;
      return {
        id: f.id,
        name: f.original_name,
        mimeType: f.mime_type,
        sizeBytes: Number(f.size_bytes),
        sizeHuman: bytesToHuman(f.size_bytes),
        createdAt: f.created_at,
        isShared: Boolean(f.share_id),
        shareCode,
        shareUrl: shareCode ? `${publicBase}/f/${shareCode}` : null,
        shareRawUrl: shareCode ? `${publicBase}/f/${shareCode}/raw` : null,
        previewKind: kind,
        previewUrl: kind !== 'none' ? `/api/files/${f.id}/preview` : null,
      };
    }),
  });
});

const upload = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const uploaded = req.files || [];
  if (!uploaded.length) throw new HttpError(400, 'No files uploaded');

  const user = await usersRepo.findUserById(userId);
  if (!user) throw new HttpError(401, 'Unauthorized');

  const incomingBytes = uploaded.reduce((sum, f) => sum + Number(f.size || 0), 0);
  const usedBytes = await filesRepo.getStorageUsageBytes(userId);
  const quotaBytes = BigInt(user.storage_quota_bytes);

  if (BigInt(incomingBytes) + usedBytes > quotaBytes) {
    await Promise.allSettled(
      uploaded.map((f) => fs.promises.unlink(getStoredFilePath(userId, f.filename))),
    );
    throw new HttpError(413, 'Storage quota exceeded');
  }

  const results = [];
  for (const file of uploaded) {
    const storedName = file.filename;
    const filePath = getStoredFilePath(userId, storedName);
    const sha256Hex = await sha256FileHex(filePath);

    const record = await filesRepo.createFile({
      userId,
      originalName: file.originalname,
      storedName,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      sha256Hex,
    });

    await activityRepo.logActivity({
      userId,
      fileId: record.id,
      action: 'file.upload',
      meta: { originalName: file.originalname, sizeBytes: file.size },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    results.push({
      id: record.id,
      name: record.original_name,
      mimeType: record.mime_type,
      sizeBytes: Number(record.size_bytes),
      createdAt: record.created_at,
    });
  }

  res.status(201).json({ ok: true, files: results });
});

const download = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const fileId = req.params.id;
  const file = await filesRepo.findFileByIdForUser(fileId, userId);
  if (!file) throw new HttpError(404, 'File not found');

  await activityRepo.logActivity({
    userId,
    fileId: file.id,
    action: 'file.download',
    meta: {},
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  const filePath = getStoredFilePath(userId, file.stored_name);
  res.download(filePath, file.original_name);
});

const preview = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const fileId = req.params.id;
  const file = await filesRepo.findFileByIdForUser(fileId, userId);
  if (!file) throw new HttpError(404, 'File not found');

  const filePath = getStoredFilePath(userId, file.stored_name);
  res.setHeader('Cache-Control', 'private, max-age=0, no-store');

  const kind = detectPreviewKind({ mimeType: file.mime_type, name: file.original_name });
  if (kind === 'none') throw new HttpError(415, 'Preview not supported');

  if (kind === 'text') {
    const maxBytes = 512 * 1024;
    await streamFilePrefix(req, res, {
      filePath,
      filename: file.original_name,
      maxBytes,
      mimeType: 'text/plain; charset=utf-8',
    });
    return;
  }

  await streamFile(req, res, {
    filePath,
    filename: file.original_name,
    mimeType: file.mime_type || 'application/octet-stream',
    disposition: 'inline',
  });
});

const remove = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const fileId = req.params.id;
  const file = await filesRepo.findFileByIdForUser(fileId, userId);
  if (!file) throw new HttpError(404, 'File not found');

  await sharesRepo.revokeSharesByFileId(fileId);
  const ok = await filesRepo.markFileDeleted(fileId, userId);
  if (!ok) throw new HttpError(404, 'File not found');

  const filePath = getStoredFilePath(userId, file.stored_name);
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // ignore
  }

  await activityRepo.logActivity({
    userId,
    fileId,
    action: 'file.delete',
    meta: { name: file.original_name },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ ok: true });
});

const rename = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const fileId = req.params.id;
  const newName = validateRename({ name: req.body?.name });

  const updated = await filesRepo.renameFile(fileId, userId, newName);
  if (!updated) throw new HttpError(404, 'File not found');

  await activityRepo.logActivity({
    userId,
    fileId,
    action: 'file.rename',
    meta: { name: newName },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ ok: true, file: { id: updated.id, name: updated.original_name } });
});

module.exports = {
  download,
  list,
  preview,
  remove,
  rename,
  upload,
};
