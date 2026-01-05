const { getPool } = require('../db/pool');

async function findActiveShareByFileId(fileId) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT id, file_id, short_code, is_active, expires_at, created_at, revoked_at, view_count, download_count, last_viewed_at
      FROM shared_files
      WHERE file_id = $1 AND is_active = true AND (expires_at IS NULL OR expires_at > now())
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [fileId],
  );
  return result.rows[0] || null;
}

async function findLatestShareByFileId(fileId) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT id, file_id, short_code, is_active, expires_at, created_at, revoked_at, view_count, download_count, last_viewed_at
      FROM shared_files
      WHERE file_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [fileId],
  );
  return result.rows[0] || null;
}

async function createShare({ fileId, shortCode, expiresAt }) {
  const pool = getPool();
  const result = await pool.query(
    `
      INSERT INTO shared_files (file_id, short_code, expires_at, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING id, file_id, short_code, created_at
    `,
    [fileId, shortCode || null, expiresAt || null],
  );
  return result.rows[0];
}

async function reactivateShare({ shareId, expiresAt }) {
  const pool = getPool();
  const result = await pool.query(
    `
      UPDATE shared_files
      SET is_active = true,
          revoked_at = NULL,
          expires_at = COALESCE($2, expires_at)
      WHERE id = $1
      RETURNING id, file_id, short_code, is_active, expires_at, created_at, revoked_at, view_count, download_count, last_viewed_at
    `,
    [shareId, expiresAt || null],
  );
  return result.rows[0] || null;
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
      SELECT sf.id, sf.file_id, sf.short_code, sf.is_active, sf.expires_at, sf.created_at, sf.revoked_at,
             sf.view_count, sf.download_count, sf.last_viewed_at,
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

async function findShareByShortCode(shortCode) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT sf.id, sf.file_id, sf.short_code, sf.is_active, sf.expires_at, sf.created_at, sf.revoked_at,
             sf.view_count, sf.download_count, sf.last_viewed_at,
             f.user_id, f.original_name, f.stored_name, f.mime_type, f.size_bytes, f.is_deleted
      FROM shared_files sf
      JOIN files f ON f.id = sf.file_id
      WHERE sf.short_code = $1
      ORDER BY sf.created_at DESC
      LIMIT 1
    `,
    [shortCode],
  );
  return result.rows[0] || null;
}

async function setShareShortCode({ shareId, shortCode }) {
  const pool = getPool();
  const result = await pool.query(
    `
      UPDATE shared_files
      SET short_code = $2
      WHERE id = $1 AND short_code IS NULL
      RETURNING id, short_code
    `,
    [shareId, shortCode],
  );
  return result.rows[0] || null;
}

async function incrementShareViewCount(shareId) {
  const pool = getPool();
  await pool.query(
    `
      UPDATE shared_files
      SET view_count = view_count + 1, last_viewed_at = now()
      WHERE id = $1
    `,
    [shareId],
  );
}

async function incrementShareDownloadCount(shareId) {
  const pool = getPool();
  await pool.query(
    `
      UPDATE shared_files
      SET download_count = download_count + 1
      WHERE id = $1
    `,
    [shareId],
  );
}

async function listSharesByUser(userId) {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT DISTINCT ON (sf.file_id)
        sf.id,
        sf.short_code,
        sf.is_active,
        sf.expires_at,
        sf.created_at,
        sf.view_count,
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
  findLatestShareByFileId,
  findShareById,
  findShareByShortCode,
  incrementShareDownloadCount,
  incrementShareViewCount,
  listSharesByUser,
  reactivateShare,
  revokeSharesByFileId,
  setShareShortCode,
};
