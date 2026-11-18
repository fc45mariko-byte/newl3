import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db, schema as s } from '@/db';
import { Markdown } from '@/components/Markdown';
import { Provenance } from '@/components/badges';

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [d] = await db.select({ doc: s.documents, course: s.courses }).from(s.documents).leftJoin(s.courses, eq(s.courses.id, s.documents.courseId)).where(and(eq(s.documents.id, id), eq(s.documents.userId, u.id)));
  if (!d) notFound();
  const { doc, course } = d;
  return (
    <div className="max-w-4xl flex flex-col gap-4">
      {course && <Link href={`/courses/${course.slug}/resources`} className="text-sm text-muted hover:text-ink">← {course.title}</Link>}
      <div className="flex flex-wrap items-center gap-2"><h1 className="font-serif text-3xl sm:text-4xl break-all">{doc.filename}</h1><Provenance p="UNIVERSITY_MATERIAL" /></div>
      <p className="text-sm text-muted">Extracted text, shown as read from the file. Layout, images and diagrams are not reproduced: open the original for them. <a className="underline" href={`/api/documents/${doc.id}`}>Download the original</a></p>
      {doc.status === 'failed' ? <p className="rounded-xl bg-coral-soft text-coral-ink px-3 py-2">{doc.error}</p>
        : doc.structure?.headings.length ? (
          <details className="card p-4"><summary className="cursor-pointer font-medium">Outline ({doc.structure.headings.length} headings)</summary>
            <ol className="mt-2 text-sm list-decimal pl-5 space-y-0.5">{doc.structure.headings.map((h, i) => <li key={i}>{h.text}{h.page ? <span className="text-muted"> · p. {h.page}</span> : null}</li>)}</ol></details>
        ) : null}
      {doc.text && <div className="card p-5"><Markdown text={doc.text.replace(/\[Notes\]/g, '> Speaker notes:')} /></div>}
    </div>
  );
}
