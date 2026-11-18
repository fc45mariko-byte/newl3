import 'server-only';
import { and, asc, desc, eq, gte, isNotNull, isNull, lte, sql, inArray } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import { conceptMastery, summarise } from './mastery';

export async function currentSemester(userId: string) {
  const [row] = await db.select({ code: s.semesters.code, year: s.academicYears.label, startsOn: s.semesters.startsOn, endsOn: s.semesters.endsOn })
    .from(s.semesters).innerJoin(s.academicYears, eq(s.academicYears.id, s.semesters.yearId))
    .where(and(eq(s.academicYears.userId, userId), eq(s.semesters.isCurrent, true))).limit(1);
  return row ?? { code: 'S5', year: '2026-2027', startsOn: null, endsOn: null };
}

/** Every answer of the student, with the concept it tests. */
export async function answerPoints(userId: string, courseId?: string) {
  const rows = await db.select({ conceptId: s.questions.conceptId, score: s.answers.score, at: s.answers.answeredAt, chapterId: s.questions.chapterId, evaluation: s.answers.evaluation })
    .from(s.answers).innerJoin(s.quizAttempts, eq(s.quizAttempts.id, s.answers.attemptId)).innerJoin(s.questions, eq(s.questions.id, s.answers.questionId))
    .where(and(eq(s.quizAttempts.userId, userId), ...(courseId ? [eq(s.quizAttempts.courseId, courseId)] : [])));
  return rows.filter((r) => r.conceptId && r.evaluation !== 'needs_review').map((r) => ({ conceptId: r.conceptId!, score: r.score, at: r.at, chapterId: r.chapterId }));
}

