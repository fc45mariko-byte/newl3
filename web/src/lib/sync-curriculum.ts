// Brings an existing account up to date with data/curriculum.json without touching the student's own work.
//
// Updated: generated content (sections, concepts, questions, flashcards, exercises), chapter metadata, and the
// course fields that come from research (status, uncertainties, materials, frameworks, exam skills, bibliography).
// Never touched: notes, documents, quiz answers, card review states, exercise attempts, chapter progress, events,
// tasks, chapters the student added, and the course fields the student can edit (title, language, semesters,
// category, teacher, description, exam status).
// Generated items that disappeared from the curriculum are removed only if the student never used them
// (no answer, no review, no attempt); otherwise they are kept.
import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';
import type { DB } from '@/db';
import * as s from '@/db/schema';
import {
  chapterFields, conceptRow, courseContentFields, exerciseRow, flashcardRow, importCurriculum, loadCurriculum, questionRow, sectionRow,
} from './import-curriculum';

export type SyncReport = { coursesAdded: number; coursesUpdated: number; chaptersAdded: number; chaptersUpdated: number; questions: number; removedUnused: number };

export async function syncCurriculum(db: DB, userId: string, cur: any = loadCurriculum()): Promise<SyncReport> {
  const imported = await importCurriculum(db, userId, cur); // new courses and sources only
  return db.transaction(async (tx) => {
    const report: SyncReport = { coursesAdded: imported.courses, coursesUpdated: 0, chaptersAdded: 0, chaptersUpdated: 0, questions: 0, removedUnused: 0 };
    const rows = await tx.select({ id: s.courses.id, slug: s.courses.slug }).from(s.courses).where(eq(s.courses.userId, userId));
    const courseId = new Map(rows.map((r) => [r.slug, r.id]));
    const linkSpecs: { from: string; to: string; relation: string }[] = [];

    for (const c of cur.courses) {
      const cid = courseId.get(c.slug);
      if (!cid) continue;
      await tx.update(s.courses).set(courseContentFields(cur, c)).where(eq(s.courses.id, cid));
      report.coursesUpdated++;

      const existing = await tx.select({ id: s.chapters.id, slug: s.chapters.slug }).from(s.chapters).where(eq(s.chapters.courseId, cid)).orderBy(s.chapters.position);
      const bySlug = new Map(existing.map((r) => [r.slug, r.id]));
      const curSlugs = new Set(c.chapters.map((ch: any) => ch.slug));

      for (const [i, ch] of c.chapters.entries() as [number, any][]) {
        let id = bySlug.get(ch.slug);
        if (id) {
          await tx.update(s.chapters).set(chapterFields(ch, i)).where(eq(s.chapters.id, id));
          report.chaptersUpdated++;
        } else {
          [{ id }] = await tx.insert(s.chapters).values({ courseId: cid, slug: ch.slug, ...chapterFields(ch, i) }).returning({ id: s.chapters.id });
          report.chaptersAdded++;
        }
        const chapterId = id!;

        await tx.delete(s.sections).where(eq(s.sections.chapterId, chapterId));
        if (ch.sections.length) await tx.insert(s.sections).values(ch.sections.map((sec: any, k: number) => sectionRow(chapterId, sec, k)));

        const conceptIds = new Map<string, string>();
        for (const [k, n] of ch.notions.entries() as [number, any][]) {
          const row = conceptRow(userId, c.language, n);
          const { userId: _u, slug: _s, ...content } = row;
          const [r] = await tx.insert(s.concepts).values(row).onConflictDoUpdate({ target: [s.concepts.userId, s.concepts.slug], set: content }).returning({ id: s.concepts.id });
          conceptIds.set(n.slug, r.id);
          await tx.insert(s.conceptChapters).values({ conceptId: r.id, chapterId, position: k })
            .onConflictDoUpdate({ target: [s.conceptChapters.conceptId, s.conceptChapters.chapterId], set: { position: k } });
          for (const p of n.prerequisites ?? []) linkSpecs.push({ from: n.slug, to: p, relation: 'prerequisite' });
          for (const r2 of n.related ?? []) linkSpecs.push({ from: n.slug, to: r2, relation: 'related' });
        }
        // Questions may point to a concept of another chapter.
        const wanted = [...new Set(ch.questions.map((q: any) => q.concept).filter((x: any) => x && !conceptIds.has(x)))] as string[];
        if (wanted.length) for (const r of await tx.select({ id: s.concepts.id, slug: s.concepts.slug }).from(s.concepts).where(and(eq(s.concepts.userId, userId), inArray(s.concepts.slug, wanted)))) conceptIds.set(r.slug, r.id);

        for (const q of ch.questions) {
          const row = questionRow(chapterId, q, conceptIds.get(q.concept) ?? null);
          const { chapterId: _c, key: _k, ...content } = row;
          await tx.insert(s.questions).values(row as any).onConflictDoUpdate({ target: [s.questions.chapterId, s.questions.key], set: content as any });
          report.questions++;
        }
        for (const f of ch.flashcards) {
          const row = flashcardRow(chapterId, f);
          await tx.insert(s.flashcards).values(row).onConflictDoUpdate({ target: [s.flashcards.chapterId, s.flashcards.key], set: { kind: row.kind, front: row.front, back: row.back, extra: row.extra } });
        }
        for (const e of ch.exercises) {
          const row = exerciseRow(chapterId, e);
          const { chapterId: _c, key: _k, ...content } = row;
          await tx.insert(s.exercises).values(row).onConflictDoUpdate({ target: [s.exercises.chapterId, s.exercises.key], set: content });
        }

        // Generated items no longer in the curriculum: delete only those the student never used.
        // An empty list means every generated item of that kind is stale.
        const notKept = (col: any, list: any[]) => (list.length ? notInArray(col, list.map((x) => x.key)) : sql`true`);
        const q = await tx.delete(s.questions).where(and(eq(s.questions.chapterId, chapterId), notKept(s.questions.key, ch.questions),
          sql`not exists (select 1 from ${s.answers} where ${s.answers.questionId} = ${s.questions.id})`)).returning({ id: s.questions.id });
        const f = await tx.delete(s.flashcards).where(and(eq(s.flashcards.chapterId, chapterId), notKept(s.flashcards.key, ch.flashcards),
          sql`not exists (select 1 from ${s.cardStates} where ${s.cardStates.cardId} = ${s.flashcards.id})`)).returning({ id: s.flashcards.id });
        const e = await tx.delete(s.exercises).where(and(eq(s.exercises.chapterId, chapterId), notKept(s.exercises.key, ch.exercises),
          sql`not exists (select 1 from ${s.exerciseAttempts} where ${s.exerciseAttempts.exerciseId} = ${s.exercises.id})`)).returning({ id: s.exercises.id });
        report.removedUnused += q.length + f.length + e.length;
      }
      // Chapters that are not in the curriculum (added by the student, or dropped by research) are kept, after the others.
      let pos = c.chapters.length;
      for (const r of existing) if (!curSlugs.has(r.slug)) await tx.update(s.chapters).set({ position: pos++ }).where(eq(s.chapters.id, r.id));
    }

    // Concept links, once every concept exists.
    const slugs = [...new Set(linkSpecs.flatMap((l) => [l.from, l.to]))];
    if (slugs.length) {
      const ids = new Map((await tx.select({ id: s.concepts.id, slug: s.concepts.slug }).from(s.concepts).where(and(eq(s.concepts.userId, userId), inArray(s.concepts.slug, slugs)))).map((r) => [r.slug, r.id]));
      const links = linkSpecs.filter((l) => ids.has(l.from) && ids.has(l.to) && l.from !== l.to).map((l) => ({ fromId: ids.get(l.from)!, toId: ids.get(l.to)!, relation: l.relation }));
      for (let i = 0; i < links.length; i += 400) await tx.insert(s.conceptLinks).values(links.slice(i, i + 400)).onConflictDoNothing();
    }
    return report;
  });
}
