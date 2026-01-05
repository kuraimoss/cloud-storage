function numberFromEnv(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringFromEnv(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function buildDatabaseUrlFromParts() {
  const host = process.env.PGHOST;
  const port = process.env.PGPORT;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  const database = process.env.PGDATABASE;

  if (!host || !port || !user || !password || !database) return '';

  const encodedUser = encodeURIComponent(String(user));
  const encodedPass = encodeURIComponent(String(password));
  const encodedDb = encodeURIComponent(String(database));
  return `postgres://${encodedUser}:${encodedPass}@${host}:${port}/${encodedDb}`;
}

const env = {
  nodeEnv: stringFromEnv(process.env.NODE_ENV, 'development'),
  host: stringFromEnv(process.env.HOST, '0.0.0.0'),
  port: numberFromEnv(process.env.PORT, 2996),
  databaseUrl: stringFromEnv(process.env.DATABASE_URL, '') || buildDatabaseUrlFromParts(),
  dbSchema: stringFromEnv(process.env.DB_SCHEMA, 'cloud_storage'),
  sessionSecret: stringFromEnv(process.env.SESSION_SECRET, ''),
  shareTokenSecret: stringFromEnv(process.env.SHARE_TOKEN_SECRET, ''),
  publicShareBaseUrl: stringFromEnv(process.env.PUBLIC_SHARE_BASE_URL, ''),
  shareCodeLength: numberFromEnv(process.env.SHARE_CODE_LENGTH, 6),
  maxUploadBytes: numberFromEnv(process.env.MAX_UPLOAD_BYTES, 100 * 1024 * 1024),
};

module.exports = { env };
