const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { HttpError } = require('../utils/httpError');
const usersRepo = require('../repositories/usersRepo');

const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

async function login({ username, password }) {
  const parsed = loginSchema.safeParse({ username, password });
  if (!parsed.success) throw new HttpError(400, 'Invalid credentials');

  const user = await usersRepo.findUserByUsername(parsed.data.username);
  if (!user) throw new HttpError(401, 'Invalid username or password');

  const ok = await bcrypt.compare(parsed.data.password, user.password_hash);
  if (!ok) throw new HttpError(401, 'Invalid username or password');

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    storageQuotaBytes: Number(user.storage_quota_bytes),
  };
}

module.exports = { login };
