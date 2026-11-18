'use client';
import Link from 'next/link';

type FB = { explanation: string | null; choices: { id: string; text: string; correct: boolean; explanation: string }[] | null; pairs: { left: string; right: string }[] | null; items: string[] | null; rubric: string[] | null; modelAnswer: string | null };

export function marksFor(fb: FB | null, response: any): Record<string, 'good' | 'bad' | 'missed'> | undefined {
  if (!fb?.choices) return undefined;
  const picked = new Set(response?.choices ?? (response?.choice ? [response.choice] : []));
  const m: Record<string, 'good' | 'bad' | 'missed'> = {};
  for (const c of fb.choices) { if (picked.has(c.id)) m[c.id] = c.correct ? 'good' : 'bad'; else if (c.correct) m[c.id] = 'missed'; }
  return m;
}

export function Feedback({ fb, result, response, concept, chapter, onSelfAssess, selfAssessPending }: {
  fb: FB; result: { score: number; correct: boolean; evaluation: string }; response: any;
  concept: { slug: string; term: string } | null; chapter: { title: string; slug: string; courseSlug: string };
  onSelfAssess?: (met: number[]) => void; selfAssessPending?: boolean;
}) {
  const verdict = result.evaluation === 'needs_review' ? { t: 'Compare with the model answer', cls: 'bg-butter-soft' }
    : result.correct ? { t: 'Correct', cls: 'bg-sage-soft text-sage-ink' } : result.score > 0 ? { t: `Partly correct · ${Math.round(result.score * 100)} %`, cls: 'bg-butter-soft' } : { t: 'Incorrect', cls: 'bg-coral-soft text-coral-ink' };
  const picked = new Set(response?.choices ?? (response?.choice ? [response.choice] : []));
  return (
    <div className="flex flex-col gap-3 mt-4" role="status">
      <p className={`rounded-xl px-3 py-2 font-semibold ${verdict.cls}`}>{verdict.t}{result.evaluation === 'self_assessed' ? ' (self-assessed)' : ''}</p>
      {fb.choices && (
        <ul className="flex flex-col gap-2 text-sm">
          {fb.choices.filter((c) => c.correct || picked.has(c.id)).map((c) => (
            <li key={c.id} className="rounded-xl bg-ivory px-3 py-2"><b>{c.correct ? 'Right answer' : 'Your choice'} — {c.text}</b><br />{c.explanation}</li>
          ))}
        </ul>
      )}
      {fb.pairs && (
        <ul className="text-sm flex flex-col gap-1">{fb.pairs.map((p) => {
          const ok = response?.matches?.[p.left] === p.right;
          return <li key={p.left} className={`rounded-lg px-3 py-1.5 ${ok ? 'bg-sage-soft' : 'bg-coral-soft'}`}>{p.left} → <b>{p.right}</b>{!ok && response?.matches?.[p.left] ? <span className="text-coral-ink"> (you chose {response.matches[p.left]})</span> : null}</li>;
        })}</ul>
      )}
      {fb.items && (
        <ol className="text-sm flex flex-col gap-1">{fb.items.map((it, i) => {
          const ok = response?.order?.[i] === it;
          return <li key={it} className={`rounded-lg px-3 py-1.5 ${ok ? 'bg-sage-soft' : 'bg-coral-soft'}`}><b className="tabular-nums">{i + 1}.</b> {it}</li>;
        })}</ol>
      )}
      {fb.modelAnswer && (
        <div className="rounded-xl bg-powder-soft px-3 py-2 text-sm"><b className="block mb-1">Model answer</b>{fb.modelAnswer}</div>
      )}
      {fb.rubric && (
        <RubricForm rubric={fb.rubric} met={response?.rubricMet} disabled={result.evaluation === 'self_assessed' && !onSelfAssess} onSubmit={onSelfAssess} pending={selfAssessPending} />
      )}
      {fb.explanation && <p className="text-sm whitespace-pre-line"><b>Why: </b>{fb.explanation}</p>}
      <p className="text-xs text-muted">
        {concept && <>Concept: <Link className="underline" href={`/knowledge/${encodeURIComponent(concept.slug)}`}>{concept.term}</Link> · </>}
        Chapter: <Link className="underline" href={`/courses/${chapter.courseSlug}/chapters/${chapter.slug}`}>{chapter.title}</Link>
      </p>
    </div>
  );
}

function RubricForm({ rubric, met, disabled, onSubmit, pending }: { rubric: string[]; met?: number[]; disabled: boolean; onSubmit?: (m: number[]) => void; pending?: boolean }) {
  return (
    <form className="rounded-xl border border-line px-3 py-2 text-sm flex flex-col gap-1.5" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); onSubmit?.(f.getAll('met').map(Number)); }}>
      <b>Marking criteria — tick those your answer meets</b>
      {rubric.map((r, i) => (
        <label key={i} className="flex gap-2 items-start"><input type="checkbox" name="met" value={i} defaultChecked={met?.includes(i)} disabled={disabled || !onSubmit} className="mt-1 accent-charcoal" />{r}</label>
      ))}
      {onSubmit && <div><button className="btn btn-primary !py-1.5 text-sm mt-1" disabled={pending}>{pending ? 'Saving…' : 'Record my self-assessment'}</button></div>}
      <p className="text-xs text-muted">This is not an automatic mark: written answers need human judgement, here yours.</p>
    </form>
  );
}
