import Link from 'next/link';
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db, schema as s } from '@/db';
import { NoteList } from '@/components/NoteList';
import { NoteEditor } from '@/components/NoteEditor';

export const metadata = { title: 'Knowledge' };

export default async function Knowledge({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string; view?: string }> }) {
  const sp = await searchParams;
  const u = await requireUser();
  const q = (sp.q ?? '').trim().slice(0, 100);
  const like = `%${q}%`;
  const concepts = q ? await db.select({ slug: s.concepts.slug, term: s.concepts.term, definition: s.concepts.definition, language: s.concepts.language,
    course: sql<string>`(select c.title from concept_chapters cc join chapters ch on ch.id = cc.chapter_id join courses c on c.id = ch.course_id where cc.concept_id = "concepts"."id" limit 1)` })
    .from(s.concepts).where(and(eq(s.concepts.userId, u.id), or(ilike(s.concepts.term, like), ilike(s.concepts.definition, like), sql`${s.concepts.translations}::text ilike ${like}`)))
    .orderBy(sql`case when ${s.concepts.term} ilike ${like} then 0 else 1 end`, asc(s.concepts.term)).limit(40) : [];
  const docs = q ? await db.select({ id: s.documents.id, filename: s.documents.filename, snippet: sql<string>`substring(${s.documents.text} from greatest(1, position(lower(${q}) in lower(${s.documents.text})) - 80) for 220)` })
    .from(s.documents).where(and(eq(s.documents.userId, u.id), or(ilike(s.documents.text, like), ilike(s.documents.filename, like)))).limit(10) : [];
  const notes = await db.select({ n: s.notes, course: s.courses.title, chapter: s.chapters.title }).from(s.notes).leftJoin(s.courses, eq(s.courses.id, s.notes.courseId)).leftJoin(s.chapters, eq(s.chapters.id, s.notes.chapterId))
    .where(and(eq(s.notes.userId, u.id), ...(q ? [or(ilike(s.notes.title, like), ilike(s.notes.body, like))!] : []), ...(sp.tag ? [sql`${sp.tag} = any(${s.notes.tags})`] : []), ...(sp.view === 'bookmarks' ? [eq(s.notes.bookmarked, true)] : [])))
    .orderBy(desc(s.notes.updatedAt)).limit(100);
  const tags = await db.select({ tag: sql<string>`unnest(${s.notes.tags})`, n: sql<number>`count(*)::int` }).from(s.notes).where(eq(s.notes.userId, u.id)).groupBy(sql`1`).orderBy(sql`2 desc`).limit(20);
  const stats = (await db.select({ c: sql<number>`count(*)::int` }).from(s.concepts).where(eq(s.concepts.userId, u.id)))[0].c;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">Knowledge</p><h1 className="font-serif text-4xl sm:text-5xl mt-1">Your knowledge base</h1>
          <p className="text-muted mt-2 max-w-2xl">{stats} concepts across your courses, your notes and the text of your documents, searchable together. Link notes to concepts with [[concept]].</p></div>
        <Link href="/knowledge/graph" className="btn btn-primary">Open the knowledge graph</Link>
      </header>
      <form className="flex gap-2" role="search">
        <label className="sr-only" htmlFor="kq">Search</label>
        <input id="kq" name="q" defaultValue={q} className="input !rounded-full" placeholder="Search concepts, notes and documents (e.g. connaissement, devolution, ventaja)" />
        <button className="btn btn-primary">Search</button>
      </form>
      {q && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card p-5"><h2 className="font-serif text-2xl mb-2">Concepts <span className="text-muted text-base">({concepts.length})</span></h2>
            <ul className="flex flex-col divide-y divide-line">{concepts.map((c) => <li key={c.slug} className="py-2"><Link className="font-medium hover:underline" href={`/knowledge/${encodeURIComponent(c.slug)}`}>{c.term}</Link><span className="text-xs text-muted"> · {c.course} · {c.language.toUpperCase()}</span><p className="text-sm text-muted line-clamp-2">{c.definition}</p></li>)}
              {!concepts.length && <li className="py-2 text-sm text-muted">No concept matches.</li>}</ul></section>
          <section className="card p-5"><h2 className="font-serif text-2xl mb-2">In your documents <span className="text-muted text-base">({docs.length})</span></h2>
            <ul className="flex flex-col divide-y divide-line">{docs.map((d) => <li key={d.id} className="py-2"><Link className="font-medium hover:underline break-all" href={`/documents/${d.id}`}>{d.filename}</Link><p className="text-sm text-muted">…{d.snippet?.replace(/\s+/g, ' ')}…</p></li>)}
              {!docs.length && <li className="py-2 text-sm text-muted">No document mentions it.</li>}</ul></section>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-2xl mr-2">Notes</h2>
            <Link href="/knowledge" className={`chip border ${!sp.view && !sp.tag ? 'bg-charcoal text-paper border-charcoal' : 'border-line'}`}>All</Link>
            <Link href="/knowledge?view=bookmarks" className={`chip border ${sp.view === 'bookmarks' ? 'bg-charcoal text-paper border-charcoal' : 'border-line'}`}>★ Bookmarks</Link>
            {tags.map((t) => <Link key={t.tag} href={`/knowledge?tag=${encodeURIComponent(t.tag)}`} className={`chip border ${sp.tag === t.tag ? 'bg-charcoal text-paper border-charcoal' : 'border-line'}`}>#{t.tag} <span className="opacity-60">{t.n}</span></Link>)}
          </div>
          <NoteList notes={notes.map((x) => ({ ...x.n, course: x.course, chapter: x.chapter }))} courseSlug={null} chapters={[]} />
        </section>
        <aside className="card p-5 h-max"><h2 className="font-serif text-xl mb-3">New note</h2><NoteEditor courseSlug={null} chapters={[]} /></aside>
      </div>
    </div>
  );
}
