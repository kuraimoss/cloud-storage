const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { asyncHandler } = require('../../utils/asyncHandler');
const { HttpError } = require('../../utils/httpError');
const usersRepo = require('../../repositories/usersRepo');
const activityRepo = require('../../repositories/activityRepo');
const { getUserUploadDirPath } = require('../../utils/uploads');
const fs = require('fs');

const createUserSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/),
  email: z.string().email().optional().nullable(),
  password: z.string().min(8).max(200),
  quotaBytes: z.number().int().positive(),
});

const updateQuotaSchema = z.object({
  quotaBytes: z.number().int().positive(),
});

const listUsers = asyncHandler(async (_req, res) => {
  const users = await usersRepo.listUsersWithUsage();
  res.json({
    ok: true,
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      quotaBytes: Number(u.storage_quota_bytes),
      usedBytes: Number(u.used_bytes),
      createdAt: u.created_at,
    })),
  });
});

const createUser = asyncHandler(async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body || {});
  if (!parsed.success) throw new HttpError(400, 'Invalid input');

  const { username, email, password, quotaBytes } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);

  const created = await usersRepo.createUser({
    username,
    email,
    passwordHash,
    role: 'user',
    storageQuotaBytes: quotaBytes,
  });

  await activityRepo.logActivity({
    userId: req.session.userId,
    fileId: null,
    action: 'admin.user.create',
    meta: { createdUserId: created.id, username: created.username },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(201).json({
    ok: true,
    user: {
      id: created.id,
      username: created.username,
      email: created.email,
      role: created.role,
      quotaBytes: Number(created.storage_quota_bytes),
    },
  });
});

const updateQuota = asyncHandler(async (req, res) => {
  const parsed = updateQuotaSchema.safeParse(req.body || {});
  if (!parsed.success) throw new HttpError(400, 'Invalid input');

  const targetUserId = req.params.id;
  const updated = await usersRepo.updateUserQuota(targetUserId, parsed.data.quotaBytes);
  if (!updated) throw new HttpError(404, 'User not found');

  await activityRepo.logActivity({
    userId: req.session.userId,
    fileId: null,
    action: 'admin.user.quota.update',
    meta: { targetUserId, quotaBytes: parsed.data.quotaBytes },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({
    ok: true,
    user: {
      id: updated.id,
      username: updated.username,
      quotaBytes: Number(updated.storage_quota_bytes),
    },
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  const targetUserId = req.params.id;

  if (req.session.userId === targetUserId) {
    throw new HttpError(400, 'Cannot delete your own account');
  }

  const target = await usersRepo.findUserById(targetUserId);
  if (!target) throw new HttpError(404, 'User not found');
  if (target.role === 'super_admin') throw new HttpError(403, 'Cannot delete super admin');

  const deleted = await usersRepo.deleteUserById(targetUserId);
  if (!deleted) throw new HttpError(404, 'User not found');

  const dir = getUserUploadDirPath(targetUserId);
  await fs.promises.rm(dir, { recursive: true, force: true });

  await activityRepo.logActivity({
    userId: req.session.userId,
    fileId: null,
    action: 'admin.user.delete',
    meta: { deletedUserId: deleted.id, username: deleted.username },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ ok: true });
});

module.exports = {
  createUser,
  deleteUser,
  listUsers,
  updateQuota,
};
