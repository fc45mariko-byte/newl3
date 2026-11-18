'use server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema as s } from '@/db';
import { requireUser } from '@/lib/auth';
import { review, newCard, type Grade } from '@/lib/sm2';

async function ownsCard(userId: string, cardId: string) {
  const [r] = await db.select({ id: s.flashcards.id }).from(s.flashcards).innerJoin(s.chapters, eq(s.chapters.id, s.flashcards.chapterId))
    .innerJoin(s.courses, eq(s.courses.id, s.chapters.courseId)).where(and(eq(s.flashcards.id, cardId), eq(s.courses.userId, userId)));
  return !!r;
}

export async function reviewCard(cardId: string, grade: Grade) {
  const u = await requireUser();
  const g = z.enum(['again', 'hard', 'good', 'easy']).parse(grade);
  if (!(await ownsCard(u.id, cardId))) return { error: 'Card not found.' };
  const [cur] = await db.select().from(s.cardStates).where(and(eq(s.cardStates.userId, u.id), eq(s.cardStates.cardId, cardId)));
  const next = review(cur ?? newCard(), g);
  await db.insert(s.cardStates).values({ userId: u.id, cardId, ...next, lastReviewedAt: new Date() })
    .onConflictDoUpdate({ target: [s.cardStates.userId, s.cardStates.cardId], set: { ...next, lastReviewedAt: new Date() } });
  return { dueAt: next.dueAt.toISOString(), intervalDays: next.intervalDays, state: next.state };
}

/** Checks one part of an exercise. Numeric and choice answers are graded; written ones show the correction. */
export async function checkExercise(exerciseId: string, partId: string, response: { value?: string; choice?: number; reveal?: boolean }) {
  const u = await requireUser();
  const [ex] = await db.select({ e: s.exercises }).from(s.exercises).innerJoin(s.chapters, eq(s.chapters.id, s.exercises.chapterId))
    .innerJoin(s.courses, eq(s.courses.id, s.chapters.courseId)).where(and(eq(s.exercises.id, exerciseId), eq(s.courses.userId, u.id)));
  if (!ex) return { error: 'Exercise not found.' };
  const part = ex.e.parts.find((p) => p.id === partId);
  if (!part) return { error: 'Question not found.' };
  const a = part.answer as any;
  let correct: boolean | null = null;
  if (!response.reveal) {
    if (a.type === 'nombre') {
      const v = Number(String(response.value ?? '').replace(/\s/g, '').replace(',', '.'));
      if (!Number.isFinite(v)) return { error: 'Enter a number.' };
      const tol = a.tolerance ?? Math.max(0.01, Math.abs(a.valeur) * 0.001);
      correct = Math.abs(v - a.valeur) <= tol;
    } else if (a.type === 'choix') {
      if (typeof response.choice !== 'number') return { error: 'Choose an option.' };
      correct = response.choice === a.correcte;
    }
  }
  await db.insert(s.exerciseAttempts).values({ userId: u.id, exerciseId, partId, response, correct });
  return { correct, correction: part.correction, mistakes: part.mistakes ?? [], answer: a };
}
