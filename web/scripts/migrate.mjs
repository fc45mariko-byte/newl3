// Applies the SQL migrations in ./drizzle. Plain JavaScript so it runs on a production host without dev tools.
// Usage: node scripts/migrate.mjs   (reads DATABASE_URL)
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
console.log('Migrations applied.');
await pool.end();
