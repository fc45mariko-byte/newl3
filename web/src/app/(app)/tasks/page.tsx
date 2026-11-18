import { asc, desc, eq, sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db, schema as s } from '@/db';
import { TaskBoard } from '@/components/TaskBoard';

export const metadata = { title: 'Tasks' };
export default async function Tasks({ searchParams }: { searchParams: Promise<{ filter?: string; course?: string }> }) {
  const sp = await searchParams;
  const u = await requireUser();
  const rows = await db.select({ t: s.tasks, course: s.courses.title, courseSlug: s.courses.slug }).from(s.tasks).leftJoin(s.courses, eq(s.courses.id, s.tasks.courseId))
    .where(eq(s.tasks.userId, u.id)).orderBy(sql`${s.tasks.doneAt} is not null`, sql`case ${s.tasks.priority} when 'high' then 0 when 'normal' then 1 else 2 end`, sql`${s.tasks.dueOn} asc nulls last`, desc(s.tasks.createdAt));
  const courses = await db.select({ id: s.courses.id, title: s.courses.title }).from(s.courses).where(eq(s.courses.userId, u.id)).orderBy(asc(s.courses.position));
  return (
    <div className="flex flex-col gap-6">
      <header><p className="eyebrow">Tasks</p><h1 className="font-serif text-4xl sm:text-5xl mt-1">What needs doing</h1>
        <p className="text-muted mt-2">{rows.filter((r) => !r.t.doneAt).length} open · {rows.filter((r) => r.t.doneAt).length} done. Completed tasks update your dashboard.</p></header>
      <TaskBoard tasks={rows.map((r) => ({ ...r.t, course: r.course, courseSlug: r.courseSlug, createdAt: r.t.createdAt.toISOString(), doneAt: r.t.doneAt?.toISOString() ?? null }))} courses={courses} filter={sp.filter ?? 'open'} />
    </div>
  );
}
