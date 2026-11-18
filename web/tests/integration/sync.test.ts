// Runs against the test database (leastudy_test). Checks that a content update keeps every piece of the student's work.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { and, eq } from 'drizzle-orm';
import * as s from '@/db/schema';
import { importCurriculum, loadCurriculum } from '@/lib/import-curriculum';
import { syncCurriculum } from '@/lib/sync-curriculum';

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5432/leastudy_test' });
const db = drizzle(pool, { schema: s });
const cur = loadCurriculum();
let userId = '';

function oldCurriculum() {
  const old = structuredClone(cur);
  const red = old.courses.find((c: any) => c.slug === 'red');
  red.chapters = red.chapters.filter((ch: any) => ch.slug !== 'red.demarche');
  red.researchStatus = 'reconstructed';
  const src = red.chapters.find((ch: any) => ch.slug === 'red.sources');
  src.sections = [{ kind: 'synthesis', title: 'Ancienne synthèse', provenance: 'RECONSTRUCTED_EXPLANATION', body: 'Ancien texte.', sourceKeys: [] }];
  const base = src.questions[0];
  src.questions.push({ ...base, key: 'old.answered' }, { ...base, key: 'old.unused' });
  src.flashcards.push({ key: 'old.reviewed', kind: 'concept', front: 'Ancienne carte', back: 'Verso', extra: {} });
  return old;
}

beforeAll(async () => {
  const [u] = await db.insert(s.users).values({ email: `sync-${Date.now()}@test.local`, name: 'Sync', passwordHash: 'x' }).returning();
  userId = u.id;
  await importCurriculum(db as any, userId, oldCurriculum());
  // The student's own work on the old version.
  const [red] = await db.select().from(s.courses).where(and(eq(s.courses.userId, userId), eq(s.courses.slug, 'red')));
  await db.update(s.courses).set({ teacher: 'Mme Exemple', title: 'Mon titre de cours' }).where(eq(s.courses.id, red.id));
  const [src] = await db.select().from(s.chapters).where(and(eq(s.chapters.courseId, red.id), eq(s.chapters.slug, 'red.sources')));
  await db.insert(s.notes).values({ userId, courseId: red.id, chapterId: src.id, title: 'Ma note', body: 'Texte' });
  await db.insert(s.chapterProgress).values({ userId, chapterId: src.id, readAt: new Date() });
  await db.insert(s.chapters).values({ courseId: red.id, slug: 'red.mon-chapitre', position: 99, title: 'Mon chapitre', priority: 'IMPORTANT' });
  const [q] = await db.select().from(s.questions).where(and(eq(s.questions.chapterId, src.id), eq(s.questions.key, 'old.answered')));
  const [att] = await db.insert(s.quizAttempts).values({ userId, mode: 'chapter', questionIds: [q.id], chapterId: src.id }).returning();
  await db.insert(s.answers).values({ attemptId: att.id, questionId: q.id, response: { choice: 'a' }, score: 1, correct: true });
  const [card] = await db.select().from(s.flashcards).where(and(eq(s.flashcards.chapterId, src.id), eq(s.flashcards.key, 'old.reviewed')));
  await db.insert(s.cardStates).values({ userId, cardId: card.id, state: 'review', repetitions: 2, intervalDays: 6 });
});
afterAll(async () => { if (userId) await db.delete(s.users).where(eq(s.users.id, userId)); await pool.end(); });

describe('syncCurriculum', () => {
  it('adds new content and refreshes generated content', async () => {
    const r = await syncCurriculum(db as any, userId, cur);
    expect(r.chaptersAdded).toBe(1);
    const [red] = await db.select().from(s.courses).where(and(eq(s.courses.userId, userId), eq(s.courses.slug, 'red')));
    expect(red.researchStatus).toBe('university_material');
    const chs = await db.select().from(s.chapters).where(eq(s.chapters.courseId, red.id)).orderBy(s.chapters.position);
    expect(chs[0].slug).toBe('red.demarche');
    const secs = await db.select().from(s.sections).where(eq(s.sections.chapterId, chs[0].id));
    expect(secs.length).toBeGreaterThan(5);
    const src = chs.find((c) => c.slug === 'red.sources')!;
    const srcSecs = await db.select().from(s.sections).where(eq(s.sections.chapterId, src.id));
    expect(srcSecs.some((x) => x.body === 'Ancien texte.')).toBe(false);
    expect(srcSecs.some((x) => x.body.includes('Google Scholar'))).toBe(true);
  });

  it('keeps everything the student did', async () => {
    const [red] = await db.select().from(s.courses).where(and(eq(s.courses.userId, userId), eq(s.courses.slug, 'red')));
    expect(red.teacher).toBe('Mme Exemple');
    expect(red.title).toBe('Mon titre de cours');
    const chs = await db.select().from(s.chapters).where(eq(s.chapters.courseId, red.id)).orderBy(s.chapters.position);
    expect(chs.at(-1)!.slug).toBe('red.mon-chapitre');
    const src = chs.find((c) => c.slug === 'red.sources')!;
    expect((await db.select().from(s.notes).where(eq(s.notes.userId, userId)))[0].chapterId).toBe(src.id);
    expect(await db.select().from(s.chapterProgress).where(eq(s.chapterProgress.userId, userId))).toHaveLength(1);
    const keys = (await db.select({ key: s.questions.key }).from(s.questions).where(eq(s.questions.chapterId, src.id))).map((x) => x.key);
    expect(keys).toContain('old.answered'); // answered: kept
    expect(keys).not.toContain('old.unused'); // never used: removed
    const states = await db.select().from(s.cardStates).where(eq(s.cardStates.userId, userId));
    expect(states).toHaveLength(1);
    expect(states[0].repetitions).toBe(2);
    expect(await db.select().from(s.answers)).not.toHaveLength(0);
  });

  it('is idempotent', async () => {
    const count = async () => (await db.select({ id: s.questions.id }).from(s.questions).innerJoin(s.chapters, eq(s.chapters.id, s.questions.chapterId)).innerJoin(s.courses, eq(s.courses.id, s.chapters.courseId)).where(eq(s.courses.userId, userId))).length;
    const before = await count();
    const r = await syncCurriculum(db as any, userId, cur);
    expect(r.chaptersAdded).toBe(0);
    expect(r.removedUnused).toBe(0);
    expect(await count()).toBe(before);
  });
});
