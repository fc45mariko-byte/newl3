// Brings existing accounts up to date with data/curriculum.json (see src/lib/sync-curriculum.ts for what is and is not touched).
// Usage: npm run db:sync            (every account)
//        SYNC_EMAIL=… npm run db:sync (one account)
import { eq } from 'drizzle-orm';
import { db, pool, schema } from '../src/db';
import { syncCurriculum } from '../src/lib/sync-curriculum';

const users = process.env.SYNC_EMAIL
  ? await db.select().from(schema.users).where(eq(schema.users.email, process.env.SYNC_EMAIL.toLowerCase()))
  : await db.select().from(schema.users);
if (!users.length) console.log('No matching account.');
for (const u of users) console.log(u.email, await syncCurriculum(db, u.id));
await pool.end();
