import 'server-only';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { db, schema as s } from '@/db';

/** Courses with their chapters and the skills their questions test, for the quiz start form. */
export async function quizCourses(userId: string) {
  const courses = await db.select({ id: s.courses.id, title: s.courses.title }).from(s.courses).where(eq(s.courses.userId, userId)).orderBy(asc(s.courses.position));
  const ids = courses.map((c) => c.id);
  if (!ids.length) return [];
  const chapters = await db.select({ id: s.chapters.id, title: s.chapters.title, courseId: s.chapters.courseId, n: sql<number>`count(${s.questions.id})::int` })
    .from(s.chapters).leftJoin(s.questions, eq(s.questions.chapterId, s.chapters.id)).where(inArray(s.chapters.courseId, ids))
    .groupBy(s.chapters.id, s.chapters.title, s.chapters.courseId, s.chapters.position).orderBy(asc(s.chapters.position));
  const topics = await db.selectDistinct({ courseId: s.chapters.courseId, topic: s.questions.topic }).from(s.questions).innerJoin(s.chapters, eq(s.chapters.id, s.questions.chapterId)).where(inArray(s.chapters.courseId, ids));
  return courses.map((c) => ({ ...c, chapters: chapters.filter((x) => x.courseId === c.id && x.n > 0), topics: topics.filter((t) => t.courseId === c.id && t.topic).map((t) => t.topic) })).filter((c) => c.chapters.length);
}
