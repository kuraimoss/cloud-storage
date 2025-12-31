const { getPool } = require('../db/pool');

async function findActiveShareByFileId(fileId) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT id, file_id, is_active, expires_at, created_at, revoked_at
      FROM shared_files
      WHERE file_id = $1 AND is_active = true AND (expires_at IS NULL OR expires_at > now())
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [fileId],
  );
  return result.rows[0] || null;
}

async function createShare({ fileId, tokenHash, expiresAt }) {
  const pool = getPool();
  const result = await pool.query(
    `
      INSERT INTO shared_files (file_id, expires_at, is_active)
      VALUES ($1, $2, true)
      RETURNING id, file_id, created_at
    `,
    [fileId, expiresAt || null],
  );
  return result.rows[0];
}

async function revokeSharesByFileId(fileId) {
  const pool = getPool();
  await pool.query(
    `
      UPDATE shared_files
      SET is_active = false, revoked_at = now()
      WHERE file_id = $1 AND is_active = true
    `,
    [fileId],
  );
}

async function findShareById(shareId) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT sf.id, sf.file_id, sf.is_active, sf.expires_at, sf.created_at, sf.revoked_at,
             f.user_id, f.original_name, f.stored_name, f.mime_type, f.size_bytes, f.is_deleted
      FROM shared_files sf
      JOIN files f ON f.id = sf.file_id
      WHERE sf.id = $1
      ORDER BY sf.created_at DESC
      LIMIT 1
    `,
    [shareId],
  );
  return result.rows[0] || null;
}

async function listSharesByUser(userId) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT DISTINCT ON (sf.file_id)
        sf.id,
        sf.is_active,
        sf.expires_at,
        sf.created_at,
        f.id AS file_id,
        f.original_name,
        f.size_bytes
      FROM shared_files sf
      JOIN files f ON f.id = sf.file_id
      WHERE f.user_id = $1 AND f.is_deleted = false
        AND sf.is_active = true
        AND (sf.expires_at IS NULL OR sf.expires_at > now())
      ORDER BY sf.file_id, sf.created_at DESC
      LIMIT 200
    `,
    [userId],
  );
  return result.rows;
}

async function countActiveSharesByUser(userId) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM shared_files sf
      JOIN files f ON f.id = sf.file_id
      WHERE f.user_id = $1
        AND f.is_deleted = false
        AND sf.is_active = true
        AND (sf.expires_at IS NULL OR sf.expires_at > now())
    `,
    [userId],
  );
  return result.rows[0].count;
}

module.exports = {
  createShare,
  countActiveSharesByUser,
  findActiveShareByFileId,
  findShareById,
  listSharesByUser,
  revokeSharesByFileId,
};
