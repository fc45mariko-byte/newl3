// Distinguishes activity (what the student opened or clicked) from demonstrated knowledge
// (what her answers show), and both from retention over time.

export type AnswerPoint = { conceptId: string; score: number; at: Date };
export type ConceptMastery = {
  conceptId: string;
  answers: number;
  accuracy: number; // recency-weighted, 0..1
  status: 'unseen' | 'learning' | 'understood' | 'retained' | 'needs_work';
};

const DAY = 86_400_000;

export function conceptMastery(points: AnswerPoint[], now = new Date()): Map<string, ConceptMastery> {
  const by = new Map<string, AnswerPoint[]>();
  for (const p of points) {
    if (!by.has(p.conceptId)) by.set(p.conceptId, []);
    by.get(p.conceptId)!.push(p);
  }
  const out = new Map<string, ConceptMastery>();
  for (const [id, list] of by) {
    list.sort((a, b) => a.at.getTime() - b.at.getTime());
    // Weight recent answers more: weight 1, 2, 3… for older to newer.
    let w = 0, s = 0;
    list.forEach((p, i) => { w += i + 1; s += (i + 1) * p.score; });
    const accuracy = w ? s / w : 0;
    const last = list[list.length - 1];
    const firstGood = list.find((p) => p.score >= 0.8);
    let status: ConceptMastery['status'];
    if (list.length >= 2 && (accuracy < 0.6 || last.score < 0.5)) status = 'needs_work';
    else if (list.length >= 2 && accuracy >= 0.8 && last.score >= 0.8) {
      // Retained: still answered correctly at least 7 days after the first correct answer.
      const retained = firstGood && last.at.getTime() - firstGood.at.getTime() >= 7 * DAY;
      status = retained ? 'retained' : 'understood';
    } else status = 'learning';
    void now;
    out.set(id, { conceptId: id, answers: list.length, accuracy, status });
  }
  return out;
}

export function summarise(m: Map<string, ConceptMastery>, totalConcepts: number) {
  const c = { understood: 0, retained: 0, needsWork: 0, learning: 0 };
  for (const x of m.values()) {
    if (x.status === 'understood') c.understood++;
    else if (x.status === 'retained') { c.retained++; c.understood++; }
    else if (x.status === 'needs_work') c.needsWork++;
    else if (x.status === 'learning') c.learning++;
  }
  return { ...c, unseen: Math.max(0, totalConcepts - m.size), total: totalConcepts };
}
