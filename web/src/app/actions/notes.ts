'use server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db, schema as s } from '@/db';
import { requireUser } from '@/lib/auth';

export type NoteState = { error?: string; ok?: string } | undefined;
const NoteInput = z.object({
  title: z.string().trim().min(1, 'Give the note a title.').max(200),
  body: z.string().max(50_000).default(''),
  kind: z.enum(['note', 'definition', 'quotation', 'question']).default('note'),
  tags: z.string().max(300).default(''),
  chapterId: z.union([z.uuid(), z.literal('')]).optional(),
  conceptId: z.union([z.uuid(), z.literal('')]).optional(),
});

async function courseIdFor(userId: string, slug: string | null) {
  if (!slug) return null;
  const [c] = await db.select({ id: s.courses.id }).from(s.courses).where(and(eq(s.courses.userId, userId), eq(s.courses.slug, slug)));
  return c?.id ?? null;
}

export async function saveNote(courseSlug: string | null, noteId: string | null, _: NoteState, form: FormData): Promise<NoteState> {
  const u = await requireUser();
  const p = NoteInput.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const tags = p.data.tags.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 12);
  const values = { title: p.data.title, body: p.data.body, kind: p.data.kind, tags, chapterId: p.data.chapterId || null, conceptId: p.data.conceptId || null, updatedAt: new Date() };
  if (noteId) {
    const r = await db.update(s.notes).set(values).where(and(eq(s.notes.id, noteId), eq(s.notes.userId, u.id))).returning({ id: s.notes.id });
    if (!r.length) return { error: 'Note not found.' };
  } else {
    await db.insert(s.notes).values({ ...values, userId: u.id, courseId: await courseIdFor(u.id, courseSlug) });
  }
  revalidatePath('/knowledge');
  if (courseSlug) revalidatePath(`/courses/${courseSlug}`, 'layout');
  return { ok: 'Note saved.' };
}

export async function deleteNote(id: string) {
  const u = await requireUser();
  await db.delete(s.notes).where(and(eq(s.notes.id, id), eq(s.notes.userId, u.id)));
  revalidatePath('/knowledge');
  revalidatePath('/courses', 'layout');
}

export async function toggleBookmark(id: string, bookmarked: boolean) {
  const u = await requireUser();
  await db.update(s.notes).set({ bookmarked }).where(and(eq(s.notes.id, id), eq(s.notes.userId, u.id)));
  revalidatePath('/knowledge');
}
