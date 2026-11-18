// Spaced repetition: SuperMemo-2 (P. Wozniak, 1987), with a short learning phase for new cards.
// Grades: again = 0 (forgot), hard = 3, good = 4, easy = 5.

export type Grade = 'again' | 'hard' | 'good' | 'easy';
export type CardState = {
  state: 'new' | 'learning' | 'review';
  ease: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueAt: Date;
};
const Q: Record<Grade, number> = { again: 0, hard: 3, good: 4, easy: 5 };
const LEARNING_STEPS_MIN = [10, 60 * 24]; // 10 minutes, then 1 day
const DAY = 86_400_000;

export const newCard = (now = new Date()): CardState => ({ state: 'new', ease: 2.5, intervalDays: 0, repetitions: 0, lapses: 0, dueAt: now });

export function review(card: CardState, grade: Grade, now = new Date()): CardState {
  const q = Q[grade];
  // SM-2 ease update, bounded below at 1.3.
  const ease = Math.max(1.3, card.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  if (q < 3) {
    return { state: 'learning', ease, intervalDays: 0, repetitions: 0, lapses: card.lapses + (card.state === 'review' ? 1 : 0), dueAt: new Date(now.getTime() + LEARNING_STEPS_MIN[0] * 60_000) };
  }
  const reps = card.repetitions + 1;
  let interval: number;
  if (reps === 1) interval = grade === 'easy' ? 4 : 1;
  else if (reps === 2) interval = grade === 'easy' ? 8 : 6;
  else interval = Math.round(card.intervalDays * ease * (grade === 'hard' ? 0.8 : grade === 'easy' ? 1.3 : 1));
  interval = Math.max(1, interval);
  return { state: 'review', ease, intervalDays: interval, repetitions: reps, lapses: card.lapses, dueAt: new Date(now.getTime() + interval * DAY) };
}

/** Classification shown in the revision dashboard. */
export function bucket(c: CardState): 'new' | 'learning' | 'review' | 'mastered' | 'difficult' {
  if (c.state === 'new') return 'new';
  if (c.lapses >= 2 || c.ease < 1.8) return 'difficult';
  if (c.state === 'learning') return 'learning';
  if (c.intervalDays >= 21) return 'mastered';
  return 'review';
}
