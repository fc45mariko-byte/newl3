import 'server-only';
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db, schema as s } from '@/db';
import { answerPoints } from './queries';
import { conceptMastery } from './mastery';
import { bucket } from './sm2';

/** Revision analytics. Every figure comes from recorded answers; no estimate is shown as a fact. */
export async function revisionAnalytics(userId: string) {
  const rows = await db.select({
    score: s.answers.score, correct: s.answers.correct, evaluation: s.answers.evaluation, at: s.answers.answeredAt, type: s.questions.type, difficulty: s.questions.difficulty,
    chapter: s.chapters.title, chapterSlug: s.chapters.slug, course: s.courses.title, courseSlug: s.courses.slug, questionId: s.questions.id, stem: s.questions.stem,
  }).from(s.answers).innerJoin(s.quizAttempts, eq(s.quizAttempts.id, s.answers.attemptId)).innerJoin(s.questions, eq(s.questions.id, s.answers.questionId))
    .innerJoin(s.chapters, eq(s.chapters.id, s.questions.chapterId)).innerJoin(s.courses, eq(s.courses.id, s.chapters.courseId))
    .where(and(eq(s.quizAttempts.userId, userId)));
  const graded = rows.filter((r) => r.evaluation !== 'needs_review');
  const group = (key: (r: (typeof graded)[number]) => string) => {
    const m = new Map<string, { n: number; sum: number }>();
    for (const r of graded) { const k = key(r); const v = m.get(k) ?? { n: 0, sum: 0 }; v.n++; v.sum += r.score; m.set(k, v); }
    return [...m.entries()].map(([k, v]) => ({ key: k, n: v.n, accuracy: v.sum / v.n })).sort((a, b) => a.accuracy - b.accuracy);
  };
  // Questions missed at least twice: recurring weaknesses.
  const missed = new Map<string, { stem: string; course: string; chapter: string; chapterSlug: string; courseSlug: string; n: number }>();
  for (const r of graded) if (!r.correct) { const v = missed.get(r.questionId) ?? { stem: r.stem, course: r.course, chapter: r.chapter, chapterSlug: r.chapterSlug, courseSlug: r.courseSlug, n: 0 }; v.n++; missed.set(r.questionId, v); }
  const recurring = [...missed.values()].filter((v) => v.n >= 2).sort((a, b) => b.n - a.n).slice(0, 8);
  const days: { day: string; n: number; accuracy: number | null }[] = [];
  for (let k = 13; k >= 0; k--) {
    const d = new Date(Date.now() - k * 86_400_000).toISOString().slice(0, 10);
    const list = graded.filter((r) => r.at.toISOString().slice(0, 10) === d);
    days.push({ day: d, n: list.length, accuracy: list.length ? list.reduce((a, r) => a + r.score, 0) / list.length : null });
  }
  const mastery = conceptMastery(await answerPoints(userId));
  const weakConcepts = [...mastery.values()].filter((m) => m.status === 'needs_work').map((m) => m.conceptId);
  const weak = weakConcepts.length ? await db.select({ slug: s.concepts.slug, term: s.concepts.term }).from(s.concepts).where(inArray(s.concepts.id, weakConcepts)) : [];
  const cards = await db.select().from(s.cardStates).where(eq(s.cardStates.userId, userId));
  const cardBuckets = { new: 0, learning: 0, review: 0, mastered: 0, difficult: 0 };
  for (const c of cards) cardBuckets[bucket(c)]++;
  const attempts = await db.select({ id: s.quizAttempts.id, mode: s.quizAttempts.mode, score: s.quizAttempts.score, max: s.quizAttempts.maxScore, finishedAt: s.quizAttempts.finishedAt, startedAt: s.quizAttempts.startedAt, course: s.courses.title })
    .from(s.quizAttempts).leftJoin(s.courses, eq(s.courses.id, s.quizAttempts.courseId)).where(eq(s.quizAttempts.userId, userId)).orderBy(desc(s.quizAttempts.startedAt)).limit(10);
  void isNotNull;
  return {
    total: graded.length, pendingReview: rows.length - graded.length,
    accuracy: graded.length ? graded.reduce((a, r) => a + r.score, 0) / graded.length : null,
    byCourse: group((r) => r.course), byChapter: group((r) => `${r.course} · ${r.chapter}`).slice(0, 8), byType: group((r) => r.type), byDifficulty: group((r) => `Level ${r.difficulty}`),
    recurring, days, weak, cardBuckets, cardsSeen: cards.length, attempts,
  };
}
