import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { dashboard } from '@/lib/queries';
import { fmtDay, fmtLong, fmtTime, greeting, isoParis, occurrences } from '@/lib/dates';
import { Objectives } from '@/components/Objectives';
import { MiniCalendar } from '@/components/MiniCalendar';
import { IconArrow } from '@/components/icons';
import { db, schema as s } from '@/db';
import { eq } from 'drizzle-orm';

export const metadata = { title: 'Dashboard' };

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub: string }) {
  return <div><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="text-[11px] uppercase tracking-wide opacity-70">{sub}</p><p className="sr-only">{label}</p></div>;
}

export default async function Dashboard() {
  const user = await requireUser();
  const d = await dashboard(user.id);
  const now = new Date();
  const allEvents = await db.select().from(s.events).where(eq(s.events.userId, user.id));
  const dayStart = new Date(`${isoParis(now)}T00:00:00+01:00`), dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const today = occurrences(allEvents, dayStart, dayEnd);
  const upcoming = occurrences(allEvents, now, new Date(now.getTime() + 14 * 86_400_000)).filter((e) => e.kind !== 'class').slice(0, 4);
  const nextClass = occurrences(allEvents.filter((e) => e.kind === 'class'), now, new Date(now.getTime() + 8 * 86_400_000))[0];
  const k = d.knowledge;
  const message = [
    `${d.active.length} courses this semester`,
    d.openTasks.length ? `${d.openTasks.length} task${d.openTasks.length > 1 ? 's' : ''} open` : 'no open task',
    d.due ? `${d.due} flashcard${d.due > 1 ? 's' : ''} due` : null,
    nextClass ? `next class ${fmtDay(nextClass.at)} at ${fmtTime(nextClass.at)}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-6 min-w-0">
        <header>
          <p className="eyebrow">L3 LEA · Commerce international · {d.sem.year} · {d.sem.code}</p>
          <h1 className="font-serif text-4xl sm:text-5xl mt-1">{greeting(now)}, {user.name}</h1>
          <p className="text-muted mt-2 max-w-2xl">{fmtLong(now)}. {message}.</p>
        </header>

        <section aria-label="Academic overview" className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <div className="rounded-[18px] bg-butter p-5 flex flex-col gap-3">
            <h2 className="font-serif text-xl">Content read</h2>
            <div className="flex gap-6"><Stat label="Chapters read" value={d.chaptersRead} sub="read" /><Stat label="In progress" value={d.chaptersInProgress} sub="opened" /><Stat label="Total" value={d.chaptersTotal} sub="chapters" /></div>
            <div className="h-1.5 rounded-full bg-charcoal/10"><div className="h-full rounded-full bg-charcoal" style={{ width: `${d.chaptersTotal ? (d.chaptersRead / d.chaptersTotal) * 100 : 0}%` }} /></div>
          </div>
          <div className="rounded-[18px] bg-rose-soft p-5 flex flex-col gap-3">
            <h2 className="font-serif text-xl">Practice</h2>
            <div className="flex gap-6"><Stat label="Exercise parts solved" value={`${d.exercises.done}/${d.exercises.total}`} sub="exercise parts" /><Stat label="Flashcards due" value={d.due} sub="cards due" /></div>
            <p className="text-xs opacity-75">{d.lastQuiz ? `Last quiz: ${Math.round(((d.lastQuiz.score ?? 0) / (d.lastQuiz.max || 1)) * 100)} % (${d.lastQuiz.mode}${d.lastQuiz.course ? `, ${d.lastQuiz.course}` : ''})` : 'No quiz taken yet.'}</p>
          </div>
          <div className="rounded-[18px] bg-sage p-5 flex flex-col gap-3">
            <h2 className="font-serif text-xl">Demonstrated knowledge</h2>
            <div className="flex gap-5"><Stat label="Understood" value={k.understood} sub="understood" /><Stat label="Retained" value={k.retained} sub="retained 7 d+" /><Stat label="Needs work" value={k.needsWork} sub="needs work" /></div>
            <p className="text-xs opacity-80">Out of {k.total} concepts. Based on your answers, not on chapters marked as read.</p>
          </div>
          <div className="rounded-[18px] bg-powder p-5 flex flex-col gap-3">
            <h2 className="font-serif text-xl">Deadlines</h2>
            <div className="flex gap-6"><Stat label="Exams" value={d.exams.length} sub="exams" /><Stat label="Assignments" value={d.assignments.length} sub="assignments" /><Stat label="Tasks" value={d.openTasks.length} sub="open tasks" /></div>
            <p className="text-xs opacity-80">{d.exams.length ? `Next exam: ${d.exams[0].title}, ${fmtDay(d.exams[0].startsAt)}` : 'No exam date recorded yet. Add them in the planner.'}</p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="card p-5">
            <div className="flex items-center justify-between"><h2 className="font-serif text-2xl">Next step</h2></div>
            <Link href={d.suggestion.href} className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-charcoal text-paper px-4 py-3.5 hover:bg-black">
              <span><b className="block">{d.suggestion.title}</b><span className="text-sm text-white/70">{d.suggestion.detail}</span></span><IconArrow />
            </Link>
            <h3 className="eyebrow mt-5 mb-2">Recently opened</h3>
            <ul className="flex flex-col divide-y divide-line">
              {d.recent.length ? d.recent.slice(0, 5).map((r) => (
                <li key={r.chapterSlug} className="py-2 flex justify-between gap-3 text-sm">
                  <Link className="hover:underline min-w-0 truncate" href={`/courses/${r.courseSlug}/chapters/${r.chapterSlug}`}>{r.chapter}</Link>
                  <span className="text-muted shrink-0">{r.readAt ? 'read' : 'opened'} · {fmtDay(r.openedAt)}</span>
                </li>
              )) : <li className="py-2 text-sm text-muted">Nothing opened yet. Start with a course below.</li>}
            </ul>
            {d.lastRead && <p className="text-xs text-muted mt-3">Last chapter completed: {d.lastRead.chapter}</p>}
          </div>
          <div className="card p-5">
            <h2 className="font-serif text-2xl">Semester objectives</h2>
            <p className="text-xs text-muted mb-3">Set by you. Tick when achieved or record progress.</p>
            <Objectives items={d.objectives} />
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-serif text-2xl">Courses this semester</h2>
            <Link className="btn btn-ghost text-sm" href="/courses">All courses <IconArrow width={16} height={16} /></Link>
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {d.active.map((c) => (
              <li key={c.id}>
                <Link href={`/courses/${c.slug}`} className="flex items-center gap-3 rounded-2xl border border-line bg-paper px-3.5 py-3 hover:border-ink">
                  <span className="min-w-0 flex-1"><b className="block truncate font-medium">{c.title}</b>
                    <span className="text-xs text-muted">{c.read}/{c.chapters} read · {c.understood} understood{c.needsWork ? ` · ${c.needsWork} to rework` : ''}{c.missing ? ' · reconstructed course' : ''}</span></span>
                  <span className="text-xs font-semibold uppercase text-muted">{c.language}</span>
                </Link>
              </li>
            ))}
          </ul>
          {d.incomplete.length > 0 && (
            <p className="mt-4 text-sm rounded-xl bg-coral-soft text-coral-ink px-3 py-2">
              Incomplete curriculum coverage: {d.incomplete.map((c, i) => <span key={c.id}>{i ? ', ' : ''}<Link className="underline" href={`/courses/${c.slug}`}>{c.title}</Link></span>)}. Material is missing or still being researched.
            </p>
          )}
        </section>
      </div>

      <aside className="flex flex-col gap-4 min-w-0">
        <div className="card p-4"><MiniCalendar events={allEvents.map((e) => ({ startsAt: e.startsAt.toISOString(), endsAt: e.endsAt.toISOString(), weekly: e.weekly, repeatUntil: e.repeatUntil, kind: e.kind }))} /></div>
        <div className="card p-4">
          <h2 className="font-serif text-xl mb-2">Today</h2>
          <ol className="flex flex-col gap-2">
            {today.length ? today.map((e) => (
              <li key={e.id + e.at.toISOString()} className={`rounded-xl px-3 py-2 text-sm ${e.kind === 'class' ? 'bg-ivory' : e.kind === 'exam' ? 'bg-coral-soft' : 'bg-butter-soft'}`}>
                <b className="block">{e.title}</b><span className="text-xs text-muted">{fmtTime(e.at)}–{fmtTime(e.end)}{e.location ? ` · ${e.location}` : ''}</span>
              </li>
            )) : <li className="text-sm text-muted">Nothing scheduled today.</li>}
          </ol>
          <h3 className="eyebrow mt-4 mb-2">Coming up</h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {upcoming.length ? upcoming.map((e) => <li key={e.id + e.at.toISOString()} className="flex justify-between gap-2"><span className="truncate">{e.title}</span><span className="text-muted shrink-0">{fmtDay(e.at)}</span></li>) : <li className="text-muted">No deadline in the next two weeks.</li>}
          </ul>
          <Link href="/planner" className="btn btn-primary w-full mt-4">Open planner</Link>
        </div>
        <div className="card p-4">
          <h2 className="font-serif text-xl mb-2">Open tasks</h2>
          <ul className="flex flex-col gap-1.5 text-sm">
            {d.openTasks.slice(0, 5).map((t) => <li key={t.id} className="flex justify-between gap-2"><span className="truncate">{t.title}</span>{t.dueOn && <span className={`shrink-0 ${t.dueOn <= isoParis(now) ? 'text-coral-ink font-medium' : 'text-muted'}`}>{fmtDay(new Date(`${t.dueOn}T12:00:00Z`))}</span>}</li>)}
            {!d.openTasks.length && <li className="text-muted">No open task.</li>}
          </ul>
          <Link href="/tasks" className="btn w-full mt-3">All tasks</Link>
        </div>
      </aside>
    </div>
  );
}
