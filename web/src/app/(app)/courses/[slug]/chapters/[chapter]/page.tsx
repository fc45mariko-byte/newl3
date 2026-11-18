import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { chapterPage } from '@/lib/course-data';
import { Markdown } from '@/components/Markdown';
import { ConceptCard } from '@/components/ConceptCard';
import { Diagram } from '@/components/Diagram';
import { DIAGRAMS_BY_CHAPTER } from '@/lib/diagrams';
import { Priority, Provenance, Status } from '@/components/badges';
import { OpenTracker, ReadButton } from '@/components/ChapterProgress';
import { QuickNote } from '@/components/QuickNote';
import { IconBack } from '@/components/icons';

const ARCH = ['opening', 'big_picture', 'explanation', 'key_concepts', 'comparison', 'visual', 'application', 'synthesis', 'exam', 'further'] as const;
const T = {
  fr: { opening: 'Ouverture', big_picture: 'Vue d’ensemble', explanation: 'Explication', key_concepts: 'Notions clés', comparison: 'Comprendre par comparaison', visual: 'Comprendre par l’image', application: 'Application', synthesis: 'Synthèse', exam: 'Préparation à l’examen', further: 'Pour aller plus loin',
    missing: 'Parties pas encore rédigées pour ce chapitre', missingHelp: 'Elles ne sont pas inventées : demandez une reconstruction ou interrogez le compagnon, qui signalera ce qui ne vient pas de votre cours.', practice: 'S’entraîner sur ce chapitre', quiz: 'Quiz du chapitre', cards: 'Cartes mémoire', ex: 'Exercices', sources: 'Sources', mark: 'Marquer comme lu', done: 'Lu', prev: 'Chapitre précédent', next: 'Chapitre suivant', prereq: 'À maîtriser avant', notes: 'Mes notes sur ce chapitre', docs: 'Vos documents pour ce cours' },
  en: { opening: 'Opening', big_picture: 'The big picture', explanation: 'Explanation', key_concepts: 'Key concepts', comparison: 'Understanding through comparison', visual: 'Visual understanding', application: 'Application', synthesis: 'Synthesis', exam: 'Exam preparation', further: 'Further exploration',
    missing: 'Parts not yet written for this chapter', missingHelp: 'Nothing is invented: request a reconstruction or ask the companion, which flags what does not come from your course.', practice: 'Practise this chapter', quiz: 'Chapter quiz', cards: 'Flashcards', ex: 'Exercises', sources: 'Sources', mark: 'Mark as read', done: 'Read', prev: 'Previous chapter', next: 'Next chapter', prereq: 'Master first', notes: 'My notes on this chapter', docs: 'Your documents for this course' },
  es: { opening: 'Apertura', big_picture: 'Visión de conjunto', explanation: 'Explicación', key_concepts: 'Nociones clave', comparison: 'Comprender comparando', visual: 'Comprender con imágenes', application: 'Aplicación', synthesis: 'Síntesis', exam: 'Preparación del examen', further: 'Para ir más lejos',
    missing: 'Partes aún no redactadas', missingHelp: 'No se inventa nada: solicite una reconstrucción o pregunte al compañero, que indicará lo que no procede de su curso.', practice: 'Practicar este capítulo', quiz: 'Cuestionario', cards: 'Tarjetas', ex: 'Ejercicios', sources: 'Fuentes', mark: 'Marcar como leído', done: 'Leído', prev: 'Capítulo anterior', next: 'Capítulo siguiente', prereq: 'Dominar antes', notes: 'Mis notas', docs: 'Sus documentos de este curso' },
};

export async function generateMetadata({ params }: { params: Promise<{ chapter: string }> }) { return { title: decodeURIComponent((await params).chapter) }; }

