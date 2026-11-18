'use server';
import { and, asc, eq, gte, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db, schema as s } from '@/db';
import { requireUser } from '@/lib/auth';
import { planRevision, type Plan } from '@/lib/revision-plan';
import { answerPoints } from '@/lib/queries';
import { conceptMastery } from '@/lib/mastery';
import { occurrences, parisOffsetMin } from '@/lib/dates';

export type PState = { error?: string; ok?: string } | undefined;
const KINDS = ['class', 'exam', 'assignment', 'study', 'revision', 'goal'] as const;

/** Builds a Date from a Paris wall-clock date and time. */
function paris(date: string, time: string) {
  const guess = new Date(`${date}T${time}:00Z`);
  return new Date(guess.getTime() - parisOffsetMin(guess) * 60_000);
}

const EventInput = z.object({
  title: z.string().trim().min(1, 'Give the event a title.').max(200),
  kind: z.enum(KINDS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.'),
  start: z.string().regex(/^\d{2}:\d{2}$/, 'Choose a start time.'),
  end: z.string().regex(/^\d{2}:\d{2}$/, 'Choose an end time.'),
  courseId: z.union([z.uuid(), z.literal('')]).optional(),
  chapterId: z.union([z.uuid(), z.literal('')]).optional(),
  weekly: z.enum(['on']).optional(),
  repeatUntil: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).optional(),
  location: z.string().trim().max(120).optional(),
});

async function checkOwnership(userId: string, courseId?: string | null, chapterId?: string | null) {
  if (courseId) { const [c] = await db.select({ id: s.courses.id }).from(s.courses).where(and(eq(s.courses.id, courseId), eq(s.courses.userId, userId))); if (!c) return false; }
  if (chapterId) { const [c] = await db.select({ id: s.chapters.id }).from(s.chapters).innerJoin(s.courses, eq(s.courses.id, s.chapters.courseId)).where(and(eq(s.chapters.id, chapterId), eq(s.courses.userId, userId))); if (!c) return false; }
  return true;
}

export async function saveEvent(eventId: string | null, _: PState, form: FormData): Promise<PState> {
  const u = await requireUser();
  const p = EventInput.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const startsAt = paris(p.data.date, p.data.start), endsAt = paris(p.data.date, p.data.end);
  if (endsAt <= startsAt) return { error: 'The end time must be after the start time.' };
  const courseId = p.data.courseId || null, chapterId = p.data.chapterId || null;
  if (!(await checkOwnership(u.id, courseId, chapterId))) return { error: 'Unknown course or chapter.' };
  const values = { title: p.data.title, kind: p.data.kind, startsAt, endsAt, courseId, chapterId, weekly: !!p.data.weekly, repeatUntil: p.data.weekly && p.data.repeatUntil ? p.data.repeatUntil : null, location: p.data.location || null };
  if (eventId) await db.update(s.events).set(values).where(and(eq(s.events.id, eventId), eq(s.events.userId, u.id)));
  else await db.insert(s.events).values({ ...values, userId: u.id });
  revalidatePath('/planner'); revalidatePath('/');
  return { ok: eventId ? 'Event updated.' : 'Event added.' };
}

export async function deleteEvent(id: string) {
  const u = await requireUser();
  await db.delete(s.events).where(and(eq(s.events.id, id), eq(s.events.userId, u.id)));
  revalidatePath('/planner'); revalidatePath('/');
}

export type PlanState = { error?: string; plan?: Plan & { courseId: string; course: string; examDate: string } } | undefined;

export async function suggestPlan(_: PlanState, form: FormData): Promise<PlanState> {
  const u = await requireUser();
  const p = z.object({ courseId: z.uuid('Choose a course.'), examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the exam date.'), minutes: z.coerce.number().int().min(20).max(480) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const [course] = await db.select().from(s.courses).where(and(eq(s.courses.id, p.data.courseId), eq(s.courses.userId, u.id)));
  if (!course) return { error: 'Course not found.' };
  const exam = new Date(`${p.data.examDate}T12:00:00Z`);
  if (exam.getTime() < Date.now()) return { error: 'The exam date is in the past.' };
  const chapters = await db.select().from(s.chapters).where(eq(s.chapters.courseId, course.id)).orderBy(asc(s.chapters.position));
  const points = (await answerPoints(u.id)).filter((x) => chapters.some((c) => c.id === x.chapterId));
  const mastery = (id: string) => { const m = [...conceptMastery(points.filter((x) => x.chapterId === id)).values()]; return m.length ? m.reduce((a, b) => a + b.accuracy, 0) / m.length : 0; };
  const evs = await db.select().from(s.events).where(and(eq(s.events.userId, u.id), gte(s.events.endsAt, new Date(Date.now() - 200 * 86_400_000))));
  const busy = occurrences(evs, new Date(), exam).map((e) => ({ date: e.at.toISOString().slice(0, 10), minutes: (e.end.getTime() - e.at.getTime()) / 60_000 }));
  const plan = planRevision(chapters.map((c) => ({ id: c.id, title: c.title, priority: c.priority, mastery: mastery(c.id) })), { today: new Date(), examDate: exam, minutesPerDay: p.data.minutes, busy });
  return { plan: { ...plan, courseId: course.id, course: course.title, examDate: p.data.examDate } };
}

export async function acceptPlan(courseId: string, examDate: string, sessions: { date: string; chapterId: string; title: string; kind: string; minutes: number }[]) {
  const u = await requireUser();
  const chapters = await db.select({ id: s.chapters.id }).from(s.chapters).innerJoin(s.courses, eq(s.courses.id, s.chapters.courseId)).where(and(eq(s.courses.id, courseId), eq(s.courses.userId, u.id)));
  const ok = new Set(chapters.map((c) => c.id));
  const rows = sessions.filter((x) => ok.has(x.chapterId) && /^\d{4}-\d{2}-\d{2}$/.test(x.date)).slice(0, 200).map((x) => {
    const at = paris(x.date, '18:00');
    return { userId: u.id, title: `${x.kind === 'learn' ? 'Study' : x.kind === 'review' ? 'Review' : 'Final review'}: ${x.title}`, kind: 'revision' as const, courseId, chapterId: x.chapterId, startsAt: at, endsAt: new Date(at.getTime() + x.minutes * 60_000), source: `Revision plan for the exam of ${examDate}` };
  });
  if (rows.length) await db.insert(s.events).values(rows);
  void inArray;
  revalidatePath('/planner'); revalidatePath('/');
  return { added: rows.length };
}
