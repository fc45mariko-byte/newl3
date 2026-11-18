import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { feedbackFor, loadAttempt, MODES, toPublic, type QuizMode } from '@/lib/quiz';
import { SCORING_RULES } from '@/lib/scoring';
import { QuizRunner } from '@/components/quiz/QuizRunner';
import { QuizResults } from '@/components/quiz/QuizResults';

export const metadata = { title: 'Quiz' };

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const u = await requireUser();
  const data = await loadAttempt(u.id, id);
  if (!data) notFound();
  const { attempt, questions, answers } = data;
  const mode = attempt.mode as QuizMode;
  const exam = mode === 'exam';
  const ansBy = new Map(answers.map((a) => [a.questionId, a]));
  const items = questions.map((x) => {
    const a = ansBy.get(x.q.id);
    const pub = toPublic(x.q, { title: x.chTitle, slug: x.chSlug, courseSlug: x.courseSlug, language: x.language }, attempt.id);
    const reveal = attempt.finishedAt || (!exam && a);
    return {
      question: pub, concept: x.conceptSlug ? { slug: x.conceptSlug, term: x.conceptTerm! } : null, rule: SCORING_RULES[pub.type],
      answer: a ? { response: a.response, score: a.score, correct: a.correct, evaluation: a.evaluation } : null,
      feedback: reveal ? feedbackFor(x.q) : null,
    };
  });
  const header = (
    <header className="flex flex-col gap-1 mb-5">
      <Link href="/revision" className="text-sm text-muted hover:text-ink w-max">← Revision</Link>
      <p className="eyebrow">{MODES[mode].label}</p>
      <h1 className="font-serif text-3xl sm:text-4xl">{questions[0]?.chTitle && (mode === 'chapter') ? questions[0].chTitle : MODES[mode].label}</h1>
      <p className="text-sm text-muted">{MODES[mode].help}</p>
    </header>
  );
  if (attempt.finishedAt) {
    return <div className="max-w-4xl">{header}<QuizResults attemptId={attempt.id} score={attempt.score ?? 0} max={attempt.maxScore ?? questions.length} items={items} /></div>;
  }
  return (
    <div className="max-w-4xl">
      {header}
      <QuizRunner attemptId={attempt.id} exam={exam} deadline={attempt.timeLimitSec ? attempt.startedAt.getTime() + attempt.timeLimitSec * 1000 : null} items={items} />
    </div>
  );
}
