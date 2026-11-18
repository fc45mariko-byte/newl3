import 'server-only';
import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db, schema as s } from '@/db';
import { answerPoints } from './queries';
import { conceptMastery, summarise } from './mastery';

export async function getCourse(userId: string, slug: string) {
  const [course] = await db.select().from(s.courses).where(and(eq(s.courses.userId, userId), eq(s.courses.slug, slug)));
  if (!course) notFound();
  return course;
}

export async function courseOverview(userId: string, slug: string) {
  const course = await getCourse(userId, slug);
  const chapters = await db.select().from(s.chapters).where(eq(s.chapters.courseId, course.id)).orderBy(asc(s.chapters.position));
  const ids = chapters.map((c) => c.id);
  const prog = ids.length ? await db.select().from(s.chapterProgress).where(and(eq(s.chapterProgress.userId, userId), inArray(s.chapterProgress.chapterId, ids))) : [];
  const counts = ids.length ? await db.select({ chapterId: s.conceptChapters.chapterId, n: sql<number>`count(*)::int` }).from(s.conceptChapters).where(inArray(s.conceptChapters.chapterId, ids)).groupBy(s.conceptChapters.chapterId) : [];
  const qCounts = ids.length ? await db.select({ chapterId: s.questions.chapterId, n: sql<number>`count(*)::int` }).from(s.questions).where(inArray(s.questions.chapterId, ids)).groupBy(s.questions.chapterId) : [];
  const docs = await db.select({ id: s.documents.id, filename: s.documents.filename, status: s.documents.status }).from(s.documents).where(and(eq(s.documents.userId, userId), eq(s.documents.courseId, course.id)));
  const points = (await answerPoints(userId)).filter((p) => ids.includes(p.chapterId));
  const perChapter = new Map<string, ReturnType<typeof summarise>>();
  for (const id of ids) perChapter.set(id, summarise(conceptMastery(points.filter((p) => p.chapterId === id)), 0));
  const total = summarise(conceptMastery(points), counts.reduce((a, c) => a + c.n, 0));
  return {
    course, docs, total,
    chapters: chapters.map((c) => ({
      ...c, read: !!prog.find((p) => p.chapterId === c.id)?.readAt, opened: !!prog.find((p) => p.chapterId === c.id),
      concepts: counts.find((x) => x.chapterId === c.id)?.n ?? 0, questions: qCounts.find((x) => x.chapterId === c.id)?.n ?? 0, mastery: perChapter.get(c.id)!,
    })),
  };
}

export async function chapterPage(userId: string, slug: string, chapterSlug: string) {
  const course = await getCourse(userId, slug);
  const chapters = await db.select({ id: s.chapters.id, slug: s.chapters.slug, title: s.chapters.title, position: s.chapters.position }).from(s.chapters).where(eq(s.chapters.courseId, course.id)).orderBy(asc(s.chapters.position));
  const [chapter] = await db.select().from(s.chapters).where(and(eq(s.chapters.courseId, course.id), eq(s.chapters.slug, chapterSlug)));
  if (!chapter) notFound();
  const sections = await db.select().from(s.sections).where(eq(s.sections.chapterId, chapter.id)).orderBy(asc(s.sections.position));
  const concepts = await db.select({ c: s.concepts, position: s.conceptChapters.position }).from(s.conceptChapters).innerJoin(s.concepts, eq(s.concepts.id, s.conceptChapters.conceptId))
    .where(eq(s.conceptChapters.chapterId, chapter.id)).orderBy(asc(s.conceptChapters.position));
  const conceptIds = concepts.map((x) => x.c.id);
  const links = conceptIds.length ? await db.select({ fromId: s.conceptLinks.fromId, toId: s.conceptLinks.toId, relation: s.conceptLinks.relation, toSlug: s.concepts.slug, toTerm: s.concepts.term })
    .from(s.conceptLinks).innerJoin(s.concepts, eq(s.concepts.id, s.conceptLinks.toId)).where(inArray(s.conceptLinks.fromId, conceptIds)) : [];
  const allKeys = [...new Set([...chapter.sourceKeys, ...sections.flatMap((x) => x.sourceKeys), ...concepts.flatMap((x) => x.c.sourceKeys)])];
  const sources = allKeys.length ? await db.select().from(s.sources).where(and(eq(s.sources.userId, userId), inArray(s.sources.key, allKeys))) : [];
  const docs = await db.select({ id: s.documents.id, filename: s.documents.filename, status: s.documents.status }).from(s.documents)
    .where(and(eq(s.documents.userId, userId), eq(s.documents.courseId, course.id)));
  const counts = {
    questions: (await db.select({ n: sql<number>`count(*)::int` }).from(s.questions).where(eq(s.questions.chapterId, chapter.id)))[0].n,
    flashcards: (await db.select({ n: sql<number>`count(*)::int` }).from(s.flashcards).where(eq(s.flashcards.chapterId, chapter.id)))[0].n,
    exercises: (await db.select({ n: sql<number>`count(*)::int` }).from(s.exercises).where(eq(s.exercises.chapterId, chapter.id)))[0].n,
  };
  const notes = await db.select().from(s.notes).where(and(eq(s.notes.userId, userId), eq(s.notes.chapterId, chapter.id))).orderBy(desc(s.notes.updatedAt));
  const [progress] = await db.select().from(s.chapterProgress).where(and(eq(s.chapterProgress.userId, userId), eq(s.chapterProgress.chapterId, chapter.id)));
  const mastery = conceptMastery((await answerPoints(userId)).filter((p) => p.chapterId === chapter.id));
  // Prerequisite chapters from other courses
  const prereq = chapter.prerequisites.length ? await db.select({ slug: s.chapters.slug, title: s.chapters.title, courseSlug: s.courses.slug, courseTitle: s.courses.title })
    .from(s.chapters).innerJoin(s.courses, eq(s.courses.id, s.chapters.courseId)).where(and(eq(s.courses.userId, userId), inArray(s.chapters.slug, chapter.prerequisites))) : [];
  // Other courses where this chapter's concepts reappear (cross-course connections).
  void isNotNull;
  return { course, chapters, chapter, sections, concepts: concepts.map((x) => x.c), links, sources, docs, counts, notes, progress, mastery, prereq };
}