export default async function ChapterPage({ params }: { params: Promise<{ slug: string; chapter: string }> }) {
  const { slug, chapter: chSlug } = await params;
  const u = await requireUser();
  const d = await chapterPage(u.id, slug, decodeURIComponent(chSlug));
  const lang = d.course.language as 'fr' | 'en' | 'es';
  const t = T[lang];
  const idx = d.chapters.findIndex((c) => c.id === d.chapter.id);
  const prev = d.chapters[idx - 1], next = d.chapters[idx + 1];
  const byKind = new Map<string, typeof d.sections>();
  for (const s of d.sections) { if (!byKind.has(s.kind)) byKind.set(s.kind, []); byKind.get(s.kind)!.push(s); }
  const autoVisuals = DIAGRAMS_BY_CHAPTER[d.chapter.slug] ?? [];
  const present = (k: string) => byKind.has(k) || (k === 'key_concepts' && d.concepts.length > 0) || (k === 'visual' && autoVisuals.length > 0) || (k === 'further' && d.sources.length > 0);
  const missing = ARCH.filter((k) => !present(k));
  const sourceByKey = new Map(d.sources.map((x) => [x.key, x]));
  const read = !!d.progress?.readAt;

  return (
    <div className="grid gap-6 xl:grid-cols-[230px_minmax(0,1fr)_300px]">
      <OpenTracker course={slug} chapter={d.chapter.slug} />
      <nav aria-label="Chapters" className="hidden xl:block">
        <div className="sticky top-5 card p-3 max-h-[calc(100dvh-40px)] overflow-y-auto">
          <Link href={`/courses/${slug}`} className="text-sm text-muted inline-flex items-center gap-1 hover:text-ink px-2 py-1"><IconBack width={16} height={16} />{d.course.title}</Link>
          <ol className="mt-2 flex flex-col gap-0.5">
            {d.chapters.map((c, i) => (
              <li key={c.id}><Link href={`/courses/${slug}/chapters/${c.slug}`} aria-current={c.id === d.chapter.id ? 'page' : undefined}
                className={`grid grid-cols-[22px_1fr] gap-1 rounded-lg px-2 py-1.5 text-[13.5px] leading-snug ${c.id === d.chapter.id ? 'bg-rose-soft font-semibold' : 'hover:bg-ivory'}`}><span className="text-muted tabular-nums text-xs pt-0.5">{String(i + 1).padStart(2, '0')}</span>{c.title}</Link></li>
            ))}
          </ol>
        </div>
      </nav>

      <article className="min-w-0 flex flex-col gap-8" lang={lang}>
        <header className="flex flex-col gap-3">
          <Link href={`/courses/${slug}`} className="xl:hidden text-sm text-muted inline-flex items-center gap-1"><IconBack width={16} height={16} />{d.course.title}</Link>
          <p className="eyebrow">{d.course.title} · {String(idx + 1).padStart(2, '0')} / {d.chapters.length}</p>
          <h1 className="font-serif text-4xl sm:text-5xl leading-tight">{d.chapter.title}</h1>
          {d.chapter.summary && <p className="font-serif italic text-xl text-muted max-w-3xl">{d.chapter.summary}</p>}
          <div className="flex flex-wrap items-center gap-2"><Priority p={d.chapter.priority} reason={d.chapter.priorityReason} /><Status s={d.chapter.researchStatus} />{d.chapter.provenance.map((p) => <Provenance key={p} p={p} />)}</div>
          {d.chapter.priorityReason && <p className="text-xs text-muted">{d.chapter.priorityReason}</p>}
          {d.chapter.note && <p className="text-sm rounded-xl bg-butter-soft px-3 py-2">{d.chapter.note}</p>}
          {d.prereq.length > 0 && <p className="text-sm">{t.prereq} : {d.prereq.map((p, i) => <span key={p.slug}>{i ? ' · ' : ''}<Link className="underline" href={`/courses/${p.courseSlug}/chapters/${p.slug}`}>{p.title}</Link> <span className="text-muted">({p.courseTitle})</span></span>)}</p>}
        </header>

        {ARCH.map((kind, n) => {
          if (!present(kind)) return null;
          const secs = byKind.get(kind) ?? [];
          return (
            <section key={kind} aria-labelledby={`s-${kind}`} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline gap-3 border-t border-line pt-5">
                <span className="text-sm text-muted tabular-nums">{String(n + 1).padStart(2, '0')}</span>
                <h2 id={`s-${kind}`} className="font-serif text-3xl">{secs[0]?.title && kind !== 'key_concepts' ? secs[0].title : t[kind]}</h2>
              </div>
              {secs.map((s, i) => (
                <div key={s.id} className="flex flex-col gap-2">
                  {i > 0 && <h3 className="font-serif text-2xl">{s.title}</h3>}
                  <div className="flex flex-wrap gap-1.5"><Provenance p={s.provenance} />{s.sourceKeys.map((k) => sourceByKey.get(k)).filter(Boolean).map((src) => <a key={src!.key} href={`#src-${src!.key}`} className="chip bg-ivory border border-line hover:border-ink">{src!.author.split(',')[0]}</a>)}</div>
                  <Markdown text={s.body} />
                </div>
              ))}
              {kind === 'key_concepts' && <div className="flex flex-col gap-2.5">{d.concepts.map((c) => <ConceptCard key={c.id} c={c as any} lang={lang} links={d.links.filter((l) => l.fromId === c.id)} />)}</div>}
              {kind === 'visual' && !secs.length && autoVisuals.map(([name, arg]) => <Diagram key={name} name={name} arg={arg} />)}
              {kind === 'further' && d.sources.length > 0 && (
                <div>
                  <h3 className="eyebrow mb-2">{t.sources}</h3>
                  <ul className="flex flex-col gap-2 text-sm">
                    {d.sources.map((src) => (
                      <li key={src.key} id={`src-${src.key}`} className="rounded-xl border border-line bg-paper px-3 py-2 scroll-mt-24">
                        <b>{src.url ? <a className="underline" href={src.url} target="_blank" rel="noopener noreferrer">{src.title}</a> : src.title}</b>
                        <span className="text-muted"> — {src.author}{src.publishedOn ? `, ${src.publishedOn}` : ''}</span>
                        <span className="block text-xs text-muted">{src.tier} · {src.type ?? 'type not recorded'} · {src.access === 'read' ? 'read' : src.access === 'excerpt' ? 'excerpt only' : 'cited, not opened'}</span>
                        {src.relevance && <span className="block text-xs mt-0.5">{src.relevance}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })}

        {missing.length > 0 && (
          <section className="rounded-2xl border border-dashed border-line p-4 text-sm">
            <p className="font-medium">{t.missing} : {missing.map((k) => t[k]).join(', ')}.</p>
            <p className="text-muted mt-1">{t.missingHelp}</p>
          </section>
        )}

        <footer className="flex flex-wrap justify-between gap-3 border-t border-line pt-5">
          {prev ? <Link className="btn" href={`/courses/${slug}/chapters/${prev.slug}`}>← {prev.title}</Link> : <span />}
          <ReadButton course={slug} chapter={d.chapter.slug} read={read} labels={{ mark: t.mark, done: t.done }} />
          {next ? <Link className="btn" href={`/courses/${slug}/chapters/${next.slug}`}>{next.title} →</Link> : <span />}
        </footer>
      </article>

      <aside className="flex flex-col gap-4 min-w-0">
        <section className="card p-4">
          <h2 className="font-serif text-xl mb-3">{t.practice}</h2>
          <div className="flex flex-col gap-2">
            <Link className="btn btn-primary justify-between" href={`/revision/start?mode=chapter&chapter=${d.chapter.id}`}>{t.quiz}<span className="text-xs opacity-70">{d.counts.questions}</span></Link>
            <Link className="btn justify-between" href={`/revision/flashcards?chapter=${d.chapter.id}`}>{t.cards}<span className="text-xs text-muted">{d.counts.flashcards}</span></Link>
            <Link className="btn justify-between" href={`/revision/exercises?chapter=${d.chapter.id}`}>{t.ex}<span className="text-xs text-muted">{d.counts.exercises}</span></Link>
          </div>
          <p className="text-xs text-muted mt-3">{[...d.mastery.values()].filter((m) => m.status === 'understood' || m.status === 'retained').length} / {d.concepts.length} concepts shown as understood by your answers.</p>
        </section>
        <section className="card p-4">
          <h2 className="font-serif text-xl mb-2">{t.notes}</h2>
          <QuickNote courseSlug={slug} chapterId={d.chapter.id} />
          <ul className="mt-3 flex flex-col gap-2">
            {d.notes.map((n) => <li key={n.id} className="rounded-xl bg-ivory px-3 py-2 text-sm"><b className="block">{n.title}</b><span className="whitespace-pre-wrap">{n.body.slice(0, 280)}</span></li>)}
          </ul>
          <Link href={`/courses/${slug}/notes`} className="text-xs underline mt-2 inline-block">All notes for this course</Link>
        </section>
        {d.docs.length > 0 && (
          <section className="card p-4">
            <h2 className="font-serif text-xl mb-2">{t.docs}</h2>
            <ul className="text-sm space-y-1">{d.docs.map((x) => <li key={x.id}><Link className="hover:underline break-all" href={`/documents/${x.id}`}>{x.filename}</Link></li>)}</ul>
          </section>
        )}
      </aside>
    </div>
  );
}
