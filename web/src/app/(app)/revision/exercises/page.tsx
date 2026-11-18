import Link from 'next/link';
import { and, asc, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db, schema as s } from '@/db';
import { ExerciseCard } from '@/components/ExerciseCard';

export const metadata = { title: 'Exercises' };
export default async function Exercises({ searchParams }: { searchParams: Promise<{ chapter?: string; course?: string }> }) {
  const sp = await searchParams;
  const u = await requireUser();
  const chapterId = sp.chapter && /^[0-9a-f-]{36}$/.test(sp.chapter) ? sp.chapter : null;
  const rows = await db.select({ e: s.exercises, chapter: s.chapters.title, chapterSlug: s.chapters.slug, course: s.courses.title, courseSlug: s.courses.slug, language: s.courses.language })
    .from(s.exercises).innerJoin(s.chapters, eq(s.chapters.id, s.exercises.chapterId)).innerJoin(s.courses, eq(s.courses.id, s.chapters.courseId))
    .where(and(eq(s.courses.userId, u.id), ...(chapterId ? [eq(s.chapters.id, chapterId)] : []), ...(sp.course ? [eq(s.courses.slug, sp.course)] : [])))
    .orderBy(asc(s.courses.position), asc(s.chapters.position));
  const courses = [...new Map(rows.map((r) => [r.courseSlug, r.course])).entries()];
  const allCourses = await db.select({ slug: s.courses.slug, title: s.courses.title }).from(s.courses).where(eq(s.courses.userId, u.id)).orderBy(asc(s.courses.position));
  return (
    <div className="max-w-4xl flex flex-col gap-5">
      <header><Link href="/revision" className="text-sm text-muted hover:text-ink">← Revision</Link><h1 className="font-serif text-4xl mt-1">Exercises</h1>
        <p className="text-sm text-muted mt-1">{rows.length} exercises{courses.length === 1 ? ` · ${courses[0][1]}` : ''}. Figures marked fictional are invented for practice.</p></header>
      {!chapterId && <form className="flex gap-2 items-end"><label className="label flex-1">Course<select className="input" name="course" defaultValue={sp.course ?? ''}><option value="">All courses</option>{allCourses.map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}</select></label><button className="btn">Filter</button></form>}
      {rows.length ? rows.map((r) => <ExerciseCard key={r.e.id} ex={{ id: r.e.id, title: r.e.title, type: r.e.type, difficulty: r.e.difficulty, statement: r.e.statement, data: r.e.data, fictional: r.e.fictional, parts: r.e.parts.map((p) => ({ id: p.id, prompt: p.prompt, kind: (p.answer as any).type, options: (p.answer as any).options ?? null, unit: (p.answer as any).unite ?? null })) }} chapter={{ title: r.chapter, href: `/courses/${r.courseSlug}/chapters/${r.chapterSlug}` }} language={r.language} />)
        : <div className="card p-8 text-center text-muted">No exercise here yet.</div>}
    </div>
  );
}
