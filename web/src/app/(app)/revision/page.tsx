import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { revisionAnalytics } from '@/lib/analytics';
import { quizCourses } from '@/lib/revision-courses';
import { StartForm } from '@/components/quiz/StartForm';
import { MODES } from '@/lib/quiz';

export const metadata = { title: 'Revision' };
const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`);
const TYPE: Record<string, string> = { single: 'One answer', multiple: 'Several answers', true_false: 'True / false', matching: 'Matching', ordering: 'Ordering', short: 'Short answer', scenario: 'Case' };

function Bars({ rows, label = (k: string) => k }: { rows: { key: string; n: number; accuracy: number }[]; label?: (k: string) => string }) {
  if (!rows.length) return <p className="text-sm text-muted">No answer yet.</p>;
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_90px_48px] items-center gap-2">
          <span className="truncate" title={label(r.key)}>{label(r.key)}</span>
          <span className="h-2 rounded-full bg-ivory overflow-hidden"><span className={`block h-full ${r.accuracy >= 0.8 ? 'bg-sage' : r.accuracy >= 0.5 ? 'bg-butter' : 'bg-coral'}`} style={{ width: `${r.accuracy * 100}%` }} /></span>
          <span className="tabular-nums text-right text-xs text-muted">{Math.round(r.accuracy * 100)}% · {r.n}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function Revision({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const sp = await searchParams;
  const u = await requireUser();
  const [a, courses] = await Promise.all([revisionAnalytics(u.id), quizCourses(u.id)]);
  const maxDay = Math.max(1, ...a.days.map((d) => d.n));
  return (
    <div className="flex flex-col gap-6">
      <header><p className="eyebrow">Revision</p><h1 className="font-serif text-4xl sm:text-5xl mt-1">Test what you understand</h1>
        <p className="text-muted mt-2 max-w-2xl">Quizzes test understanding, application and analysis, not only recognition. Results are recorded; mastery is judged over several attempts.</p></header>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <StartForm courses={courses} initialMode={sp.start && sp.start in MODES ? sp.start : 'chapter'} />
        <div className="flex flex-col gap-4">
          <section className="card p-5">
            <div className="flex items-center justify-between"><h2 className="font-serif text-2xl">Flashcards</h2><Link href="/revision/flashcards" className="btn btn-primary">Review now</Link></div>
            <p className="text-xs text-muted mt-1">SuperMemo-2 spaced repetition. A card counts as mastered once its interval reaches three weeks.</p>
            <div className="grid grid-cols-5 gap-2 mt-3 text-center">
              {(['new', 'learning', 'review', 'mastered', 'difficult'] as const).map((k) => <div key={k} className={`rounded-xl py-2 ${k === 'mastered' ? 'bg-sage-soft' : k === 'difficult' ? 'bg-coral-soft' : 'bg-ivory'}`}><p className="text-xl font-semibold tabular-nums">{a.cardBuckets[k]}</p><p className="text-[10.5px] uppercase tracking-wide text-muted">{k}</p></div>)}
            </div>
            <p className="text-xs text-muted mt-2">{a.cardsSeen} cards studied so far. Cards you have never opened are not counted as new until you start them.</p>
          </section>
          <section className="card p-5">
            <div className="flex items-center justify-between"><h2 className="font-serif text-2xl">Exercises</h2><Link href="/revision/exercises" className="btn">Open</Link></div>
            <p className="text-sm text-muted mt-1">Accounting entries, Incoterms and transport calculations, translations and case studies, with corrections.</p>
          </section>
          <section className="card p-5">
            <h2 className="font-serif text-2xl mb-2">Recent attempts</h2>
            <ul className="flex flex-col divide-y divide-line text-sm">
              {a.attempts.length ? a.attempts.map((t) => (
                <li key={t.id} className="py-2 flex justify-between gap-2"><Link href={`/revision/quiz/${t.id}`} className="hover:underline truncate">{MODES[t.mode as keyof typeof MODES]?.label ?? t.mode}{t.course ? ` · ${t.course}` : ''}</Link>
                  <span className="text-muted shrink-0">{t.finishedAt ? `${Math.round(((t.score ?? 0) / (t.max || 1)) * 100)} %` : 'in progress'}</span></li>
              )) : <li className="py-2 text-muted">No quiz yet.</li>}
            </ul>
          </section>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-3xl">Analytics</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-[18px] bg-powder p-5"><p className="text-3xl font-semibold tabular-nums">{pct(a.accuracy)}</p><p className="text-xs uppercase tracking-wide opacity-75">overall accuracy</p></div>
          <div className="rounded-[18px] bg-butter p-5"><p className="text-3xl font-semibold tabular-nums">{a.total}</p><p className="text-xs uppercase tracking-wide opacity-75">answers graded</p></div>
          <div className="rounded-[18px] bg-rose-soft p-5"><p className="text-3xl font-semibold tabular-nums">{a.pendingReview}</p><p className="text-xs uppercase tracking-wide opacity-75">written answers to self-assess</p></div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5"><h3 className="font-serif text-xl mb-3">By course</h3><Bars rows={a.byCourse} /></div>
          <div className="card p-5"><h3 className="font-serif text-xl mb-3">Weakest chapters</h3><Bars rows={a.byChapter} /></div>
          <div className="card p-5"><h3 className="font-serif text-xl mb-3">By question type</h3><Bars rows={a.byType} label={(k) => TYPE[k] ?? k} /></div>
          <div className="card p-5"><h3 className="font-serif text-xl mb-3">By difficulty</h3><Bars rows={a.byDifficulty} /></div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <h3 className="font-serif text-xl mb-3">Last 14 days</h3>
            <div className="flex items-end gap-1 h-28" role="img" aria-label="Answers per day over the last 14 days">
              {a.days.map((d) => <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${d.day}: ${d.n} answers${d.accuracy !== null ? `, ${Math.round(d.accuracy * 100)} %` : ''}`}>
                <div className={`w-full rounded-t ${d.accuracy === null ? 'bg-line' : d.accuracy >= 0.8 ? 'bg-sage' : d.accuracy >= 0.5 ? 'bg-butter' : 'bg-coral'}`} style={{ height: `${(d.n / maxDay) * 100}%`, minHeight: d.n ? 4 : 2 }} />
                <span className="text-[9px] text-muted">{d.day.slice(8)}</span></div>)}
            </div>
          </div>
          <div className="card p-5">
            <h3 className="font-serif text-xl mb-3">Recurring weaknesses</h3>
            {a.weak.length > 0 && <div className="flex flex-wrap gap-1.5 mb-3">{a.weak.map((c) => <Link key={c.slug} href={`/knowledge/${encodeURIComponent(c.slug)}`} className="chip bg-coral-soft text-coral-ink">{c.term}</Link>)}</div>}
            {a.recurring.length ? <ul className="text-sm flex flex-col gap-2">{a.recurring.map((r, i) => <li key={i}><Link className="hover:underline" href={`/courses/${r.courseSlug}/chapters/${r.chapterSlug}`}>{r.stem.slice(0, 120)}</Link> <span className="text-xs text-coral-ink">missed {r.n}×</span></li>)}</ul>
              : <p className="text-sm text-muted">Questions you miss twice or more will appear here.</p>}
            {(a.weak.length > 0 || a.recurring.length > 0) && <Link href="/revision?start=weakness" className="btn mt-3">Train on these</Link>}
          </div>
        </div>
      </section>
    </div>
  );
}
