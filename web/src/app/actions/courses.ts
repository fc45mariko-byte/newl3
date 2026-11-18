'use server';
import { and, eq, max } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { unlink } from 'node:fs/promises';
import { db, schema as s } from '@/db';
import { requireUser } from '@/lib/auth';
import { saveDocument, UploadError } from '@/lib/documents';

export type ActionState = { error?: string; ok?: string } | undefined;

const slugify = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'course';

const CourseInput = z.object({
  title: z.string().trim().min(2, 'Give the course a title.').max(140),
  language: z.enum(['fr', 'en', 'es'], 'Choose the language of instruction.'),
  semesters: z.array(z.enum(['S5', 'S6'])).default([]),
  category: z.string().trim().max(60).optional(),
  teacher: z.string().trim().max(120).optional(),
  officialDescription: z.string().trim().max(4000).optional(),
  examStatus: z.string().trim().max(200).optional(),
});
const read = (f: FormData) => ({
  title: f.get('title'), language: f.get('language'), semesters: f.getAll('semesters'), category: f.get('category') || undefined,
  teacher: f.get('teacher') || undefined, officialDescription: f.get('officialDescription') || undefined, examStatus: f.get('examStatus') || undefined,
});

export async function createCourse(_: ActionState, form: FormData): Promise<ActionState> {
  const u = await requireUser();
  const p = CourseInput.safeParse(read(form));
  if (!p.success) return { error: p.error.issues[0].message };
  let slug = slugify(p.data.title);
  const taken = new Set((await db.select({ slug: s.courses.slug }).from(s.courses).where(eq(s.courses.userId, u.id))).map((r) => r.slug));
  for (let i = 2; taken.has(slug); i++) slug = `${slugify(p.data.title)}-${i}`;
  const [{ m }] = await db.select({ m: max(s.courses.position) }).from(s.courses).where(eq(s.courses.userId, u.id));
  await db.insert(s.courses).values({ userId: u.id, slug, ...p.data, position: (m ?? 0) + 1, missing: true, researchStatus: 'not_researched' });
  revalidatePath('/courses');
  redirect(`/courses/${slug}`);
}

export async function updateCourse(slug: string, _: ActionState, form: FormData): Promise<ActionState> {
  const u = await requireUser();
  const p = CourseInput.safeParse(read(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const r = await db.update(s.courses).set(p.data).where(and(eq(s.courses.userId, u.id), eq(s.courses.slug, slug))).returning({ id: s.courses.id });
  if (!r.length) return { error: 'Course not found.' };
  revalidatePath(`/courses/${slug}`);
  return { ok: 'Saved.' };
}

async function ownCourse(userId: string, slug: string) {
  const [c] = await db.select().from(s.courses).where(and(eq(s.courses.userId, userId), eq(s.courses.slug, slug)));
  return c;
}

export async function addChapter(slug: string, _: ActionState, form: FormData): Promise<ActionState> {
  const u = await requireUser();
  const c = await ownCourse(u.id, slug);
  if (!c) return { error: 'Course not found.' };
  const t = z.object({ title: z.string().trim().min(2, 'Give the chapter a title.').max(200), priority: z.enum(['ESSENTIAL', 'IMPORTANT', 'ADVANCED']), reason: z.string().trim().max(300).optional() })
    .safeParse({ title: form.get('title'), priority: form.get('priority'), reason: form.get('reason') || undefined });
  if (!t.success) return { error: t.error.issues[0].message };
  if (t.data.priority === 'ESSENTIAL' && !t.data.reason) return { error: 'Say why this chapter is essential (a course document or an exam requirement).' };
  const [{ m }] = await db.select({ m: max(s.chapters.position) }).from(s.chapters).where(eq(s.chapters.courseId, c.id));
  const base = `${c.slug}.${slugify(t.data.title)}`;
  await db.insert(s.chapters).values({ courseId: c.id, slug: base, position: (m ?? -1) + 1, title: t.data.title, priority: t.data.priority, priorityReason: t.data.reason ?? null, researchStatus: 'not_researched' }).onConflictDoNothing();
  revalidatePath(`/courses/${slug}`);
  return { ok: 'Chapter added. It is marked “not researched” until material or research supports it.' };
}

/** Records a reconstruction request: the chapter enters research and a task is created. */
export async function requestReconstruction(slug: string, chapterSlug: string) {
  const u = await requireUser();
  const c = await ownCourse(u.id, slug);
  if (!c) return;
  const [ch] = await db.update(s.chapters).set({ researchStatus: 'in_progress' }).where(and(eq(s.chapters.courseId, c.id), eq(s.chapters.slug, chapterSlug))).returning();
  if (ch) await db.insert(s.tasks).values({ userId: u.id, title: `Research and reconstruct: ${ch.title}`, category: 'research', courseId: c.id, chapterId: ch.id, priority: ch.priority === 'ESSENTIAL' ? 'high' : 'normal' });
  revalidatePath(`/courses/${slug}`);
}

export async function uploadDocuments(slug: string, _: ActionState, form: FormData): Promise<ActionState> {
  const u = await requireUser();
  const c = await ownCourse(u.id, slug);
  if (!c) return { error: 'Course not found.' };
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: 'Choose at least one file.' };
  const chapterId = (form.get('chapterId') as string) || null;
  const report: string[] = [];
  for (const f of files) {
    try {
      const r = await saveDocument(u.id, { filename: f.name, mime: f.type, buffer: Buffer.from(await f.arrayBuffer()), courseId: c.id, chapterId });
      report.push(r.duplicate ? `${f.name}: already uploaded.` : r.status === 'extracted' ? `${f.name}: text extracted.` : `${f.name}: stored, but ${r.error}`);
    } catch (e) {
      report.push(`${f.name}: ${e instanceof UploadError ? e.message : 'upload failed.'}`);
    }
  }
  if (c.missing) await db.update(s.courses).set({ missing: false }).where(eq(s.courses.id, c.id));
  revalidatePath(`/courses/${slug}/resources`);
  return { ok: report.join('\n') };
}

export async function deleteDocument(slug: string, id: string) {
  const u = await requireUser();
  const [d] = await db.delete(s.documents).where(and(eq(s.documents.id, id), eq(s.documents.userId, u.id))).returning();
  if (d && !d.storagePath.startsWith('db:')) await unlink(d.storagePath).catch(() => undefined); // older documents stored on disk
  revalidatePath(`/courses/${slug}/resources`);
}

export async function addSource(slug: string, _: ActionState, form: FormData): Promise<ActionState> {
  const u = await requireUser();
  const p = z.object({
    title: z.string().trim().min(2, 'Enter the title.').max(300), author: z.string().trim().min(1, 'Enter the author or institution.').max(200),
    url: z.union([z.url('Enter a valid URL (https://…).'), z.literal('')]).optional(), publishedOn: z.string().trim().max(40).optional(),
    type: z.string().trim().max(80).optional(), relevance: z.string().trim().max(600).optional(),
  }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const key = `u.${Date.now().toString(36)}`;
  await db.insert(s.sources).values({ userId: u.id, key, title: p.data.title, author: p.data.author, url: p.data.url || null, publishedOn: p.data.publishedOn || null, type: p.data.type || 'External resource', tier: 'P3', access: 'reference', relevance: p.data.relevance ?? '' });
  const c = await ownCourse(u.id, slug);
  if (c) await db.update(s.courses).set({ officialSourceKeys: [...c.officialSourceKeys, key] }).where(eq(s.courses.id, c.id));
  revalidatePath(`/courses/${slug}/resources`);
  return { ok: 'Resource added.' };
}