export async function dashboard(userId: string) {
  const sem = await currentSemester(userId);
  const courses = await db.select().from(s.courses).where(eq(s.courses.userId, userId)).orderBy(asc(s.courses.position));
  const active = courses.filter((c) => !c.outsideProgramme && c.semesters.includes(sem.code));
  const activeIds = active.map((c) => c.id);
  const chapters = activeIds.length ? await db.select({ id: s.chapters.id, courseId: s.chapters.courseId, title: s.chapters.title, slug: s.chapters.slug, priority: s.chapters.priority, position: s.chapters.position })
    .from(s.chapters).where(inArray(s.chapters.courseId, activeIds)).orderBy(asc(s.chapters.position)) : [];
  const progress = await db.select().from(s.chapterProgress).where(eq(s.chapterProgress.userId, userId));
  const read = new Set(progress.filter((p) => p.readAt).map((p) => p.chapterId));
  const opened = new Set(progress.map((p) => p.chapterId));
  const chapterIds = new Set(chapters.map((c) => c.id));

  const now = new Date();
  const events = await db.select().from(s.events).where(and(eq(s.events.userId, userId), gte(s.events.endsAt, now))).orderBy(asc(s.events.startsAt));
  const exams = events.filter((e) => e.kind === 'exam');
  const assignments = events.filter((e) => e.kind === 'assignment');
  const openTasks = await db.select().from(s.tasks).where(and(eq(s.tasks.userId, userId), isNull(s.tasks.doneAt))).orderBy(sql`${s.tasks.dueOn} asc nulls last`, desc(s.tasks.createdAt));
  const objectives = await db.select().from(s.objectives).where(eq(s.objectives.userId, userId)).orderBy(asc(s.objectives.position));

  // Recent activity
  const recent = await db.select({ chapter: s.chapters.title, chapterSlug: s.chapters.slug, course: s.courses.title, courseSlug: s.courses.slug, openedAt: s.chapterProgress.openedAt, readAt: s.chapterProgress.readAt })
    .from(s.chapterProgress).innerJoin(s.chapters, eq(s.chapters.id, s.chapterProgress.chapterId)).innerJoin(s.courses, eq(s.courses.id, s.chapters.courseId))
    .where(eq(s.chapterProgress.userId, userId)).orderBy(desc(s.chapterProgress.openedAt)).limit(8);
  const [lastRead] = await db.select({ chapter: s.chapters.title, chapterSlug: s.chapters.slug, courseSlug: s.courses.slug, readAt: s.chapterProgress.readAt })
    .from(s.chapterProgress).innerJoin(s.chapters, eq(s.chapters.id, s.chapterProgress.chapterId)).innerJoin(s.courses, eq(s.courses.id, s.chapters.courseId))
    .where(and(eq(s.chapterProgress.userId, userId), isNotNull(s.chapterProgress.readAt))).orderBy(desc(s.chapterProgress.readAt)).limit(1);
  const [lastQuiz] = await db.select({ id: s.quizAttempts.id, mode: s.quizAttempts.mode, score: s.quizAttempts.score, max: s.quizAttempts.maxScore, finishedAt: s.quizAttempts.finishedAt, course: s.courses.title })
    .from(s.quizAttempts).leftJoin(s.courses, eq(s.courses.id, s.quizAttempts.courseId))
    .where(and(eq(s.quizAttempts.userId, userId), isNotNull(s.quizAttempts.finishedAt))).orderBy(desc(s.quizAttempts.finishedAt)).limit(1);

  // Knowledge actually demonstrated
  const conceptCount = activeIds.length ? (await db.select({ n: sql<number>`count(distinct ${s.conceptChapters.conceptId})::int` }).from(s.conceptChapters)
    .innerJoin(s.chapters, eq(s.chapters.id, s.conceptChapters.chapterId)).where(inArray(s.chapters.courseId, activeIds)))[0].n : 0;
  const points = (await answerPoints(userId)).filter((p) => chapterIds.has(p.chapterId));
  const mastery = conceptMastery(points);
  const knowledge = summarise(mastery, conceptCount);

  const exParts = activeIds.length ? await db.select({ id: s.exercises.id, parts: s.exercises.parts }).from(s.exercises).innerJoin(s.chapters, eq(s.chapters.id, s.exercises.chapterId)).where(inArray(s.chapters.courseId, activeIds)) : [];
  const totalParts = exParts.reduce((a, e) => a + e.parts.length, 0);
  const doneParts = (await db.select({ n: sql<number>`count(distinct (${s.exerciseAttempts.exerciseId}, ${s.exerciseAttempts.partId}))::int` }).from(s.exerciseAttempts)
    .where(and(eq(s.exerciseAttempts.userId, userId), eq(s.exerciseAttempts.correct, true))))[0].n;

  const due = (await db.select({ n: sql<number>`count(*)::int` }).from(s.cardStates).where(and(eq(s.cardStates.userId, userId), lte(s.cardStates.dueAt, now))))[0].n;

  // Suggested next activity: due reviews first, then a weak concept, then the next essential chapter not yet read.
  let suggestion: { title: string; detail: string; href: string };
  const weak = [...mastery.values()].filter((m) => m.status === 'needs_work');
  const nextChapter = chapters.find((c) => c.priority === 'ESSENTIAL' && !read.has(c.id));
  if (due > 0) suggestion = { title: `Review ${due} flashcard${due > 1 ? 's' : ''}`, detail: 'Cards are due today in your spaced-repetition schedule.', href: '/revision/flashcards' };
  else if (weak.length) suggestion = { title: 'Work on your weak concepts', detail: `${weak.length} concept${weak.length > 1 ? 's' : ''} answered wrongly more than once.`, href: '/revision?start=weakness' };
  else if (nextChapter) { const c = active.find((x) => x.id === nextChapter.courseId)!; suggestion = { title: `Read “${nextChapter.title}”`, detail: `${c.title} · essential chapter`, href: `/courses/${c.slug}/chapters/${nextChapter.slug}` }; }
  else suggestion = { title: 'Take a mixed quiz', detail: 'Check what you remember across your courses.', href: '/revision' };

  const perCourse = active.map((c) => {
    const ch = chapters.filter((x) => x.courseId === c.id);
    const readN = ch.filter((x) => read.has(x.id)).length;
    const cm = points.filter((p) => ch.some((x) => x.id === p.chapterId));
    const m = summarise(conceptMastery(cm), 0);
    return { ...c, chapters: ch.length, read: readN, understood: m.understood, needsWork: m.needsWork };
  });

  return {
    sem, courses, active: perCourse, chaptersTotal: chapters.length, chaptersRead: [...read].filter((id) => chapterIds.has(id)).length,
    chaptersInProgress: [...opened].filter((id) => chapterIds.has(id) && !read.has(id)).length,
    exams, assignments, openTasks, objectives, recent, lastRead, lastQuiz, knowledge, exercises: { done: doneParts, total: totalParts }, due, suggestion,
    incomplete: courses.filter((c) => c.missing || c.researchStatus === 'not_researched' || c.researchStatus === 'in_progress'),
    events: events.slice(0, 8),
  };
}
