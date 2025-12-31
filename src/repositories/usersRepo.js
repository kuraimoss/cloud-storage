const { getPool } = require('../db/pool');

async function findUserByUsername(username) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT id, username, email, password_hash, role, storage_quota_bytes, created_at, updated_at FROM users WHERE username = $1',
    [username],
  );
  return result.rows[0] || null;
}

async function findUserById(id) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT id, username, email, role, storage_quota_bytes, created_at, updated_at FROM users WHERE id = $1',
    [id],
  );
  return result.rows[0] || null;
}

async function createUser({ username, email, passwordHash, role, storageQuotaBytes }) {
  const pool = getPool();
  const result = await pool.query(
    `
      INSERT INTO users (username, email, password_hash, role, storage_quota_bytes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, email, role, storage_quota_bytes, created_at
    `,
    [username, email || null, passwordHash, role || 'user', storageQuotaBytes || 5368709120],
  );
  return result.rows[0];
}

async function updateUserQuota(userId, storageQuotaBytes) {
  const pool = getPool();
  const result = await pool.query(
    `
      UPDATE users
      SET storage_quota_bytes = $2, updated_at = now()
      WHERE id = $1
      RETURNING id, username, storage_quota_bytes
    `,
    [userId, storageQuotaBytes],
  );
  return result.rows[0] || null;
}

async function listUsersWithUsage() {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT
        u.id,
        u.username,
        u.email,
        u.role,
        u.storage_quota_bytes,
        COALESCE(SUM(f.size_bytes) FILTER (WHERE f.is_deleted = false), 0)::bigint AS used_bytes,
        u.created_at
      FROM users u
      LEFT JOIN files f ON f.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT 200
    `,
  );
  return result.rows;
}

async function deleteUserById(userId) {
  const pool = getPool();
  const result = await pool.query(
    'DELETE FROM users WHERE id = $1 RETURNING id, username, role',
    [userId],
  );
  return result.rows[0] || null;
}

module.exports = {
  createUser,
  deleteUserById,
  findUserById,
  findUserByUsername,
  listUsersWithUsage,
  updateUserQuota,
};
