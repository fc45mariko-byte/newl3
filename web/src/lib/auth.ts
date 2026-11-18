import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash, randomBytes } from 'node:crypto';
import { eq, and, gt } from 'drizzle-orm';
import { db, schema } from '@/db';

const COOKIE = 'lea_session';
const DAYS = 60;
const hash = (t: string) => createHash('sha256').update(t).digest('hex');

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + DAYS * 86_400_000);
  await db.insert(schema.sessions).values({ id: hash(token), userId, expiresAt });
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires: expiresAt });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, hash(token)));
  jar.delete(COOKIE);
}

export type CurrentUser = { id: string; name: string; email: string };

export async function currentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, hash(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

/** Use in every page and action that touches student data. */
export async function requireUser(): Promise<CurrentUser> {
  const u = await currentUser();
  if (!u) redirect('/login');
  return u;
}
