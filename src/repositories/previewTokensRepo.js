const crypto = require('crypto');
const { getPool } = require('../db/pool');

function sha256Base64url(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('base64url');
}

async function createPreviewToken({
  token,
  purpose,
  userId,
  fileId,
  expiresAt,
  maxUses,
}) {
  const pool = getPool();
  const tokenHash = sha256Base64url(token);
  const result = await pool.query(
    `
      INSERT INTO preview_tokens (token_hash, purpose, user_id, file_id, expires_at, max_uses)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, expires_at, max_uses
    `,
    [tokenHash, purpose, userId, fileId, expiresAt, maxUses],
  );
  return result.rows[0];
}

async function findActivePreviewToken({ token, purpose }) {
  const pool = getPool();
  const tokenHash = sha256Base64url(token);
  const result = await pool.query(
    `
      SELECT id, token_hash, purpose, user_id, file_id, max_uses, used_count, expires_at, revoked_at
      FROM preview_tokens
      WHERE token_hash = $1
        AND purpose = $2
      LIMIT 1
    `,
    [tokenHash, purpose],
  );
  const row = result.rows[0] || null;
  if (!row) return null;
  if (row.revoked_at) return null;
  if (row.expires_at && new Date(row.expires_at) <= new Date()) return null;
  if (Number(row.used_count) >= Number(row.max_uses)) return null;
  return row;
}

async function consumePreviewToken({ id }) {
  const pool = getPool();
  const result = await pool.query(
    `
      WITH bumped AS (
        UPDATE preview_tokens
        SET used_count = used_count + 1, last_used_at = now()
        WHERE id = $1 AND revoked_at IS NULL
        RETURNING id, used_count, max_uses, expires_at, revoked_at
      )
      UPDATE preview_tokens pt
      SET revoked_at = CASE WHEN b.used_count >= b.max_uses THEN now() ELSE pt.revoked_at END
      FROM bumped b
      WHERE pt.id = b.id
      RETURNING pt.used_count, pt.max_uses, pt.revoked_at
    `,
    [id],
  );
  return result.rows[0] || null;
}

module.exports = {
  createPreviewToken,
  consumePreviewToken,
  findActivePreviewToken,
  sha256Base64url,
};

