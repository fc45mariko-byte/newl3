'use client';
import { useState, useTransition } from 'react';
import { reviewCard } from '@/app/actions/revision';

type Card = { id: string; front: string; back: string; kind: string; extra: { mustInclude?: string[]; mistakes?: string[] }; chapter: string; course: string; language: string; isNew: boolean };
const GRADES: [ 'again' | 'hard' | 'good' | 'easy', string, string][] = [['again', 'Again', 'I did not know'], ['hard', 'Hard', 'With difficulty'], ['good', 'Good', 'I knew it'], ['easy', 'Easy', 'Immediately']];

export function FlashcardSession({ cards }: { cards: Card[] }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState<{ again: number; total: number }>({ again: 0, total: 0 });
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!cards.length) return <div className="card p-8 text-center text-muted">No card is due. Come back later, or choose another course.</div>;
  if (i >= cards.length) return (
    <div className="card p-8 text-center flex flex-col gap-2"><p className="font-serif text-3xl">Session complete</p>
      <p className="text-muted">{done.total} card{done.total > 1 ? 's' : ''} reviewed, {done.again} to see again soon.</p></div>
  );
  const c = cards[i];
  const grade = (g: 'again' | 'hard' | 'good' | 'easy') => start(async () => {
    setError(null);
    const r = await reviewCard(c.id, g);
    if ('error' in r && r.error) return setError(r.error);
    if ('intervalDays' in r) setNext(r.intervalDays ? `Next review in ${r.intervalDays} day${r.intervalDays > 1 ? 's' : ''}.` : 'You will see it again in a few minutes.');
    setDone((d) => ({ again: d.again + (g === 'again' ? 1 : 0), total: d.total + 1 }));
    setShown(false); setI(i + 1);
  });
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">Card {i + 1} of {cards.length} · {c.course} · {c.chapter}{c.isNew ? ' · new' : ''}{next ? ` · ${next}` : ''}</p>
      <section className="card p-6 sm:p-8 min-h-64 flex flex-col gap-4" lang={c.language} aria-live="polite">
        <p className="eyebrow">{c.kind === 'vocabulary' ? 'Vocabulary' : 'Question'}</p>
        <p className="font-serif text-2xl leading-snug">{c.front}</p>
        {shown && (
          <div className="border-t border-line pt-4 flex flex-col gap-3">
            <p className="whitespace-pre-line">{c.back}</p>
            {c.extra.mustInclude?.length ? <div className="text-sm"><b>Your answer must include</b><ul className="list-disc pl-5">{c.extra.mustInclude.map((x) => <li key={x}>{x}</li>)}</ul></div> : null}
            {c.extra.mistakes?.length ? <div className="text-sm rounded-xl bg-coral-soft text-coral-ink px-3 py-2"><b>Common mistakes</b><ul className="list-disc pl-5">{c.extra.mistakes.map((x) => <li key={x}>{x}</li>)}</ul></div> : null}
          </div>
        )}
      </section>
      {error && <p role="alert" className="text-sm rounded-xl bg-coral-soft text-coral-ink px-3 py-2">{error}</p>}
      {!shown ? <button className="btn btn-primary self-start" onClick={() => setShown(true)}>Show the answer</button> : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {GRADES.map(([g, t, h]) => <button key={g} className={`btn flex-col !py-2 ${g === 'again' ? '!border-coral' : g === 'good' ? '!border-sage-ink' : ''}`} disabled={pending} onClick={() => grade(g)}><b>{t}</b><span className="text-[11px] text-muted">{h}</span></button>)}
        </div>
      )}
    </div>
  );
}
