import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq, ilike, inArray, or } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db, schema as s } from '@/db';
import { ConceptCard } from '@/components/ConceptCard';
import { answerPoints } from '@/lib/queries';
import { conceptMastery } from '@/lib/mastery';

const STATUS: Record<string, [string, string]> = {
  unseen: ['Not tested yet', 'bg-ivory'], learning: ['Being learnt', 'bg-butter-soft'], understood: ['Understood', 'bg-sage-soft text-sage-ink'],
  retained: ['Retained over time', 'bg-sage text-charcoal'], needs_work: ['Needs work', 'bg-coral-soft text-coral-ink'],
};

export default async function ConceptPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeURIComponent((await params).slug);
  const u = await requireUser();
  const [c] = await db.select().from(s.concepts).where(and(eq(s.concepts.userId, u.id), eq(s.concepts.slug, slug)));
  if (!c) notFound();
  const where = await db.select({ chapter: s.chapters.title, chapterSlug: s.chapters.slug, course: s.courses.title, courseSlug: s.courses.slug, language: s.courses.language })
    .from(s.conceptChapters).innerJoin(s.chapters, eq(s.chapters.id, s.conceptChapters.chapterId)).innerJoin(s.courses, eq(s.courses.id, s.chapters.courseId)).where(eq(s.conceptChapters.conceptId, c.id));
  const out = await db.select({ relation: s.conceptLinks.relation, toSlug: s.concepts.slug, toTerm: s.concepts.term }).from(s.conceptLinks).innerJoin(s.concepts, eq(s.concepts.id, s.conceptLinks.toId)).where(eq(s.conceptLinks.fromId, c.id));
  const inc = await db.select({ relation: s.conceptLinks.relation, slug: s.concepts.slug, term: s.concepts.term }).from(s.conceptLinks).innerJoin(s.concepts, eq(s.concepts.id, s.conceptLinks.fromId)).where(eq(s.conceptLinks.toId, c.id));
  const sources = c.sourceKeys.length ? await db.select().from(s.sources).where(and(eq(s.sources.userId, u.id), inArray(s.sources.key, c.sourceKeys))) : [];
  const notes = await db.select().from(s.notes).where(and(eq(s.notes.userId, u.id), or(eq(s.notes.conceptId, c.id), ilike(s.notes.body, `%[[${c.term}]]%`))));
  const m = conceptMastery((await answerPoints(u.id)).filter((p) => p.conceptId === c.id)).get(c.id);
  const status = STATUS[m?.status ?? 'unseen'];
  const lang = (where[0]?.language ?? c.language) as 'fr' | 'en' | 'es';
  return (
    <div className="max-w-5xl flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href="/knowledge" className="text-sm text-muted hover:text-ink w-max">← Knowledge</Link>
        <p className="eyebrow">Concept · {lang.toUpperCase()}</p>
        <h1 className="font-serif text-4xl sm:text-5xl" lang={lang}>{c.term}</h1>
        <div className="flex flex-wrap items-center gap-2"><span className={`chip ${status[1]}`}>{status[0]}</span>{m && <span className="text-xs text-muted">{m.answers} answer{m.answers > 1 ? 's' : ''} · weighted accuracy {Math.round(m.accuracy * 100)} %</span>}</div>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0" lang={lang}>
          <ConceptCard c={{ ...c, data: c.data as any }} lang={lang} links={out} defaultOpen />
          {sources.length > 0 && (
            <section className="mt-5"><h2 className="eyebrow mb-2">Sources</h2>
              <ul className="flex flex-col gap-2 text-sm">{sources.map((x) => <li key={x.key} className="rounded-xl border border-line px-3 py-2"><b>{x.url ? <a className="underline" href={x.url} target="_blank" rel="noopener noreferrer">{x.title}</a> : x.title}</b> <span className="text-muted">— {x.author}{x.publishedOn ? `, ${x.publishedOn}` : ''}</span></li>)}</ul></section>
          )}
        </div>
        <aside className="flex flex-col gap-4">
          <section className="card p-4"><h2 className="font-serif text-xl mb-2">Where it appears</h2>
            <ul className="text-sm space-y-1.5">{where.map((w) => <li key={w.chapterSlug}><Link className="hover:underline" href={`/courses/${w.courseSlug}/chapters/${w.chapterSlug}#${encodeURIComponent(c.slug)}`}>{w.chapter}</Link><span className="block text-xs text-muted">{w.course}</span></li>)}</ul></section>
          {inc.length > 0 && <section className="card p-4"><h2 className="font-serif text-xl mb-2">Builds on it</h2>
            <ul className="text-sm space-y-1">{inc.map((x) => <li key={x.slug + x.relation}><Link className="hover:underline" href={`/knowledge/${encodeURIComponent(x.slug)}`}>{x.term}</Link> <span className="text-xs text-muted">{x.relation === 'prerequisite' ? 'needs this first' : 'related'}</span></li>)}</ul></section>}
          <section className="card p-4"><h2 className="font-serif text-xl mb-2">Your notes</h2>
            {notes.length ? <ul className="text-sm space-y-2">{notes.map((n) => <li key={n.id} className="rounded-lg bg-ivory px-2.5 py-1.5"><b>{n.title}</b><span className="block whitespace-pre-wrap text-xs">{n.body.slice(0, 200)}</span></li>)}</ul>
              : <p className="text-sm text-muted">No note links to this concept. Write [[{c.term}]] in a note to link it.</p>}</section>
          <Link className="btn btn-primary" href="/revision?start=weakness">Practise weak concepts</Link>
        </aside>
      </div>
    </div>
  );
}
