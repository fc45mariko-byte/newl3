import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { db, schema as s } from '@/db';
import { FlashcardSession } from '@/components/FlashcardSession';

export const metadata = { title: 'Flashcards' };
const NEW_PER_SESSION = 15;

export default async function Flashcards({ searchParams }: { searchParams: Promise<{ chapter?: string; course?: string }> }) {
  const sp = await searchParams;
  const u = await requireUser();
  const chapterId = sp.chapter && /^[0-9a-f-]{36}$/.test(sp.chapter) ? sp.chapter : null;
  const courseSlug = sp.course ?? null;
  const scope = and(eq(s.courses.userId, u.id), ...(chapterId ? [eq(s.chapters.id, chapterId)] : []), ...(courseSlug ? [eq(s.courses.slug, courseSlug)] : []));
  const all = await db.select({ id: s.flashcards.id, front: s.flashcards.front, back: s.flashcards.back, kind: s.flashcards.kind, extra: s.flashcards.extra, chapter: s.chapters.title, course: s.courses.title, language: s.courses.language,
    dueAt: s.cardStates.dueAt, state: s.cardStates.state })
    .from(s.flashcards).innerJoin(s.chapters, eq(s.chapters.id, s.flashcards.chapterId)).innerJoin(s.courses, eq(s.courses.id, s.chapters.courseId))
    .leftJoin(s.cardStates, and(eq(s.cardStates.cardId, s.flashcards.id), eq(s.cardStates.userId, u.id)))
    .where(scope).orderBy(asc(s.courses.position), asc(s.chapters.position));
  const now = new Date();
  const due = all.filter((c) => c.dueAt && c.dueAt <= now).sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime());
  const fresh = all.filter((c) => !c.state).slice(0, NEW_PER_SESSION);
  const queue = [...due, ...fresh];
  const courses = await db.select({ slug: s.courses.slug, title: s.courses.title }).from(s.courses).where(eq(s.courses.userId, u.id)).orderBy(asc(s.courses.position));
  void inArray; void lte; void sql;
  return (
    <div className="max-w-3xl flex flex-col gap-5">
      <header><Link href="/revision" className="text-sm text-muted hover:text-ink">← Revision</Link><h1 className="font-serif text-4xl mt-1">Flashcards</h1>
        <p className="text-muted mt-1 text-sm">{due.length} due · {fresh.length} new in this session{chapterId ? ` · ${all[0]?.chapter ?? ''}` : ''}. Grade honestly: the schedule depends on it.</p></header>
      {!chapterId && (
        <form className="flex gap-2 items-end">
          <label className="label flex-1">Course<select className="input" name="course" defaultValue={courseSlug ?? ''}><option value="">All courses</option>{courses.map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}</select></label>
          <button className="btn">Filter</button>
        </form>
      )}
      <FlashcardSession cards={queue.map((c) => ({ id: c.id, front: c.front, back: c.back, kind: c.kind, extra: c.extra, chapter: c.chapter, course: c.course, language: c.language, isNew: !c.state }))} />
    </div>
  );
}
