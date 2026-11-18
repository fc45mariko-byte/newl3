// Loads data/curriculum.json into a student's account. Runs once at sign-up (or from the seed script).
// It only inserts: existing courses with the same slug are left untouched, so it never overwrites the student's data.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { and, eq, inArray } from 'drizzle-orm';
import type { DB } from '@/db';
import * as s from '@/db/schema';

type Curriculum = any; // shape produced by scripts/build-curriculum.ts

function chunk<T>(a: T[], n = 400): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}

export function loadCurriculum(): Curriculum {
  return JSON.parse(readFileSync(join(process.cwd(), 'data', 'curriculum.json'), 'utf8'));
}

export async function importCurriculum(db: DB, userId: string, cur: Curriculum = loadCurriculum()) {
  return db.transaction(async (tx) => {
    const existing = new Set((await tx.select({ slug: s.courses.slug }).from(s.courses).where(eq(s.courses.userId, userId))).map((r) => r.slug));

    // Sources (shared by all courses of the user)
    const known = new Set((await tx.select({ key: s.sources.key }).from(s.sources).where(eq(s.sources.userId, userId))).map((r) => r.key));
    const newSources: (typeof s.sources.$inferInsert)[] = cur.sources.filter((x: any) => !known.has(x.key)).map((x: any) => ({ ...x, userId }));
    for (const part of chunk(newSources)) await tx.insert(s.sources).values(part);

    // Academic year and semesters
    let [year] = await tx.select().from(s.academicYears).where(and(eq(s.academicYears.userId, userId), eq(s.academicYears.isCurrent, true)));
    if (!year) {
      [year] = await tx.insert(s.academicYears).values({ userId, label: '2026-2027', isCurrent: true }).returning();
      await tx.insert(s.semesters).values([
        { yearId: year.id, code: 'S5', startsOn: '2026-09-07', endsOn: '2027-01-15', isCurrent: true },
        { yearId: year.id, code: 'S6', startsOn: '2027-01-18', endsOn: '2027-05-28', isCurrent: false },
      ]);
    }

    const conceptRows: any[] = [];
    const linkSpecs: { from: string; to: string; relation: string }[] = [];
    const conceptChapterSpecs: { concept: string; chapterId: string; position: number }[] = [];
    const questionSpecs: { chapterId: string; q: any }[] = [];
    const flashRows: any[] = [];
    const exerciseRows: any[] = [];
    const sectionRows: any[] = [];
    const courseIdBySlug = new Map<string, string>();

    for (const c of cur.courses) {
      if (existing.has(c.slug)) continue;
      const [course] = await tx.insert(s.courses).values({
        userId, slug: c.slug, title: c.title, language: c.language, semesters: c.semesters, category: c.category, teacher: c.teacher,
        officialDescription: c.officialDescription, outsideProgramme: c.outsideProgramme, missing: c.missing, researchStatus: c.researchStatus,
        uncertainties: c.uncertainties, bibliography: c.bibliography, officialSourceKeys: c.officialSourceKeys, frameworks: c.frameworks,
        examSkills: c.examSkills, materials: cur.documents.filter((d: any) => d.course === c.slug), position: c.position,
      }).returning({ id: s.courses.id });
      courseIdBySlug.set(c.slug, course.id);
      const chapterRows = await tx.insert(s.chapters).values(c.chapters.map((ch: any, i: number) => ({
        courseId: course.id, slug: ch.slug, position: i, title: ch.title, priority: ch.priority, priorityReason: ch.priorityReason,
        researchStatus: ch.researchStatus, provenance: ch.provenance, summary: ch.summary ?? null, note: ch.note ?? null,
        prerequisites: ch.prerequisites ?? [], sourceKeys: ch.sourceKeys ?? [], materialKeys: ch.documents ?? [],
      }))).returning({ id: s.chapters.id, slug: s.chapters.slug });
      const chId = new Map(chapterRows.map((r) => [r.slug, r.id]));
      for (const ch of c.chapters) {
        const id = chId.get(ch.slug)!;
        ch.sections.forEach((sec: any, i: number) => sectionRows.push({ chapterId: id, kind: sec.kind, position: i, title: sec.title, body: sec.body, provenance: sec.provenance, sourceKeys: sec.sourceKeys ?? [] }));
        ch.notions.forEach((n: any, i: number) => {
          conceptRows.push({
            userId, slug: n.slug, term: n.term, language: c.language,
            translations: Object.fromEntries((n.terms?.[0] ? [['fr', n.terms[0].fr], ['en', n.terms[0].en], ['es', n.terms[0].es]] : []).filter(([, v]: any) => v)),
            definition: n.definition ?? '', intuitive: n.intuitive ?? null, academic: n.academic ?? null, analytical: n.analytical ?? null,
            example: n.example?.texte ?? null, examRelevance: n.question ?? null, level: n.level ?? null,
            data: { blocks: n.blocks, confusions: n.confusions, counterExample: n.counterExample, example: n.example, verification: n.verification, terms: n.terms, stub: !!n.stub },
            provenance: n.stub ? [] : n.sourceKeys?.length ? ['ACADEMIC_RESEARCH', 'RECONSTRUCTED_EXPLANATION'] : ['RECONSTRUCTED_EXPLANATION'],
            sourceKeys: n.sourceKeys ?? [], toCheck: n.toCheck ?? null,
          });
          conceptChapterSpecs.push({ concept: n.slug, chapterId: id, position: i });
          for (const p of n.prerequisites ?? []) linkSpecs.push({ from: n.slug, to: p, relation: 'prerequisite' });
          for (const r of n.related ?? []) linkSpecs.push({ from: n.slug, to: r, relation: 'related' });
        });
        for (const q of ch.questions) questionSpecs.push({ chapterId: id, q });
        for (const f of ch.flashcards) flashRows.push({ chapterId: id, key: f.key, kind: f.kind, front: f.front, back: f.back, extra: f.extra ?? {} });
        for (const e of ch.exercises) exerciseRows.push({ chapterId: id, key: e.key, type: e.type, title: e.title, difficulty: e.difficulty, statement: e.statement, data: e.data, fictional: e.fictional, parts: e.parts });
      }
    }
    for (const part of chunk(sectionRows)) await tx.insert(s.sections).values(part);

    const conceptIds = new Map<string, string>();
    for (const part of chunk(conceptRows)) {
      const rows = await tx.insert(s.concepts).values(part).onConflictDoNothing().returning({ id: s.concepts.id, slug: s.concepts.slug });
      for (const r of rows) conceptIds.set(r.slug, r.id);
    }
    const ccRows = conceptChapterSpecs.filter((x) => conceptIds.has(x.concept)).map((x) => ({ conceptId: conceptIds.get(x.concept)!, chapterId: x.chapterId, position: x.position }));
    for (const part of chunk(ccRows)) await tx.insert(s.conceptChapters).values(part).onConflictDoNothing();
    const lkRows = linkSpecs.filter((l) => conceptIds.has(l.from) && conceptIds.has(l.to) && l.from !== l.to).map((l) => ({ fromId: conceptIds.get(l.from)!, toId: conceptIds.get(l.to)!, relation: l.relation }));
    for (const part of chunk(lkRows)) await tx.insert(s.conceptLinks).values(part).onConflictDoNothing();

    const qRows = questionSpecs.map(({ chapterId, q }) => ({
      chapterId, conceptId: conceptIds.get(q.concept) ?? null, key: q.key, type: q.type, difficulty: q.difficulty, topic: q.topic ?? '',
      stem: q.stem, support: q.support ?? null, data: q.data, explanation: q.explanation ?? null, reference: q.concept ?? null,
    }));
    for (const part of chunk(qRows)) await tx.insert(s.questions).values(part).onConflictDoNothing();
    for (const part of chunk(flashRows)) await tx.insert(s.flashcards).values(part).onConflictDoNothing();
    for (const part of chunk(exerciseRows)) await tx.insert(s.exercises).values(part).onConflictDoNothing();

    // Known timetable slot and deadline, taken from the student's documents.
    const evRows: any[] = [];
    const monday = new Date(Date.UTC(2026, 8, 7)); // first week of S5
    for (const e of cur.events ?? []) {
      const cid = courseIdBySlug.get(e.course); if (!cid) continue;
      const d = new Date(monday); d.setUTCDate(d.getUTCDate() + ((e.weekday + 6) % 7));
      const at = (hm: string) => new Date(`${d.toISOString().slice(0, 10)}T${hm}:00+02:00`);
      evRows.push({ userId, title: e.title, kind: e.kind, courseId: cid, startsAt: at(e.start), endsAt: at(e.end), weekly: true, repeatUntil: '2027-01-15', location: e.location, source: e.source });
    }
    for (const dl of cur.deadlines ?? []) {
      const cid = courseIdBySlug.get(dl.course); if (!cid) continue;
      evRows.push({ userId, title: dl.title, kind: 'assignment', courseId: cid, startsAt: new Date(`${dl.date}T08:00:00+01:00`), endsAt: new Date(`${dl.date}T09:00:00+01:00`), source: dl.source });
    }
    if (evRows.length) await tx.insert(s.events).values(evRows);
    if (courseIdBySlug.size) {
      const hasObjectives = (await tx.select({ id: s.objectives.id }).from(s.objectives).where(eq(s.objectives.userId, userId)).limit(1)).length;
      if (!hasObjectives) await tx.insert(s.objectives).values(['Understand every course', 'Complete three revision cycles', 'Pass all examinations', "Prepare Master's applications", 'Prepare Erasmus opportunities'].map((title, position) => ({ userId, title, position })));
      const cvb = courseIdBySlug.get('cvb');
      if (cvb) await tx.insert(s.tasks).values({ userId, title: 'Read the Thatcher article (The Guardian, 2013) and answer the questions', dueOn: '2026-11-18', priority: 'high', category: 'assignment', courseId: cvb });
    }
    void inArray;
    return { courses: courseIdBySlug.size, concepts: conceptIds.size, questions: qRows.length, flashcards: flashRows.length, exercises: exerciseRows.length };
  });
}
