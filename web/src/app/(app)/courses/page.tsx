import Link from 'next/link';
import { asc, eq, sql, inArray } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db, schema as s } from '@/db';
import { LANG, Status } from '@/components/badges';
import { IconPlus } from '@/components/icons';

export const metadata = { title: 'Courses' };

export default async function Courses() {
  const u = await requireUser();
  const courses = await db.select().from(s.courses).where(eq(s.courses.userId, u.id)).orderBy(asc(s.courses.position));
  const ids = courses.map((c) => c.id);
  const ch = ids.length ? await db.select({ courseId: s.chapters.courseId, n: sql<number>`count(*)::int`, ess: sql<number>`count(*) filter (where ${s.chapters.priority} = 'ESSENTIAL')::int` })
    .from(s.chapters).where(inArray(s.chapters.courseId, ids)).groupBy(s.chapters.courseId) : [];
  const readRows = ids.length ? await db.select({ courseId: s.chapters.courseId, n: sql<number>`count(*)::int` }).from(s.chapterProgress)
    .innerJoin(s.chapters, eq(s.chapters.id, s.chapterProgress.chapterId)).where(sql`${s.chapterProgress.userId} = ${u.id} and ${s.chapterProgress.readAt} is not null`).groupBy(s.chapters.courseId) : [];
  const docs = ids.length ? await db.select({ courseId: s.documents.courseId, n: sql<number>`count(*)::int` }).from(s.documents).where(eq(s.documents.userId, u.id)).groupBy(s.documents.courseId) : [];
  const groups: [string, typeof courses][] = [
    ['Semester 5', courses.filter((c) => c.semesters.includes('S5') && !c.outsideProgramme)],
    ['Semester 6', courses.filter((c) => c.semesters.includes('S6') && !c.outsideProgramme && !c.semesters.includes('S5'))],
    ['Outside the official programme', courses.filter((c) => c.outsideProgramme || !c.semesters.length)],
  ];
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">Courses</p><h1 className="font-serif text-4xl sm:text-5xl mt-1">Your curriculum</h1>
          <p className="text-muted mt-2 max-w-2xl">Each course keeps the language it is taught in. Badges show where its content comes from and how far research has gone.</p></div>
        <Link href="/courses/new" className="btn btn-primary"><IconPlus /> New course</Link>
      </header>
      {groups.map(([title, list]) => list.length > 0 && (
        <section key={title} className="flex flex-col gap-3">
          <h2 className="font-serif text-2xl">{title}</h2>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((c) => {
              const n = ch.find((x) => x.courseId === c.id); const r = readRows.find((x) => x.courseId === c.id)?.n ?? 0; const d = docs.find((x) => x.courseId === c.id)?.n ?? 0;
              return (
                <li key={c.id}>
                  <Link href={`/courses/${c.slug}`} className="card p-4 flex flex-col gap-2 h-full hover:border-ink">
                    <div className="flex items-start justify-between gap-2"><h3 className="font-serif text-xl leading-tight">{c.title}</h3><span className="chip bg-ivory border border-line">{c.language.toUpperCase()}</span></div>
                    <p className="text-xs text-muted">{LANG[c.language]}{c.teacher ? ` · ${c.teacher}` : ''}</p>
                    <Status s={c.researchStatus} />
                    <div className="flex flex-wrap gap-x-3 text-xs text-muted mt-auto pt-2">
                      <span>{n?.n ?? 0} chapters ({n?.ess ?? 0} essential)</span><span>{r} read</span><span>{d} university document{d === 1 ? '' : 's'}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-ivory"><div className="h-full rounded-full bg-sage" style={{ width: `${n?.n ? (r / n.n) * 100 : 0}%` }} /></div>
                    {c.missing && <span className="chip bg-coral-soft text-coral-ink w-max">Missing material · reconstructed</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
