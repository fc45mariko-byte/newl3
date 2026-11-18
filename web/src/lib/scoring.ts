// Question evaluation. Pure functions: the same rules run on the server when an answer is saved
// and in the unit tests.

export type Choice = { id: string; text: string; correct: boolean; explanation: string };
export type QuestionData =
  | { choices: Choice[] } // single, multiple, true_false
  | { pairs: { left: string; right: string }[] } // matching
  | { items: string[] } // ordering: items in the correct order
  | { rubric: string[]; modelAnswer: string; accepted?: string[] }; // short, scenario

export type QuestionType = 'single' | 'multiple' | 'true_false' | 'matching' | 'ordering' | 'short' | 'scenario';

export type Evaluation = {
  score: number; // 0..1
  correct: boolean;
  evaluation: 'auto' | 'needs_review' | 'self_assessed';
  /** Per-part detail the interface uses to explain the result. */
  detail: Record<string, unknown>;
};

/** Scoring rules shown to the student next to each question type. */
export const SCORING_RULES: Record<QuestionType, string> = {
  single: 'One correct answer: 1 point if it is selected, 0 otherwise.',
  true_false: 'One correct answer: 1 point if it is selected, 0 otherwise.',
  multiple:
    'Several correct answers. Each correct option ticked earns its share of the point; each wrong option ticked removes the same share. The score never goes below 0. The answer counts as correct only when exactly the right options are ticked.',
  matching: 'Each correctly matched pair earns its share of the point. Correct only when every pair is right.',
  ordering: 'Each item in its correct position earns its share of the point. Correct only when the whole order is right.',
  short:
    'Written answer. When the question lists accepted answers, an exact match (ignoring case, accents and punctuation) is graded automatically. Otherwise you compare your answer with the model answer and tick the rubric criteria you met: your score is the share of criteria met.',
  scenario:
    'Case question graded with a rubric: compare your answer with the model answer and tick the criteria you met. Your score is the share of criteria met.',
};

export function normalise(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export class InvalidAnswerError extends Error {}

export function evaluate(type: QuestionType, data: QuestionData, response: unknown): Evaluation {
  switch (type) {
    case 'single':
    case 'true_false': {
      const choices = (data as { choices: Choice[] }).choices;
      const picked = (response as { choice?: string })?.choice;
      if (typeof picked !== 'string' || !choices.some((c) => c.id === picked)) throw new InvalidAnswerError('Choose one answer.');
      const ok = choices.find((c) => c.id === picked)!.correct;
      return { score: ok ? 1 : 0, correct: ok, evaluation: 'auto', detail: { picked: [picked] } };
    }
    case 'multiple': {
      const choices = (data as { choices: Choice[] }).choices;
      const picked = (response as { choices?: string[] })?.choices;
      if (!Array.isArray(picked) || picked.length === 0) throw new InvalidAnswerError('Tick at least one answer.');
      const set = new Set(picked);
      if ([...set].some((id) => !choices.some((c) => c.id === id))) throw new InvalidAnswerError('Unknown option.');
      const right = choices.filter((c) => c.correct);
      const share = 1 / Math.max(1, right.length);
      let score = 0;
      for (const c of choices) if (set.has(c.id)) score += c.correct ? share : -share;
      score = Math.max(0, Math.min(1, Math.round(score * 1000) / 1000));
      const exact = right.length === set.size && right.every((c) => set.has(c.id));
      return { score: exact ? 1 : score, correct: exact, evaluation: 'auto', detail: { picked: [...set] } };
    }
    case 'matching': {
      const pairs = (data as { pairs: { left: string; right: string }[] }).pairs;
      const map = (response as { matches?: Record<string, string> })?.matches;
      if (!map || typeof map !== 'object') throw new InvalidAnswerError('Match every item.');
      if (pairs.some((p) => typeof map[p.left] !== 'string' || !map[p.left])) throw new InvalidAnswerError('Match every item.');
      const good = pairs.filter((p) => map[p.left] === p.right).map((p) => p.left);
      const score = good.length / pairs.length;
      return { score, correct: good.length === pairs.length, evaluation: 'auto', detail: { good } };
    }
    case 'ordering': {
      const items = (data as { items: string[] }).items;
      const order = (response as { order?: string[] })?.order;
      if (!Array.isArray(order) || order.length !== items.length || new Set(order).size !== items.length || order.some((x) => !items.includes(x))) {
        throw new InvalidAnswerError('Place every item once.');
      }
      const good = order.map((x, i) => x === items[i]);
      const score = good.filter(Boolean).length / items.length;
      return { score, correct: good.every(Boolean), evaluation: 'auto', detail: { good } };
    }
    case 'short':
    case 'scenario': {
      const d = data as { rubric: string[]; modelAnswer: string; accepted?: string[] };
      const r = response as { text?: string; rubricMet?: number[] };
      if (typeof r?.text !== 'string' || !r.text.trim()) throw new InvalidAnswerError('Write an answer.');
      if (type === 'short' && d.accepted?.length) {
        const ok = d.accepted.some((a) => normalise(a) === normalise(r.text!));
        if (ok) return { score: 1, correct: true, evaluation: 'auto', detail: { matched: true } };
      }
      if (!Array.isArray(r.rubricMet)) {
        return { score: 0, correct: false, evaluation: 'needs_review', detail: { rubric: d.rubric } };
      }
      const met = [...new Set(r.rubricMet)].filter((i) => Number.isInteger(i) && i >= 0 && i < d.rubric.length);
      const score = d.rubric.length ? met.length / d.rubric.length : 0;
      return { score, correct: score >= 0.8, evaluation: 'self_assessed', detail: { met } };
    }
  }
}

/** Total of an attempt: sum of per-question scores. */
export function totalScore(scores: number[]) {
  const sum = scores.reduce((a, b) => a + b, 0);
  return { score: Math.round(sum * 100) / 100, max: scores.length, percent: scores.length ? Math.round((sum / scores.length) * 100) : 0 };
}
