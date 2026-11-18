'use server';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db, schema } from '@/db';
import { createSession, destroySession } from '@/lib/auth';
import { importCurriculum } from '@/lib/import-curriculum';

export type FormState = { error?: string; fields?: Record<string, string> } | undefined;

const Signup = z.object({
  name: z.string().trim().min(1, 'Enter your first name.').max(80),
  email: z.email('Enter a valid email address.').transform((e) => e.toLowerCase()),
  password: z.string().min(10, 'Use at least 10 characters.').max(200),
});

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const parsed = Signup.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: { name: String(form.get('name') ?? ''), email: String(form.get('email') ?? '') } };
  const { name, email, password } = parsed.data;
  const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (exists) return { error: 'An account already uses this email. Sign in instead.', fields: { name, email } };
  const [user] = await db.insert(schema.users).values({ name, email, passwordHash: await bcrypt.hash(password, 10) }).returning();
  await importCurriculum(db, user.id);
  await createSession(user.id);
  redirect('/');
}

const Login = z.object({ email: z.string().trim().toLowerCase(), password: z.string().min(1) });

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = Login.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Enter your email and password.' };
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, parsed.data.email));
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return { error: 'Email or password is incorrect.', fields: { email: parsed.data.email } };
  await createSession(user.id);
  redirect('/');
}

export async function logout() {
  await destroySession();
  redirect('/login');
}
