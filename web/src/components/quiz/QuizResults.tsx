'use client';
import Link from 'next/link';
import { useTransition } from 'react';
import { restartQuiz, selfAssess } from '@/app/actions/quiz';
import { AnswerInput } from './AnswerInput';
import { Feedback, marksFor } from './Feedback';

type Item = { question: any; concept: { slug: string; term: string } | null; answer: { response: any; score: number; correct: boolean; evaluation: string } | null; feedback: any };

export function QuizResults({ attemptId, score, max, items }: { attemptId: string; score: number; max: number; items: Item[] }) {
  const [pending, start] = useTransition();
  const pct = max ? Math.round((score / max) * 100) : 0;
  const pendingReview = items.filter((x) => x.answer?.evaluation === 'needs_review').length;
  const wrongConcepts = [...new Map(items.filter((x) => x.concept && (!x.answer || !x.answer.correct)).map((x) => [x.concept!.slug, x.concept!])).values()];
  return (
    <div className="flex flex-col gap-5">
      <section className="card p-5 flex flex-wrap items-center gap-6">
        <div><p className="font-serif text-6xl tabular-nums">{pct}%</p><p className="text-sm text-muted">{score} / {max} points</p></div>
        <div className="flex-1 min-w-[200px] text-sm flex flex-col gap-1">
          <p>{items.filter((x) => x.answer?.correct).length} correct · {items.filter((x) => x.answer && !x.answer.correct && x.answer.evaluation !== 'needs_review').length} wrong or partial · {items.filter((x) => !x.answer).length} unanswered</p>
          {pendingReview > 0 && <p className="text-[#6b5410]">{pendingReview} written answer{pendingReview > 1 ? 's' : ''} still to self-assess below: they count 0 until you do.</p>}
          <p className="text-muted text-xs">A score measures this attempt. Mastery is judged over several attempts and over time.</p>
        </div>
        <div className="flex gap-2"><button className="btn btn-primary" disabled={pending} onClick={() => start(() => restartQuiz(attemptId))}>{pending ? 'Starting…' : 'Restart this quiz'}</button><Link className="btn" href="/revision">Revision</Link></div>
      </section>
      {wrongConcepts.length > 0 && (
        <section className="card p-5"><h2 className="font-serif text-xl mb-2">Concepts to revisit</h2>
          <div className="flex flex-wrap gap-1.5">{wrongConcepts.map((c) => <Link key={c.slug} href={`/knowledge/${encodeURIComponent(c.slug)}`} className="chip bg-coral-soft text-coral-ink">{c.term}</Link>)}</div></section>
      )}
      <ol className="flex flex-col gap-4">
        {items.map((x, i) => (
          <li key={x.question.id} className="card p-5">
            <p className="eyebrow mb-1">Question {i + 1} · {x.question.chapter.title}</p>
            <p className="mb-3 whitespace-pre-line">{x.question.stem}</p>
            {x.answer ? (<>
              <AnswerInput q={x.question} value={x.answer.response ?? {}} onChange={() => undefined} disabled marks={marksFor(x.feedback, x.answer.response)} />
              <Feedback fb={x.feedback} result={x.answer} response={x.answer.response} concept={x.concept} chapter={x.question.chapter} selfAssessPending={pending}
                onSelfAssess={x.answer.evaluation === 'needs_review' ? (met) => start(() => selfAssess(attemptId, x.question.id, met)) : undefined} />
            </>) : (<>
              <p className="rounded-xl bg-coral-soft text-coral-ink px-3 py-2 text-sm">Not answered.</p>
              <Feedback fb={x.feedback} result={{ score: 0, correct: false, evaluation: 'auto' }} response={null} concept={x.concept} chapter={x.question.chapter} />
            </>)}
          </li>
        ))}
      </ol>
    </div>
  );
}
