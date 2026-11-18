// Creates a student account and imports the curriculum into it. Optionally ingests course files
// from a folder (SEED_UPLOADS_DIR) through the real document pipeline.
// Usage: SEED_EMAIL=… SEED_PASSWORD=… SEED_NAME=… npm run db:seed
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, pool, schema } from '../src/db';
import { importCurriculum } from '../src/lib/import-curriculum';

const email = (process.env.SEED_EMAIL ?? 'etudiante@lea.local').toLowerCase();
const password = process.env.SEED_PASSWORD ?? 'change-me-please';
const name = process.env.SEED_NAME ?? 'Fatima-Christine';
let [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
if (!user) [user] = await db.insert(schema.users).values({ email, name, passwordHash: await bcrypt.hash(password, 10) }).returning();
console.log('User', user.email);
console.log(await importCurriculum(db, user.id));
if (process.env.SEED_UPLOADS_DIR) {
  const { ingestFolder } = await import('../src/lib/documents');
  console.log(await ingestFolder(user.id, process.env.SEED_UPLOADS_DIR));
}
await pool.end();
