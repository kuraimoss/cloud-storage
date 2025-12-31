const { Pool } = require('pg');
const { env } = require('../config/env');

let pool;

function getPool() {
  if (pool) return pool;
  if (!env.databaseUrl) {
    throw new Error('Missing env: DATABASE_URL');
  }
  pool = new Pool({
    connectionString: env.databaseUrl,
    options: `-c search_path=${env.dbSchema},public`,
  });
  return pool;
}

module.exports = { getPool };
