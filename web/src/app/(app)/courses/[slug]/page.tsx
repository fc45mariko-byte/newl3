import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { courseOverview } from '@/lib/course-data';
import { CourseHeader } from '@/components/CourseHeader';
import { Priority, Provenance, Status } from '@/components/badges';
import { ActionForm } from '@/components/ActionForm';
import { addChapter, requestReconstruction } from '@/app/actions/courses';

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const u = await requireUser();
  const { course, chapters, docs, total } = await courseOverview(u.id, slug);
  const read = chapters.filter((c) => c.read).length;
  // Recommended sequence: chapters in course order, essential ones first within what has not been read.
  const sequence = [...chapters].filter((c) => !c.read).sort((a, b) => (a.priority === b.priority ? a.position - b.position : ['ESSENTIAL', 'IMPORTANT', 'ADVANCED'].indexOf(a.priority) - ['ESSENTIAL', 'IMPORTANT', 'ADVANCED'].indexOf(b.priority))).slice(0, 5);
  return (
    <div>
      <CourseHeader course={course} tab="overview" stats={`${read}/${chapters.length} chapters read · ${total.understood}/${total.total} concepts understood`} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6 min-w-0">
          <section className="card p-5">
            <div className="flex flex-wrap items-center gap-2 mb-2"><h2 className="font-serif text-2xl">About the course</h2><Provenance p="OFFICIAL_SOURCE" /></div>
            {course.officialDescription ? <p className="prose-lea">{course.officialDescription}</p> : <p className="text-muted text-sm">The university website gives no description for this course.</p>}
            {course.bibliography.length > 0 && (<><h3 className="eyebrow mt-4 mb-1">Official reading list</h3><ul className="list-disc pl-5 text-sm space-y-1">{course.bibliography.map((b) => <li key={b}>{b}</li>)}</ul></>)}
            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              {course.frameworks.length > 0 && <div><h3 className="eyebrow mb-1">Frameworks and methods</h3><ul className="list-disc pl-5 text-sm space-y-1">{course.frameworks.map((f) => <li key={f}>{f}</li>)}</ul></div>}
              {course.examSkills.length > 0 && <div><h3 className="eyebrow mb-1">What the exam asks you to do</h3><ul className="list-disc pl-5 text-sm space-y-1">{course.examSkills.map((f) => <li key={f}>{f}</li>)}</ul><p className="text-xs text-muted mt-1">Reconstructed from the course content, not from an official exam brief.</p></div>}
            </div>
          </section>

          <section id="chapters" className="card p-5 scroll-mt-24">
            <h2 className="font-serif text-2xl mb-1">Chapters</h2>
            <p className="text-xs text-muted mb-3">Priority: ESSENTIAL when your documents or the official description support it, IMPORTANT when it is needed to understand them, ADVANCED to go further. Hover a badge for the justification.</p>
            <ol className="flex flex-col divide-y divide-line">
              {chapters.map((c, i) => (
                <li key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <span className="text-muted tabular-nums text-sm w-6 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/courses/${slug}/chapters/${c.slug}`} className="font-medium hover:underline">{c.title}</Link>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1"><Priority p={c.priority} reason={c.priorityReason} /><Status s={c.researchStatus} />{c.provenance.map((p) => <Provenance key={p} p={p} />)}</div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted shrink-0">
                    <span>{c.concepts} concepts · {c.questions} questions</span>
                    <span className={c.read ? 'text-sage-ink font-medium' : c.opened ? '' : ''}>{c.read ? 'Read' : c.opened ? 'Opened' : 'Not opened'}</span>
                    {c.mastery.understood > 0 && <span className="text-sage-ink">{c.mastery.understood} understood</span>}
                    {c.mastery.needsWork > 0 && <span className="text-coral-ink">{c.mastery.needsWork} to rework</span>}
                    {c.researchStatus === 'not_researched' && <form action={requestReconstruction.bind(null, slug, c.slug)}><button className="btn !py-1 !px-2.5 text-xs">Request reconstruction</button></form>}
                  </div>
                </li>
              ))}
            </ol>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium">Add a missing chapter</summary>
              <ActionForm action={addChapter.bind(null, slug)} submit="Add chapter" reset className="flex flex-col gap-3 mt-3">
                <label className="label">Title<input className="input" name="title" required /></label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="label">Priority<select className="input" name="priority" defaultValue="IMPORTANT"><option>ESSENTIAL</option><option>IMPORTANT</option><option>ADVANCED</option></select></label>
                  <label className="label">Justification (required for ESSENTIAL)<input className="input" name="reason" placeholder="e.g. listed in the lecture plan" /></label>
                </div>
              </ActionForm>
            </details>
          </section>
        </div>

        <aside className="flex flex-col gap-4 min-w-0">
          <section className="card p-5">
            <h2 className="font-serif text-xl mb-2">Recommended sequence</h2>
            {sequence.length ? <ol className="list-decimal pl-5 text-sm space-y-1.5">{sequence.map((c) => <li key={c.id}><Link className="hover:underline" href={`/courses/${slug}/chapters/${c.slug}`}>{c.title}</Link> <span className="text-xs text-muted">({c.priority.toLowerCase()})</span></li>)}</ol> : <p className="text-sm text-muted">Every chapter has been read. Test yourself in Revision.</p>}
          </section>
          <section className="card p-5">
            <div className="flex items-center gap-2 mb-2"><h2 className="font-serif text-xl">University material</h2><Provenance p="UNIVERSITY_MATERIAL" /></div>
            {docs.length ? <ul className="text-sm space-y-1">{docs.map((d) => <li key={d.id} className="flex justify-between gap-2"><span className="truncate">{d.filename}</span><span className={`text-xs ${d.status === 'failed' ? 'text-coral-ink' : 'text-muted'}`}>{d.status}</span></li>)}</ul> : <p className="text-sm text-muted">No document uploaded for this course.</p>}
            <Link href={`/courses/${slug}/resources`} className="btn w-full mt-3 text-sm">Upload or view documents</Link>
          </section>
          {course.materials.length > 0 && (
            <section className="card p-5">
              <h2 className="font-serif text-xl mb-2">What your documents changed</h2>
              <p className="text-xs text-muted mb-2">Each document was compared with the reconstructed course and checked against current sources.</p>
              {course.materials.map((m) => (
                <details key={m.key} className="border-t border-line py-2 text-sm">
                  <summary className="cursor-pointer font-medium">{m.filename}</summary>
                  <p className="text-muted mt-1">{m.nature}</p>
                  {m.issues.length > 0 && <ul className="list-disc pl-5 mt-1 space-y-1 text-coral-ink">{m.issues.map((x) => <li key={x}>{x}</li>)}</ul>}
                </details>
              ))}
            </section>
          )}
          {course.uncertainties.length > 0 && (
            <section className="card p-5 bg-butter-soft">
              <h2 className="font-serif text-xl mb-2">Open questions</h2>
              <ul className="list-disc pl-5 text-sm space-y-1.5">{course.uncertainties.map((x) => <li key={x}>{x}</li>)}</ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
