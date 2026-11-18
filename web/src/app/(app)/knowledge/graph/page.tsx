import { and, asc, eq, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { db, schema as s } from '@/db';
import { KnowledgeGraph } from '@/components/KnowledgeGraph';

export const metadata = { title: 'Knowledge graph' };

export default async function Graph({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const sp = await searchParams;
  const u = await requireUser();
  const courses = await db.select({ id: s.courses.id, slug: s.courses.slug, title: s.courses.title }).from(s.courses).where(eq(s.courses.userId, u.id)).orderBy(asc(s.courses.position));
  const selected = courses.find((c) => c.slug === sp.course) ?? courses[0];
  const chapters = selected ? await db.select({ id: s.chapters.id, slug: s.chapters.slug, title: s.chapters.title }).from(s.chapters).where(eq(s.chapters.courseId, selected.id)).orderBy(asc(s.chapters.position)) : [];
  const cc = chapters.length ? await db.select({ conceptId: s.conceptChapters.conceptId, chapterId: s.conceptChapters.chapterId }).from(s.conceptChapters).where(inArray(s.conceptChapters.chapterId, chapters.map((c) => c.id))) : [];
  const ids = [...new Set(cc.map((x) => x.conceptId))];
  const concepts = ids.length ? await db.select({ id: s.concepts.id, slug: s.concepts.slug, term: s.concepts.term }).from(s.concepts).where(inArray(s.concepts.id, ids)) : [];
  const links = ids.length ? await db.select({ fromId: s.conceptLinks.fromId, toId: s.conceptLinks.toId, relation: s.conceptLinks.relation }).from(s.conceptLinks).where(inArray(s.conceptLinks.fromId, ids)) : [];
  // Concepts of other courses reached by a link: the cross-course connections.
  const external = [...new Set(links.map((l) => l.toId).filter((x) => !ids.includes(x)))];
  const ext = external.length ? await db.select({ id: s.concepts.id, slug: s.concepts.slug, term: s.concepts.term, course: s.courses.title })
    .from(s.concepts).innerJoin(s.conceptChapters, eq(s.conceptChapters.conceptId, s.concepts.id)).innerJoin(s.chapters, eq(s.chapters.id, s.conceptChapters.chapterId)).innerJoin(s.courses, eq(s.courses.id, s.chapters.courseId))
    .where(and(inArray(s.concepts.id, external), eq(s.courses.userId, u.id))) : [];
  const nodes = [
    ...(selected ? [{ id: selected.id, label: selected.title, kind: 'course' as const, href: `/courses/${selected.slug}` }] : []),
    ...chapters.map((c) => ({ id: c.id, label: c.title, kind: 'chapter' as const, href: `/courses/${selected!.slug}/chapters/${c.slug}` })),
    ...concepts.map((c) => ({ id: c.id, label: c.term, kind: 'concept' as const, href: `/knowledge/${encodeURIComponent(c.slug)}` })),
    ...[...new Map(ext.map((c) => [c.id, c])).values()].map((c) => ({ id: c.id, label: `${c.term} (${c.course})`, kind: 'external' as const, href: `/knowledge/${encodeURIComponent(c.slug)}` })),
  ];
  const edges = [
    ...chapters.map((c) => ({ source: selected!.id, target: c.id, kind: 'contains' })),
    ...cc.map((x) => ({ source: x.chapterId, target: x.conceptId, kind: 'contains' })),
    ...links.filter((l) => nodes.some((n) => n.id === l.toId)).map((l) => ({ source: l.fromId, target: l.toId, kind: l.relation })),
  ];
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><Link href="/knowledge" className="text-sm text-muted hover:text-ink">← Knowledge</Link><h1 className="font-serif text-4xl mt-1">Knowledge graph</h1>
          <p className="text-sm text-muted mt-1 max-w-2xl">A course, its chapters and concepts, the prerequisite and related links between concepts, and the concepts of other courses they lead to. Click a node to open it.</p></div>
        <form className="flex gap-2 items-end"><label className="label">Course<select className="input" name="course" defaultValue={selected?.slug}>{courses.map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}</select></label><button className="btn">Show</button></form>
      </header>
      <KnowledgeGraph nodes={nodes} edges={edges} />
    </div>
  );
}
