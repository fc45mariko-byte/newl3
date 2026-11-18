import 'server-only';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import type { QuestionType } from './scoring';
import { answerPoints } from './queries';
import { conceptMastery } from './mastery';

export const MODES = {
  chapter: { label: 'Chapter quiz', help: 'Questions covering one complete chapter.' },
  topic: { label: 'Topic quiz', help: 'Questions on one skill (memorise, apply, analyse…) within a course.' },
  mixed: { label: 'Mixed quiz', help: 'Questions drawn from several chapters and courses.' },
  exam: { label: 'Exam simulation', help: 'Timed, no feedback until you hand in. Answers can be changed until the end.' },
  weakness: { label: 'Weakness training', help: 'Questions on the concepts you have answered wrongly.' },
  mastery: { label: 'Mastery test', help: 'A broad test across every chapter of a course, every question type.' },
} as const;
export type QuizMode = keyof typeof MODES;

const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

export type StartParams = { mode: QuizMode; courseId?: string; chapterId?: string; topic?: string; count?: number; minutes?: number; courseIds?: string[] };

/** Chooses the questions of a new attempt. Returns an error message when nothing matches. */
export async function pickQuestions(userId: string, p: StartParams): Promise<{ ids: string[]; courseId: string | null; chapterId: string | null } | { error: string }> {
  const owned = db.select({ id: s.courses.id }).from(s.courses).where(eq(s.courses.userId, userId));
  const base = db.select({ id: s.questions.id, chapterId: s.questions.chapterId, type: s.questions.type, conceptId: s.questions.conceptId, topic: s.questions.topic, courseId: s.chapters.courseId, difficulty: s.questions.difficulty })
    .from(s.questions).innerJoin(s.chapters, eq(s.chapters.id, s.questions.chapterId));
  const count = Math.min(Math.max(p.count ?? 10, 3), 60);
  if (p.mode === 'chapter') {
    if (!p.chapterId) return { error: 'Choose a chapter.' };
    const rows = await base.where(and(eq(s.questions.chapterId, p.chapterId), inArray(s.chapters.courseId, owned)));
    if (!rows.length) return { error: 'This chapter has no question yet.' };
    return { ids: shuffle(rows).slice(0, Math.max(count, 10)).map((r) => r.id), courseId: rows[0].courseId, chapterId: p.chapterId };
  }
  if (p.mode === 'topic') {
    if (!p.courseId || !p.topic) return { error: 'Choose a course and a skill.' };
    const rows = await base.where(and(eq(s.chapters.courseId, p.courseId), eq(s.questions.topic, p.topic), inArray(s.chapters.courseId, owned)));
    if (!rows.length) return { error: 'No question tests this skill in this course.' };
    return { ids: shuffle(rows).slice(0, count).map((r) => r.id), courseId: p.courseId, chapterId: null };
  }
  if (p.mode === 'mixed') {
    const ids = p.courseIds?.length ? p.courseIds : p.courseId ? [p.courseId] : null;
    const rows = await base.where(ids ? and(inArray(s.chapters.courseId, ids), inArray(s.chapters.courseId, owned)) : inArray(s.chapters.courseId, owned));
    if (!rows.length) return { error: 'No question available.' };
    // Spread across chapters: one per chapter in turn.
    const by = new Map<string, typeof rows>();
    for (const r of shuffle(rows)) { if (!by.has(r.chapterId)) by.set(r.chapterId, []); by.get(r.chapterId)!.push(r); }
    const out: string[] = []; const lists = shuffle([...by.values()]);
    while (out.length < count && lists.some((l) => l.length)) for (const l of lists) { const q = l.pop(); if (q && out.length < count) out.push(q.id); }
    return { ids: out, courseId: ids?.length === 1 ? ids[0] : null, chapterId: null };
  }
  if (p.mode === 'exam' || p.mode === 'mastery') {
    if (!p.courseId) return { error: 'Choose a course.' };
    const rows = await base.where(and(eq(s.chapters.courseId, p.courseId), inArray(s.chapters.courseId, owned)));
    if (!rows.length) return { error: 'This course has no question yet.' };
    const n = p.mode === 'mastery' ? Math.max(count, 20) : count;
    // Harder questions first for exams; every question type represented for mastery.
    const by = new Map<string, typeof rows>();
    for (const r of shuffle(rows)) { const k = p.mode === 'mastery' ? r.type : r.chapterId; if (!by.has(k)) by.set(k, []); by.get(k)!.push(r); }
    const out: string[] = []; const lists = [...by.values()].map((l) => l.sort((a, b) => b.difficulty - a.difficulty));
    while (out.length < n && lists.some((l) => l.length)) for (const l of lists) { const q = l.shift(); if (q && out.length < n) out.push(q.id); }
    return { ids: shuffle(out), courseId: p.courseId, chapterId: null };
  }
  // weakness: concepts that need work, then questions answered wrongly
  const points = await answerPoints(userId, p.courseId);
  const weak = [...conceptMastery(points).values()].filter((m) => m.status === 'needs_work' || (m.answers >= 1 && m.accuracy < 0.6)).map((m) => m.conceptId);
  const wrongQ = await db.select({ id: s.answers.questionId }).from(s.answers).innerJoin(s.quizAttempts, eq(s.quizAttempts.id, s.answers.attemptId))
    .where(and(eq(s.quizAttempts.userId, userId), eq(s.answers.correct, false))).orderBy(desc(s.answers.answeredAt)).limit(200);
  if (!weak.length && !wrongQ.length) return { error: 'No weakness detected yet: answer a few quizzes first, then come back.' };
  const rows = await base.where(and(inArray(s.chapters.courseId, owned), sql`(${weak.length ? inArray(s.questions.conceptId, weak) : sql`false`} or ${wrongQ.length ? inArray(s.questions.id, wrongQ.map((w) => w.id)) : sql`false`})`, ...(p.courseId ? [eq(s.chapters.courseId, p.courseId)] : [])));
  if (!rows.length) return { error: 'No question matches your weak concepts.' };
  return { ids: shuffle(rows).slice(0, count).map((r) => r.id), courseId: p.courseId ?? null, chapterId: null };
}

