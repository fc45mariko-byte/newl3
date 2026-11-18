import Link from 'next/link';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { getCourse } from '@/lib/course-data';
import { db, schema as s } from '@/db';
import { CourseHeader } from '@/components/CourseHeader';
import { ActionForm } from '@/components/ActionForm';
import { DeleteDocument } from '@/components/DeleteDocument';
import { addSource, uploadDocuments } from '@/app/actions/courses';
import { Provenance } from '@/components/badges';

const TIER: Record<string, string> = { P1: 'Université d’Orléans', P2: 'Other French universities', P3: 'Academic, official and professional sources' };

export default async function Resources({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const u = await requireUser();
  const course = await getCourse(u.id, slug);
  const docs = await db.select({ id: s.documents.id, filename: s.documents.filename, status: s.documents.status, error: s.documents.error, size: s.documents.size, createdAt: s.documents.createdAt, structure: s.documents.structure })
    .from(s.documents).where(and(eq(s.documents.userId, u.id), eq(s.documents.courseId, course.id))).orderBy(desc(s.documents.createdAt));
  const chapters = await db.select({ id: s.chapters.id, title: s.chapters.title, sourceKeys: s.chapters.sourceKeys }).from(s.chapters).where(eq(s.chapters.courseId, course.id)).orderBy(asc(s.chapters.position));
  const keys = [...new Set([...course.officialSourceKeys, ...chapters.flatMap((c) => c.sourceKeys)])];
  const sources = keys.length ? await db.select().from(s.sources).where(and(eq(s.sources.userId, u.id), inArray(s.sources.key, keys))) : [];
  return (
    <div>
      <CourseHeader course={course} tab="resources" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6 min-w-0">
          <section className="card p-5">
            <div className="flex items-center gap-2 mb-3"><h2 className="font-serif text-2xl">University documents</h2><Provenance p="UNIVERSITY_MATERIAL" /></div>
            {docs.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {docs.map((d) => (
                  <li key={d.id} className="py-2.5 flex flex-wrap items-center gap-3 justify-between">
                    <div className="min-w-0"><Link href={`/documents/${d.id}`} className="font-medium hover:underline break-all">{d.filename}</Link>
                      <p className="text-xs text-muted">{Math.round(d.size / 1024)} KB · {d.status === 'extracted' ? `${d.structure?.headings.length ?? 0} headings${d.structure?.pages ? ` · ${d.structure.pages} pages` : ''}${d.structure?.tables ? ` · ${d.structure.tables} tables` : ''}` : d.status}</p>
                      {d.error && <p className="text-xs text-coral-ink mt-0.5">{d.error}</p>}</div>
                    <div className="flex gap-2"><a className="btn !py-1 text-xs" href={`/api/documents/${d.id}`}>Original</a><DeleteDocument slug={slug} id={d.id} name={d.filename} /></div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">No document yet.</p>}
          </section>
          <section className="card p-5">
            <h2 className="font-serif text-2xl mb-1">Sources used for this course</h2>
            <p className="text-xs text-muted mb-3">Each entry records who wrote it, when, where to find it, and whether it was read in full, seen through an excerpt, or only cited.</p>
            {(['P1', 'P2', 'P3'] as const).map((tier) => {
              const list = sources.filter((x) => x.tier === tier);
              return list.length ? (
                <div key={tier} className="mb-4"><h3 className="eyebrow mb-2">{TIER[tier]}</h3>
                  <ul className="flex flex-col gap-2 text-sm">{list.map((src) => (
                    <li key={src.key} className="rounded-xl border border-line px-3 py-2">
                      <b>{src.url ? <a className="underline" href={src.url} target="_blank" rel="noopener noreferrer">{src.title}</a> : src.title}</b>
                      <span className="text-muted"> — {src.author}{src.publishedOn ? `, ${src.publishedOn}` : ''}</span>
                      <span className="block text-xs text-muted">{src.type ?? 'type not recorded'} · {src.access === 'read' ? 'read' : src.access === 'excerpt' ? 'excerpt only' : 'cited, not opened'}</span>
                      {src.relevance && <span className="block text-xs mt-0.5">{src.relevance}</span>}
                    </li>))}</ul></div>
              ) : null;
            })}
          </section>
        </div>
        <aside className="flex flex-col gap-4 min-w-0">
          <section className="card p-5">
            <h2 className="font-serif text-xl mb-1">Upload course documents</h2>
            <p className="text-xs text-muted mb-3">PDF, Word (.docx), PowerPoint (.pptx), text or Markdown, up to 25 MB each. The original is kept; its text is extracted and becomes searchable. If extraction fails, you are told why.</p>
            <ActionForm action={uploadDocuments.bind(null, slug)} submit="Upload" pendingLabel="Uploading and reading…" reset>
              <label className="label">Files<input className="input" type="file" name="files" multiple accept=".pdf,.docx,.pptx,.txt,.md" required /></label>
              <label className="label">Chapter (optional)<select className="input" name="chapterId"><option value="">Whole course</option>{chapters.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
            </ActionForm>
          </section>
          <section className="card p-5">
            <h2 className="font-serif text-xl mb-3">Add an external resource</h2>
            <ActionForm action={addSource.bind(null, slug)} submit="Add resource" reset>
              <label className="label">Title<input className="input" name="title" required /></label>
              <label className="label">Author or institution<input className="input" name="author" required /></label>
              <label className="label">URL<input className="input" name="url" type="url" placeholder="https://…" /></label>
              <div className="grid grid-cols-2 gap-3"><label className="label">Date<input className="input" name="publishedOn" placeholder="2025" /></label><label className="label">Type<input className="input" name="type" placeholder="Article, book…" /></label></div>
              <label className="label">Why it is useful<textarea className="input min-h-20" name="relevance" /></label>
            </ActionForm>
          </section>
        </aside>
      </div>
    </div>
  );
}
