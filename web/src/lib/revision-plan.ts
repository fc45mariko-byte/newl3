// Suggests a realistic revision schedule before an exam. It never plans more than the student
// said she can work, keeps one free day per week, and reports a shortfall instead of cramming.

export type PlanChapter = { id: string; title: string; priority: 'ESSENTIAL' | 'IMPORTANT' | 'ADVANCED'; mastery: number /* 0..1 */ };
export type PlanInput = {
  today: Date;
  examDate: Date;
  minutesPerDay: number;
  sessionMinutes?: number;
  restDay?: number; // 0 = Sunday
  busy?: { date: string; minutes: number }[]; // minutes already taken on a given day (classes, other deadlines)
};
export type PlannedSession = { date: string; chapterId: string; title: string; kind: 'learn' | 'review' | 'final'; minutes: number };
export type Plan = { sessions: PlannedSession[]; shortfallMinutes: number; dropped: string[]; notes: string[] };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const WEIGHT = { ESSENTIAL: 3, IMPORTANT: 2, ADVANCED: 1 };

export function planRevision(chapters: PlanChapter[], input: PlanInput): Plan {
  const session = input.sessionMinutes ?? 45;
  const rest = input.restDay ?? 0;
  const days: { date: string; free: number }[] = [];
  const start = new Date(Date.UTC(input.today.getUTCFullYear(), input.today.getUTCMonth(), input.today.getUTCDate()));
  const end = new Date(Date.UTC(input.examDate.getUTCFullYear(), input.examDate.getUTCMonth(), input.examDate.getUTCDate()));
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() === rest) continue;
    const busy = input.busy?.filter((b) => b.date === iso(d)).reduce((a, b) => a + b.minutes, 0) ?? 0;
    const free = Math.max(0, input.minutesPerDay - Math.max(0, busy - 120)); // classes beyond 2 h reduce study time
    days.push({ date: iso(d), free });
  }
  const notes: string[] = [];
  if (!days.length) return { sessions: [], shortfallMinutes: 0, dropped: chapters.map((c) => c.title), notes: ['The exam is today or already past: no plan can be made.'] };

  // Need per chapter: weaker and more important chapters get more sessions.
  const need = chapters
    .map((c) => {
      const learn = c.mastery < 0.5 ? 2 : 1;
      const review = c.priority === 'ADVANCED' && c.mastery >= 0.8 ? 0 : 1;
      return { c, learn, review, score: WEIGHT[c.priority] * (1.2 - c.mastery) };
    })
    .sort((a, b) => b.score - a.score);

  const queue: { c: PlanChapter; kind: PlannedSession['kind'] }[] = [];
  for (const n of need) for (let i = 0; i < n.learn; i++) queue.push({ c: n.c, kind: 'learn' });
  const reviews = need.filter((n) => n.review).map((n) => ({ c: n.c, kind: 'review' as const }));

  const sessions: PlannedSession[] = [];
  const capacity = days.map((d) => Math.floor(d.free / session));
  const total = capacity.reduce((a, b) => a + b, 0);
  const finalDays = Math.min(2, days.length);
  // Learning sessions go in the earlier days, reviews in the second half, and the last days hold a final pass
  // on essential chapters. A chapter is never planned twice on the same day.
  const dropped: string[] = [];
  const cursor = { learn: 0, review: 0, final: 0 };
  const place = (item: { c: PlanChapter; kind: PlannedSession['kind'] }, from: number, to: number) => {
    const span = to - from;
    if (span <= 0) return false;
    for (let k = 0; k < span; k++) {
      const idx = from + ((cursor[item.kind] + k) % span);
      if (capacity[idx] > 0 && !sessions.some((s) => s.date === days[idx].date && s.chapterId === item.c.id)) {
        capacity[idx]--;
        sessions.push({ date: days[idx].date, chapterId: item.c.id, title: item.c.title, kind: item.kind, minutes: session });
        cursor[item.kind] = idx - from + 1;
        return true;
      }
    }
    return false;
  };
  const learnEnd = Math.max(1, days.length - finalDays);
  for (const q of queue) if (!place(q, 0, learnEnd)) dropped.push(`${q.c.title} (learning)`);
  for (const r of reviews) if (!place(r, Math.floor(learnEnd / 2), days.length)) dropped.push(`${r.c.title} (review)`);
  for (const n of need.filter((x) => x.c.priority === 'ESSENTIAL')) place({ c: n.c, kind: 'final' }, days.length - finalDays, days.length);

  const needed = (queue.length + reviews.length) * session;
  const shortfall = Math.max(0, needed - total * session);
  if (shortfall) notes.push(`The time available is ${Math.round((total * session) / 60)} h; this material needs about ${Math.round(needed / 60)} h. Lower-priority sessions were left out rather than squeezed in.`);
  notes.push('One day a week is kept free.');
  sessions.sort((a, b) => a.date.localeCompare(b.date));
  return { sessions, shortfallMinutes: shortfall, dropped, notes };
}
