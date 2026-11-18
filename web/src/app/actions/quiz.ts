'use server';
import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db, schema as s } from '@/db';
import { requireUser } from '@/lib/auth';
import { evaluate, InvalidAnswerError, totalScore, type QuestionType, type QuestionData } from '@/lib/scoring';
import { feedbackFor, MODES, pickQuestions, type QuizMode } from '@/lib/quiz';

export type StartState = { error?: string } | undefined;

const Start = z.object({
  mode: z.enum(Object.keys(MODES) as [QuizMode, ...QuizMode[]]),
  courseId: z.union([z.uuid(), z.literal('')]).optional(),
  chapterId: z.union([z.uuid(), z.literal('')]).optional(),
  topic: z.string().max(40).optional(),
  count: z.coerce.number().int().min(3).max(60).optional(),
  minutes: z.coerce.number().int().min(5).max(240).optional(),
});

export async function startQuiz(_: StartState, form: FormData): Promise<StartState> {
  const u = await requireUser();
  const p = Start.safeParse({ ...Object.fromEntries(form), courseIds: undefined });
  if (!p.success) return { error: 'Check the options of the quiz.' };
  const courseIds = form.getAll('courseIds').map(String).filter((x) => /^[0-9a-f-]{36}$/.test(x));
  const r = await pickQuestions(u.id, { ...p.data, courseId: p.data.courseId || undefined, chapterId: p.data.chapterId || undefined, courseIds });
  if ('error' in r) return { error: r.error };
  const [a] = await db.insert(s.quizAttempts).values({
    userId: u.id, mode: p.data.mode, courseId: r.courseId, chapterId: r.chapterId, questionIds: r.ids,
    timeLimitSec: p.data.mode === 'exam' ? (p.data.minutes ?? Math.max(10, r.ids.length * 2)) * 60 : null,
  }).returning({ id: s.quizAttempts.id });
  redirect(`/revision/quiz/${a.id}`);
}

const GRACE_MS = 30_000;

export type AnswerResult =
  | { status: 'saved' } // exam mode: recorded, feedback at the end
  | { status: 'evaluated'; score: number; correct: boolean; evaluation: string; detail: Record<string, unknown>; feedback: ReturnType<typeof feedbackFor>; response: unknown }
  | { status: 'error'; message: string };

export async function submitAnswer(attemptId: string, questionId: string, response: unknown): Promise<AnswerResult> {
  const u = await requireUser();
  const [a] = await db.select().from(s.quizAttempts).where(and(eq(s.quizAttempts.id, attemptId), eq(s.quizAttempts.userId, u.id)));
  if (!a) return { status: 'error', message: 'This quiz no longer exists.' };
  if (a.finishedAt) return { status: 'error', message: 'This quiz is finished: start a new attempt to answer again.' };
  if (!a.questionIds.includes(questionId)) return { status: 'error', message: 'This question is not part of the quiz.' };
  if (a.timeLimitSec && Date.now() > a.startedAt.getTime() + a.timeLimitSec * 1000 + GRACE_MS) return { status: 'error', message: 'Time is up: hand in the exam to see your results.' };
  const [q] = await db.select().from(s.questions).where(eq(s.questions.id, questionId));
  const [existing] = await db.select().from(s.answers).where(and(eq(s.answers.attemptId, attemptId), eq(s.answers.questionId, questionId)));
  const exam = a.mode === 'exam';

  // In practice modes an evaluated answer is final; only a written answer awaiting self-assessment can be completed.
  if (!exam && existing && existing.evaluation !== 'needs_review') {
    return { status: 'evaluated', score: existing.score, correct: existing.correct, evaluation: existing.evaluation, detail: {}, feedback: feedbackFor(q), response: existing.response };
  }
  let ev;
  try { ev = evaluate(q.type as QuestionType, q.data as QuestionData, response); }
  catch (e) { return { status: 'error', message: e instanceof InvalidAnswerError ? e.message : 'The answer could not be read.' }; }
  await db.insert(s.answers).values({ attemptId, questionId, response: response as object, score: ev.score, correct: ev.correct, evaluation: ev.evaluation })
    .onConflictDoUpdate({ target: [s.answers.attemptId, s.answers.questionId], set: { response: response as object, score: ev.score, correct: ev.correct, evaluation: ev.evaluation, answeredAt: new Date() } });
  if (exam) return { status: 'saved' };
  return { status: 'evaluated', score: ev.score, correct: ev.correct, evaluation: ev.evaluation, detail: ev.detail, feedback: feedbackFor(q), response };
}

/** Self-assessment of a written answer once the exam is handed in. */
export async function selfAssess(attemptId: string, questionId: string, rubricMet: number[]) {
  const u = await requireUser();
  const [a] = await db.select().from(s.quizAttempts).where(and(eq(s.quizAttempts.id, attemptId), eq(s.quizAttempts.userId, u.id)));
  if (!a) return;
  const [existing] = await db.select().from(s.answers).where(and(eq(s.answers.attemptId, attemptId), eq(s.answers.questionId, questionId)));
  const [q] = await db.select().from(s.questions).where(eq(s.questions.id, questionId));
  if (!existing || !q || existing.evaluation === 'auto') return;
  const ev = evaluate(q.type as QuestionType, q.data as QuestionData, { ...(existing.response as object), rubricMet });
  await db.update(s.answers).set({ score: ev.score, correct: ev.correct, evaluation: ev.evaluation }).where(eq(s.answers.id, existing.id));
  if (a.finishedAt) await recompute(a.id, a.questionIds.length);
  revalidatePath(`/revision/quiz/${attemptId}`);
}

async function recompute(attemptId: string, n: number) {
  const rows = await db.select({ score: s.answers.score }).from(s.answers).where(eq(s.answers.attemptId, attemptId));
  const t = totalScore([...rows.map((r) => r.score), ...Array(Math.max(0, n - rows.length)).fill(0)]);
  await db.update(s.quizAttempts).set({ score: t.score, maxScore: t.max }).where(eq(s.quizAttempts.id, attemptId));
}

export async function finishQuiz(attemptId: string) {
  const u = await requireUser();
  const [a] = await db.select().from(s.quizAttempts).where(and(eq(s.quizAttempts.id, attemptId), eq(s.quizAttempts.userId, u.id)));
  if (!a) return;
  if (!a.finishedAt) {
    await recompute(a.id, a.questionIds.length);
    await db.update(s.quizAttempts).set({ finishedAt: new Date() }).where(eq(s.quizAttempts.id, a.id));
  }
  revalidatePath('/'); revalidatePath('/revision');
  redirect(`/revision/quiz/${attemptId}`);
}

export async function restartQuiz(attemptId: string) {
  const u = await requireUser();
  const [a] = await db.select().from(s.quizAttempts).where(and(eq(s.quizAttempts.id, attemptId), eq(s.quizAttempts.userId, u.id)));
  if (!a) redirect('/revision');
  const ids = a.questionIds.slice().sort(() => Math.random() - 0.5);
  const [n] = await db.insert(s.quizAttempts).values({ userId: u.id, mode: a.mode, courseId: a.courseId, chapterId: a.chapterId, questionIds: ids, timeLimitSec: a.timeLimitSec }).returning({ id: s.quizAttempts.id });
  redirect(`/revision/quiz/${n.id}`);
}
