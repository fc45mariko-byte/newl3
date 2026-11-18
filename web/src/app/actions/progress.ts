'use server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, schema as s } from '@/db';
import { requireUser } from '@/lib/auth';

async function chapterId(userId: string, course: string, chapter: string) {
  const [r] = await db.select({ id: s.chapters.id }).from(s.chapters).innerJoin(s.courses, eq(s.courses.id, s.chapters.courseId))
    .where(and(eq(s.courses.userId, userId), eq(s.courses.slug, course), eq(s.chapters.slug, chapter)));
  return r?.id;
}
/** Records that the chapter was opened (activity), without marking it as read. */
export async function markOpened(course: string, chapter: string) {
  const u = await requireUser();
  const id = await chapterId(u.id, course, chapter);
  if (!id) return;
  await db.insert(s.chapterProgress).values({ userId: u.id, chapterId: id }).onConflictDoUpdate({ target: [s.chapterProgress.userId, s.chapterProgress.chapterId], set: { openedAt: new Date() } });
}
export async function markChapter(course: string, chapter: string, read: boolean) {
  const u = await requireUser();
  const id = await chapterId(u.id, course, chapter);
  if (!id) return;
  await db.insert(s.chapterProgress).values({ userId: u.id, chapterId: id, readAt: read ? new Date() : null })
    .onConflictDoUpdate({ target: [s.chapterProgress.userId, s.chapterProgress.chapterId], set: { readAt: read ? new Date() : null } });
  revalidatePath(`/courses/${course}/chapters/${chapter}`);
  revalidatePath(`/courses/${course}`);
  revalidatePath('/');
}
