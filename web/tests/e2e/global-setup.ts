import { Pool } from 'pg';
import { rmSync } from 'node:fs';
// Each run starts from an empty test database (schema kept, data removed).
export default async function setup() {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5432/leastudy_test' });
  await pool.query('truncate users cascade');
  await pool.end();
  rmSync('./storage-test', { recursive: true, force: true });
}
