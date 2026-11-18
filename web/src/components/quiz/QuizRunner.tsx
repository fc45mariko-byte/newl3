'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { PublicQuestion } from '@/lib/quiz';
import { finishQuiz, submitAnswer } from '@/app/actions/quiz';
import { AnswerInput, type Response } from './AnswerInput';
import { Feedback, marksFor } from './Feedback';

type Item = {
  question: PublicQuestion; concept: { slug: string; term: string } | null; rule: string;
  answer: { response: unknown; score: number; correct: boolean; evaluation: string } | null;
  feedback: any;
};
const TYPE: Record<string, string> = { single: 'One answer', multiple: 'Several answers', true_false: 'True or false', matching: 'Matching', ordering: 'Ordering', short: 'Short answer', scenario: 'Case question' };

function Clock({ deadline, onEnd }: { deadline: number; onEnd: () => void }) {
  const [left, setLeft] = useState(() => deadline - Date.now());
  const ended = useRef(false);
  useEffect(() => {
    const t = setInterval(() => {
      const l = deadline - Date.now(); setLeft(l);
      if (l <= 0 && !ended.current) { ended.current = true; onEnd(); }
    }, 1000);
    return () => clearInterval(t);
  }, [deadline, onEnd]);
  const s = Math.max(0, Math.floor(left / 1000));
  return <span className={`chip tabular-nums !text-sm ${s < 120 ? 'bg-coral-soft text-coral-ink' : 'bg-ivory border border-line'}`} aria-live="polite">⏱ {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</span>;
}

export function QuizRunner({ attemptId, exam, deadline, items }: { attemptId: string; exam: boolean; deadline: number | null; items: Item[] }) {
  const [i, setI] = useState(() => Math.max(0, items.findIndex((x) => !x.answer)));
  const [drafts, setDrafts] = useState<Record<string, Response>>(() => Object.fromEntries(items.map((x) => [x.question.id, (x.answer?.response as Response) ?? {}])));
  const [results, setResults] = useState<Record<string, { score: number; correct: boolean; evaluation: string; feedback: any; response: any }>>(() =>
    Object.fromEntries(items.filter((x) => x.answer && x.feedback).map((x) => [x.question.id, { ...x.answer!, feedback: x.feedback, response: x.answer!.response }])));
  const [saved, setSaved] = useState<Record<string, boolean>>(() => Object.fromEntries(items.filter((x) => x.answer).map((x) => [x.question.id, true])));
  const [error, setError] = useState<string | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [pending, start] = useTransition();
  const item = items[i];
  const q = item.question;
  const res = results[q.id];
  const locked = !exam && !!res && res.evaluation !== 'needs_review';
  const answeredCount = items.filter((x) => (exam ? saved[x.question.id] : results[x.question.id])).length;

  const send = (response: Response) => start(async () => {
    setError(null);
    const r = await submitAnswer(attemptId, q.id, response);
    if (r.status === 'error') return setError(r.message);
    if (r.status === 'saved') { setSaved((s) => ({ ...s, [q.id]: true })); return; }
    setResults((x) => ({ ...x, [q.id]: { score: r.score, correct: r.correct, evaluation: r.evaluation, feedback: r.feedback, response: r.response } }));
    setSaved((s) => ({ ...s, [q.id]: true }));
  });
  const finish = () => start(async () => { await finishQuiz(attemptId); });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Questions" className="flex flex-wrap gap-1.5">
          {items.map((x, k) => {
            const r = results[x.question.id];
            const cls = k === i ? 'bg-charcoal text-paper border-charcoal' : r ? (r.evaluation === 'needs_review' ? 'bg-butter-soft' : r.correct ? 'bg-sage-soft' : 'bg-coral-soft') : saved[x.question.id] ? 'bg-powder-soft' : 'bg-paper';
            return <button key={x.question.id} onClick={() => { setI(k); setError(null); }} aria-current={k === i ? 'step' : undefined} aria-label={`Question ${k + 1}${r ? (r.correct ? ', correct' : ', answered') : saved[x.question.id] ? ', saved' : ''}`} className={`h-8 w-8 rounded-lg border border-line text-sm tabular-nums ${cls}`}>{k + 1}</button>;
          })}
        </nav>
        <div className="flex items-center gap-2">
          {deadline && <Clock deadline={deadline} onEnd={finish} />}
          <span className="text-sm text-muted">{answeredCount}/{items.length} answered</span>
        </div>
      </div>

      <section className="card p-5 sm:p-6" aria-labelledby="q-stem" lang={q.chapter.language}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted mb-2">
          <span className="chip bg-ivory border border-line">{TYPE[q.type]}</span><span>Difficulty {q.difficulty}/3</span>{q.topic && <span>· {q.topic}</span>}<span>· {q.chapter.title}</span>
        </div>
        <h2 id="q-stem" className="font-serif text-2xl leading-snug mb-1">Question {i + 1}</h2>
        <p className="text-[1.05rem] mb-3 whitespace-pre-line">{q.stem}</p>
        {q.support?.texte && <blockquote className="rounded-xl bg-ivory px-3 py-2 text-sm mb-3">{q.support.texte}</blockquote>}
        {q.support?.entetes && <div className="overflow-x-auto mb-3"><table className="text-sm"><thead><tr>{q.support.entetes.map((h: string) => <th key={h} className="border border-line bg-ivory px-2 py-1">{h}</th>)}</tr></thead><tbody>{q.support.lignes.map((r: string[], k: number) => <tr key={k}>{r.map((c, j) => <td key={j} className="border border-line px-2 py-1">{c}</td>)}</tr>)}</tbody></table></div>}
        <AnswerInput q={q} value={drafts[q.id] ?? {}} disabled={locked || pending || (!!res && res.evaluation === 'needs_review')} marks={!exam && res ? marksFor(res.feedback, res.response) : undefined}
          onChange={(v) => { setDrafts((d) => ({ ...d, [q.id]: v })); if (exam) setSaved((s) => ({ ...s, [q.id]: false })); }} />
        <details className="mt-3 text-xs text-muted"><summary className="cursor-pointer">How this question is scored</summary><p className="mt-1">{item.rule}</p></details>
        {error && <p role="alert" className="mt-3 text-sm rounded-xl bg-coral-soft text-coral-ink px-3 py-2">{error}</p>}
        {!exam && res && (
          <Feedback fb={res.feedback} result={res} response={res.response} concept={item.concept} chapter={q.chapter} selfAssessPending={pending}
            onSelfAssess={res.evaluation === 'needs_review' ? (met) => send({ ...(drafts[q.id] ?? {}), rubricMet: met }) : undefined} />
        )}
        <div className="flex flex-wrap gap-2 mt-5">
          {exam ? (
            <button className="btn btn-primary" disabled={pending} onClick={() => send(drafts[q.id] ?? {})}>{pending ? 'Saving…' : saved[q.id] ? 'Saved ✓ — save again' : 'Save answer'}</button>
          ) : !res ? (
            <button className="btn btn-primary" disabled={pending} onClick={() => send(drafts[q.id] ?? {})}>{pending ? 'Checking…' : q.type === 'short' || q.type === 'scenario' ? 'Submit my answer' : 'Check answer'}</button>
          ) : null}
          {i > 0 && <button className="btn" onClick={() => { setI(i - 1); setError(null); }}>Previous</button>}
          {i < items.length - 1 && <button className="btn" onClick={() => { setI(i + 1); setError(null); }}>Next question</button>}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {exam && <p className="text-xs text-muted">Answers can be changed until you hand in. Feedback is shown at the end.</p>}
        {confirmFinish ? (
          <div className="flex flex-wrap items-center gap-2 ml-auto text-sm">
            {answeredCount < items.length && <span>{items.length - answeredCount} question{items.length - answeredCount > 1 ? 's' : ''} without an answer will count 0.</span>}
            <button className="btn btn-primary" disabled={pending} onClick={finish}>{pending ? 'Finishing…' : exam ? 'Hand in' : 'See my results'}</button>
            <button className="btn" onClick={() => setConfirmFinish(false)}>Keep working</button>
          </div>
        ) : <button className="btn ml-auto" onClick={() => setConfirmFinish(true)}>{exam ? 'Hand in the exam' : 'Finish quiz'}</button>}
      </div>
    </div>
  );
}
