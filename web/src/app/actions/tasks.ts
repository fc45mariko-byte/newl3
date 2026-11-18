'use server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db, schema as s } from '@/db';
import { requireUser } from '@/lib/auth';

export type TState = { error?: string; ok?: string } | undefined;
const TaskInput = z.object({
  title: z.string().trim().min(1, 'Write the task.').max(300),
  details: z.string().max(4000).optional(),
  dueOn: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).optional(),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  category: z.string().trim().max(40).optional(),
  courseId: z.union([z.uuid(), z.literal('')]).optional(),
});

export async function saveTask(taskId: string | null, _: TState, form: FormData): Promise<TState> {
  const u = await requireUser();
  const p = TaskInput.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const courseId = p.data.courseId || null;
  if (courseId) { const [c] = await db.select({ id: s.courses.id }).from(s.courses).where(and(eq(s.courses.id, courseId), eq(s.courses.userId, u.id))); if (!c) return { error: 'Unknown course.' }; }
  const values = { title: p.data.title, details: p.data.details || null, dueOn: p.data.dueOn || null, priority: p.data.priority, category: p.data.category || null, courseId };
  if (taskId) {
    const r = await db.update(s.tasks).set(values).where(and(eq(s.tasks.id, taskId), eq(s.tasks.userId, u.id))).returning({ id: s.tasks.id });
    if (!r.length) return { error: 'Task not found.' };
  } else await db.insert(s.tasks).values({ ...values, userId: u.id });
  revalidatePath('/tasks'); revalidatePath('/');
  return { ok: taskId ? 'Task updated.' : 'Task added.' };
}

export async function setTaskDone(id: string, done: boolean) {
  const u = await requireUser();
  await db.update(s.tasks).set({ doneAt: done ? new Date() : null }).where(and(eq(s.tasks.id, id), eq(s.tasks.userId, u.id)));
  revalidatePath('/tasks'); revalidatePath('/');
}

export async function deleteTask(id: string) {
  const u = await requireUser();
  await db.delete(s.tasks).where(and(eq(s.tasks.id, id), eq(s.tasks.userId, u.id)));
  revalidatePath('/tasks'); revalidatePath('/');
}
