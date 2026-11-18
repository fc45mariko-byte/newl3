import { asc, eq, inArray } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db, schema as s } from '@/db';
import { occurrences } from '@/lib/dates';
import { PlannerView } from '@/components/planner/PlannerView';
import { EventForm } from '@/components/planner/EventForm';
import { PlanSuggester } from '@/components/planner/PlanSuggester';

export const metadata = { title: 'Planner' };

export default async function Planner({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  const sp = await searchParams;
  const u = await requireUser();
  const events = await db.select().from(s.events).where(eq(s.events.userId, u.id));
  const courses = await db.select({ id: s.courses.id, title: s.courses.title, slug: s.courses.slug }).from(s.courses).where(eq(s.courses.userId, u.id)).orderBy(asc(s.courses.position));
  const chapters = await db.select({ id: s.chapters.id, title: s.chapters.title, courseId: s.chapters.courseId }).from(s.chapters).where(inArray(s.chapters.courseId, courses.map((c) => c.id))).orderBy(asc(s.chapters.position));
  const from = new Date('2026-08-01T00:00:00Z'), to = new Date('2027-07-31T00:00:00Z');
  const occ = occurrences(events, from, to).map((e) => ({ id: e.id, title: e.title, kind: e.kind, at: e.at.toISOString(), end: e.end.toISOString(), location: e.location, weekly: e.weekly, source: e.source,
    course: courses.find((c) => c.id === e.courseId) ?? null, chapterId: e.chapterId }));
  const view = sp.view === 'month' || sp.view === 'semester' ? sp.view : 'week';
  return (
    <div className="flex flex-col gap-6">
      <header><p className="eyebrow">Planner</p><h1 className="font-serif text-4xl sm:text-5xl mt-1">Your semester</h1>
        <p className="text-muted mt-2 max-w-2xl">Classes, exams, assignments and study sessions, linked to their courses. Only the Tourism slot comes from your timetable; add the others once as weekly classes.</p></header>
      <PlannerView events={occ} view={view} date={sp.date} raw={events.map((e) => ({ id: e.id, title: e.title, kind: e.kind, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt.toISOString(), weekly: e.weekly, repeatUntil: e.repeatUntil, location: e.location, courseId: e.courseId, chapterId: e.chapterId }))}
        courses={courses} chapters={chapters} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5"><h2 className="font-serif text-2xl mb-3">Add to the planner</h2><EventForm courses={courses} chapters={chapters} /></section>
        <section className="card p-5"><h2 className="font-serif text-2xl mb-1">Plan revision for an exam</h2>
          <p className="text-xs text-muted mb-3">Uses each chapter’s priority, what your answers show you master and the time already taken by your schedule. It never plans more than the time you give, keeps one day a week free, and says when the time is not enough.</p>
          <PlanSuggester courses={courses} /></section>
      </div>
    </div>
  );
}
