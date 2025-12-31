require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { env } = require('../src/config/env');

async function main() {
  const databaseUrl = env.databaseUrl;
  if (!databaseUrl) {
    throw new Error('Missing env: DATABASE_URL');
  }

  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const client = new Client({
    connectionString: databaseUrl,
    options: `-c search_path=${env.dbSchema},public`,
  });
  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('DB migrate: OK');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('DB migrate: FAILED');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
