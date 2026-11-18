'use server';
import { and, eq, max } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db, schema as s } from '@/db';
import { requireUser } from '@/lib/auth';

export async function toggleObjective(id: string, done: boolean) {
  const u = await requireUser();
  await db.update(s.objectives).set({ done, progress: done ? 100 : 0 }).where(and(eq(s.objectives.id, id), eq(s.objectives.userId, u.id)));
  revalidatePath('/');
}
export async function setObjectiveProgress(id: string, progress: number) {
  const u = await requireUser();
  const p = z.number().int().min(0).max(100).parse(progress);
  await db.update(s.objectives).set({ progress: p, done: p === 100 }).where(and(eq(s.objectives.id, id), eq(s.objectives.userId, u.id)));
  revalidatePath('/');
}
export async function addObjective(form: FormData) {
  const u = await requireUser();
  const title = z.string().trim().min(1).max(160).safeParse(form.get('title'));
  if (!title.success) return;
  const [{ m }] = await db.select({ m: max(s.objectives.position) }).from(s.objectives).where(eq(s.objectives.userId, u.id));
  await db.insert(s.objectives).values({ userId: u.id, title: title.data, position: (m ?? 0) + 1 });
  revalidatePath('/');
}
export async function deleteObjective(id: string) {
  const u = await requireUser();
  await db.delete(s.objectives).where(and(eq(s.objectives.id, id), eq(s.objectives.userId, u.id)));
  revalidatePath('/');
}
