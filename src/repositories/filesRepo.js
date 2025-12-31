const { getPool } = require('../db/pool');

async function createFile({
  userId,
  originalName,
  storedName,
  mimeType,
  sizeBytes,
  sha256Hex,
}) {
  const pool = getPool();
  const result = await pool.query(
    `
      INSERT INTO files (user_id, original_name, stored_name, mime_type, size_bytes, sha256_hex)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, original_name, stored_name, mime_type, size_bytes, sha256_hex, created_at
    `,
    [userId, originalName, storedName, mimeType, sizeBytes, sha256Hex],
  );
  return result.rows[0];
}

async function listFilesByUser(userId) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT id, original_name, mime_type, size_bytes, created_at
      FROM files
      WHERE user_id = $1 AND is_deleted = false
      ORDER BY created_at DESC
    `,
    [userId],
  );
  return result.rows;
}

async function listFilesByUserWithShareStatus(userId) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT
        f.id,
        f.original_name,
        f.mime_type,
        f.size_bytes,
        f.created_at,
        EXISTS (
          SELECT 1
          FROM shared_files sf
          WHERE sf.file_id = f.id
            AND sf.is_active = true
            AND (sf.expires_at IS NULL OR sf.expires_at > now())
        ) AS is_shared
      FROM files f
      WHERE f.user_id = $1 AND f.is_deleted = false
      ORDER BY f.created_at DESC
    `,
    [userId],
  );
  return result.rows;
}

async function countFilesByUser(userId) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM files
      WHERE user_id = $1 AND is_deleted = false
    `,
    [userId],
  );
  return result.rows[0].count;
}

async function findFileByIdForUser(fileId, userId) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT id, user_id, original_name, stored_name, mime_type, size_bytes, created_at
      FROM files
      WHERE id = $1 AND user_id = $2 AND is_deleted = false
    `,
    [fileId, userId],
  );
  return result.rows[0] || null;
}

async function markFileDeleted(fileId, userId) {
  const pool = getPool();
  const result = await pool.query(
    `
      UPDATE files
      SET is_deleted = true, updated_at = now()
      WHERE id = $1 AND user_id = $2 AND is_deleted = false
      RETURNING id
    `,
    [fileId, userId],
  );
  return result.rowCount > 0;
}

async function renameFile(fileId, userId, newOriginalName) {
  const pool = getPool();
  const result = await pool.query(
    `
      UPDATE files
      SET original_name = $3, updated_at = now()
      WHERE id = $1 AND user_id = $2 AND is_deleted = false
      RETURNING id, original_name
    `,
    [fileId, userId, newOriginalName],
  );
  return result.rows[0] || null;
}

async function getStorageUsageBytes(userId) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT COALESCE(SUM(size_bytes), 0)::bigint AS used_bytes
      FROM files
      WHERE user_id = $1 AND is_deleted = false
    `,
    [userId],
  );
  return BigInt(result.rows[0].used_bytes);
}

module.exports = {
  countFilesByUser,
  createFile,
  findFileByIdForUser,
  getStorageUsageBytes,
  listFilesByUser,
  listFilesByUserWithShareStatus,
  markFileDeleted,
  renameFile,
};
