'use client';
// Input for each question type. The value is the response object sent to the server.
import type { PublicQuestion } from '@/lib/quiz';

export type Response = { choice?: string; choices?: string[]; matches?: Record<string, string>; order?: string[]; text?: string; rubricMet?: number[] };

export function AnswerInput({ q, value, onChange, disabled, marks }: {
  q: PublicQuestion; value: Response; onChange: (v: Response) => void; disabled: boolean;
  /** After evaluation: per choice id, 'good' | 'bad' | 'missed'. */
  marks?: Record<string, 'good' | 'bad' | 'missed'>;
}) {
  const name = `q-${q.id}`;
  if (q.type === 'single' || q.type === 'true_false' || q.type === 'multiple') {
    const multi = q.type === 'multiple';
    const picked = multi ? new Set(value.choices ?? []) : new Set(value.choice ? [value.choice] : []);
    return (
      <fieldset className="flex flex-col gap-2" disabled={disabled}>
        <legend className="sr-only">{multi ? 'Tick every correct answer' : 'Choose one answer'}</legend>
        {multi && <p className="text-xs text-muted">Several answers may be correct.</p>}
        {q.choices!.map((c) => {
          const m = marks?.[c.id];
          return (
            <label key={c.id} className={`flex items-start gap-3 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-colors ${m === 'good' ? 'border-sage-ink bg-sage-soft' : m === 'bad' ? 'border-coral bg-coral-soft' : m === 'missed' ? 'border-sage-ink border-dashed' : picked.has(c.id) ? 'border-charcoal bg-ivory' : 'border-line bg-paper hover:border-ink'}`}>
              <input className="mt-1 accent-charcoal" type={multi ? 'checkbox' : 'radio'} name={name} value={c.id} checked={picked.has(c.id)}
                onChange={(e) => {
                  if (!multi) return onChange({ choice: c.id });
                  const next = new Set(picked); e.target.checked ? next.add(c.id) : next.delete(c.id); onChange({ choices: [...next] });
                }} />
              <span className="flex-1">{c.text}</span>
              {m && <span className="text-xs font-semibold">{m === 'good' ? 'Correct' : m === 'bad' ? 'Wrong' : 'Missed'}</span>}
            </label>
          );
        })}
      </fieldset>
    );
  }
  if (q.type === 'matching') {
    const matches = value.matches ?? {};
    return (
      <div className="flex flex-col gap-2">
        {q.left!.map((l, i) => (
          <div key={l} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center">
            <label htmlFor={`${name}-${i}`} className="rounded-xl bg-ivory px-3 py-2">{l}</label>
            <select id={`${name}-${i}`} className="input" disabled={disabled} value={matches[l] ?? ''} onChange={(e) => onChange({ matches: { ...matches, [l]: e.target.value } })}>
              <option value="">Choose…</option>
              {q.right!.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        ))}
      </div>
    );
  }
  if (q.type === 'ordering') {
    const order = value.order ?? q.items!;
    const move = (i: number, d: number) => { const a = order.slice(); [a[i], a[i + d]] = [a[i + d], a[i]]; onChange({ order: a }); };
    return (
      <ol className="flex flex-col gap-2" aria-label="Items to put in order">
        {order.map((it, i) => (
          <li key={it} className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2">
            <span className="tabular-nums text-sm text-muted w-5">{i + 1}</span>
            <span className="flex-1 text-sm">{it}</span>
            <span className="flex gap-1">
              <button type="button" className="btn !p-1.5 text-xs" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label={`Move “${it}” up`}>↑</button>
              <button type="button" className="btn !p-1.5 text-xs" disabled={disabled || i === order.length - 1} onClick={() => move(i, 1)} aria-label={`Move “${it}” down`}>↓</button>
            </span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div>
      <label className="sr-only" htmlFor={name}>Your answer</label>
      <textarea id={name} className="input min-h-36" disabled={disabled} value={value.text ?? ''} onChange={(e) => onChange({ ...value, text: e.target.value })} placeholder="Write your answer in full sentences." />
    </div>
  );
}