export type PublicQuestion = {
  id: string; type: QuestionType; stem: string; difficulty: number; topic: string; support: any;
  choices?: { id: string; text: string }[]; left?: string[]; right?: string[]; items?: string[];
  chapter: { title: string; slug: string; courseSlug: string; language: string };
};

/** Question as sent to the browser: no correct answer, no explanation. */
export function toPublic(q: typeof s.questions.$inferSelect, chapter: PublicQuestion['chapter'], seed: string): PublicQuestion {
  const d = q.data as any;
  const rnd = (arr: string[]) => {
    // Deterministic shuffle per attempt so a refresh shows the same order.
    let h = 0; for (const c of seed + q.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { h = (h * 1103515245 + 12345) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    if (a.length > 1 && a.every((x, i) => x === arr[i])) a.push(a.shift()!);
    return a;
  };
  const base = { id: q.id, type: q.type, stem: q.stem, difficulty: q.difficulty, topic: q.topic, support: q.support, chapter };
  if (q.type === 'single' || q.type === 'multiple' || q.type === 'true_false') return { ...base, choices: d.choices.map((c: any) => ({ id: c.id, text: c.text })) };
  if (q.type === 'matching') return { ...base, left: d.pairs.map((p: any) => p.left), right: rnd(d.pairs.map((p: any) => p.right)) };
  if (q.type === 'ordering') return { ...base, items: rnd(d.items) };
  return base;
}

/** Everything the student may see once a question has been answered. */
export function feedbackFor(q: typeof s.questions.$inferSelect) {
  const d = q.data as any;
  return {
    explanation: q.explanation,
    choices: d.choices?.map((c: any) => ({ id: c.id, text: c.text, correct: c.correct, explanation: c.explanation })) ?? null,
    pairs: d.pairs ?? null, items: d.items ?? null, rubric: d.rubric ?? null, modelAnswer: d.modelAnswer ?? null,
  };
}

export async function loadAttempt(userId: string, attemptId: string) {
  const [a] = await db.select().from(s.quizAttempts).where(and(eq(s.quizAttempts.id, attemptId), eq(s.quizAttempts.userId, userId)));
  if (!a) return null;
  const qs = await db.select({ q: s.questions, chTitle: s.chapters.title, chSlug: s.chapters.slug, courseSlug: s.courses.slug, language: s.courses.language, conceptSlug: s.concepts.slug, conceptTerm: s.concepts.term })
    .from(s.questions).innerJoin(s.chapters, eq(s.chapters.id, s.questions.chapterId)).innerJoin(s.courses, eq(s.courses.id, s.chapters.courseId))
    .leftJoin(s.concepts, eq(s.concepts.id, s.questions.conceptId)).where(inArray(s.questions.id, a.questionIds));
  const byId = new Map(qs.map((x) => [x.q.id, x]));
  const ans = await db.select().from(s.answers).where(eq(s.answers.attemptId, a.id)).orderBy(asc(s.answers.answeredAt));
  return { attempt: a, questions: a.questionIds.map((id) => byId.get(id)).filter(Boolean) as typeof qs, answers: ans };
}
