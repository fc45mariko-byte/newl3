'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { checkExercise } from '@/app/actions/revision';

type Part = { id: string; prompt: string; kind: string; options: string[] | null; unit: string | null };
type Ex = { id: string; title: string; type: string; difficulty: number; statement: string; data: { headers: string[]; rows: string[][] } | null; fictional: boolean; parts: Part[] };
type Res = { correct: boolean | null; correction: string[]; mistakes: string[]; answer: any } | { error: string };

function PartView({ exId, p }: { exId: string; p: Part }) {
  const [value, setValue] = useState('');
  const [choice, setChoice] = useState<number | null>(null);
  const [res, setRes] = useState<Res | null>(null);
  const [pending, start] = useTransition();
  const run = (reveal: boolean) => start(async () => setRes(await checkExercise(exId, p.id, reveal ? { reveal } : p.kind === 'choix' ? { choice: choice ?? undefined } : { value })));
  const ok = res && !('error' in res) ? res : null;
  return (
    <li className="flex flex-col gap-2 border-t border-line pt-3">
      <p className="font-medium">{p.prompt}</p>
      {p.kind === 'nombre' && <div className="flex gap-2 items-center"><label className="sr-only" htmlFor={`${exId}-${p.id}`}>Your answer</label><input id={`${exId}-${p.id}`} className="input max-w-48" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />{p.unit && <span className="text-sm text-muted">{p.unit}</span>}<button className="btn btn-primary" disabled={pending || !value} onClick={() => run(false)}>Check</button></div>}
      {p.kind === 'choix' && p.options && <div className="flex flex-col gap-1.5">{p.options.map((o, k) => <label key={k} className="flex gap-2 text-sm items-start"><input type="radio" name={`${exId}-${p.id}`} checked={choice === k} onChange={() => setChoice(k)} className="mt-1 accent-charcoal" />{o}</label>)}<div><button className="btn btn-primary" disabled={pending || choice === null} onClick={() => run(false)}>Check</button></div></div>}
      {(p.kind === 'ecriture' || p.kind === 'libre') && <p className="text-xs text-muted">Write your answer on paper or in your notes, then compare it with the correction.</p>}
      <div><button className="btn text-sm" disabled={pending} onClick={() => run(true)}>{ok ? 'Correction shown' : 'Show the correction'}</button></div>
      {res && 'error' in res && <p role="alert" className="text-sm rounded-xl bg-coral-soft text-coral-ink px-3 py-2">{res.error}</p>}
      {ok && (
        <div className="flex flex-col gap-2 text-sm" role="status">
          {ok.correct !== null && <p className={`rounded-xl px-3 py-2 font-semibold ${ok.correct ? 'bg-sage-soft text-sage-ink' : 'bg-coral-soft text-coral-ink'}`}>{ok.correct ? 'Correct' : `Not yet${ok.answer?.valeur !== undefined ? '' : ''}`}</p>}
          {ok.answer?.type === 'ecriture' && <div className="overflow-x-auto"><table className="text-sm"><thead><tr><th className="border border-line px-2">Account</th><th className="border border-line px-2">Label</th><th className="border border-line px-2">Debit</th><th className="border border-line px-2">Credit</th></tr></thead><tbody>{ok.answer.lignes.map((l: any, k: number) => <tr key={k}><td className="border border-line px-2">{l.compte}</td><td className="border border-line px-2">{l.libelle ?? ''}</td><td className="border border-line px-2 text-right tabular-nums">{l.debit ?? ''}</td><td className="border border-line px-2 text-right tabular-nums">{l.credit ?? ''}</td></tr>)}</tbody></table></div>}
          {ok.answer?.type === 'libre' && <div className="rounded-xl bg-powder-soft px-3 py-2"><b className="block">Model answer</b>{ok.answer.corrige}<ul className="list-disc pl-5 mt-1">{ok.answer.criteres.map((c: string) => <li key={c}>{c}</li>)}</ul></div>}
          <ul className="list-disc pl-5">{ok.correction.map((c) => <li key={c}>{c}</li>)}</ul>
          {ok.mistakes.length > 0 && <div className="rounded-xl bg-coral-soft text-coral-ink px-3 py-2"><b>Common mistakes</b><ul className="list-disc pl-5">{ok.mistakes.map((c) => <li key={c}>{c}</li>)}</ul></div>}
        </div>
      )}
    </li>
  );
}

export function ExerciseCard({ ex, chapter, language }: { ex: Ex; chapter: { title: string; href: string }; language: string }) {
  return (
    <details className="card" lang={language}>
      <summary className="cursor-pointer list-none p-5 flex flex-wrap items-start justify-between gap-2">
        <span><span className="font-serif text-xl block">{ex.title}</span><span className="text-xs text-muted">{chapter.title} · {ex.type} · level {ex.difficulty}{ex.fictional ? ' · fictional figures' : ''}</span></span>
        <span className="text-xs text-muted">{ex.parts.length} question{ex.parts.length > 1 ? 's' : ''}</span>
      </summary>
      <div className="px-5 pb-5 flex flex-col gap-3">
        <p className="whitespace-pre-line">{ex.statement}</p>
        {ex.data && <div className="overflow-x-auto"><table className="text-sm"><thead><tr>{ex.data.headers.map((h) => <th key={h} className="border border-line bg-ivory px-2 py-1 text-left">{h}</th>)}</tr></thead><tbody>{ex.data.rows.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j} className="border border-line px-2 py-1">{c}</td>)}</tr>)}</tbody></table></div>}
        <ol className="flex flex-col gap-3">{ex.parts.map((p) => <PartView key={p.id} exId={ex.id} p={p} />)}</ol>
        <Link className="text-xs underline" href={chapter.href}>Back to the chapter</Link>
      </div>
    </details>
  );
}
