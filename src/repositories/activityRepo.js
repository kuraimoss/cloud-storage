const { getPool } = require('../db/pool');

async function logActivity({ userId, fileId, action, meta, ip, userAgent }) {
  const pool = getPool();
  await pool.query(
    `
      INSERT INTO activity_logs (user_id, file_id, action, meta, ip, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [userId || null, fileId || null, action, meta || {}, ip || null, userAgent || null],
  );
}

module.exports = { logActivity };

