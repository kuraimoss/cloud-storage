require('dotenv').config();

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { env } = require('../src/config/env');

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

async function upsertUser({ client, username, email, password, role, storageQuotaBytes, force }) {
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await client.query('SELECT id FROM users WHERE username = $1', [username]);
  if (existing.rowCount > 0) {
    if (!force) return { status: 'exists' };
    await client.query(
      'UPDATE users SET password_hash = $2, email = COALESCE($3, email), role = $4, storage_quota_bytes = COALESCE($5, storage_quota_bytes), updated_at = now() WHERE username = $1',
      [username, passwordHash, email || null, role || 'user', storageQuotaBytes || null],
    );
    return { status: 'updated' };
  }

  await client.query(
    'INSERT INTO users (username, email, password_hash, role, storage_quota_bytes) VALUES ($1, $2, $3, $4, $5)',
    [username, email || null, passwordHash, role || 'user', storageQuotaBytes || 5368709120],
  );
  return { status: 'created' };
}

async function main() {
  const databaseUrl = env.databaseUrl;
  if (!databaseUrl) throw new Error('Missing env: DATABASE_URL');
  const adminUsername = process.env.ADMIN_USERNAME || null;
  const adminPassword = process.env.ADMIN_PASSWORD || null;
  const adminEmail = process.env.ADMIN_EMAIL || null;
  const superAdminUsername = process.env.SUPER_ADMIN_USERNAME || null;
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || null;
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || null;
  const force = process.env.FORCE === '1';

  const client = new Client({
    connectionString: databaseUrl,
    options: `-c search_path=${env.dbSchema},public`,
  });
  await client.connect();

  try {
    await client.query('BEGIN');

    if (superAdminUsername && superAdminPassword) {
      const result = await upsertUser({
        client,
        username: superAdminUsername,
        email: superAdminEmail,
        password: superAdminPassword,
        role: 'super_admin',
        storageQuotaBytes: 1099511627776, // 1 TiB
        force,
      });
      console.log(`DB seed: super admin ${result.status}.`);
    } else {
      console.log('DB seed: super admin skipped (missing SUPER_ADMIN_USERNAME/PASSWORD).');
    }

    if (adminUsername && adminPassword) {
      const result = await upsertUser({
        client,
        username: adminUsername,
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        storageQuotaBytes: 5368709120,
        force,
      });
      console.log(`DB seed: admin ${result.status}.`);
    } else {
      console.log('DB seed: admin skipped (missing ADMIN_USERNAME/PASSWORD).');
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
