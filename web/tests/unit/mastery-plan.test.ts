import { describe, expect, it } from 'vitest';
import { conceptMastery, summarise } from '@/lib/mastery';
import { planRevision } from '@/lib/revision-plan';

const d = (s: string) => new Date(s);
describe('concept mastery', () => {
  it('distinguishes understood, retained and needs work', () => {
    const m = conceptMastery([
      { conceptId: 'a', score: 1, at: d('2026-11-01') }, { conceptId: 'a', score: 1, at: d('2026-11-02') },
      { conceptId: 'b', score: 1, at: d('2026-11-01') }, { conceptId: 'b', score: 1, at: d('2026-11-10') },
      { conceptId: 'c', score: 0, at: d('2026-11-01') }, { conceptId: 'c', score: 0, at: d('2026-11-02') },
      { conceptId: 'e', score: 1, at: d('2026-11-01') },
    ]);
    expect(m.get('a')!.status).toBe('understood');
    expect(m.get('b')!.status).toBe('retained');
    expect(m.get('c')!.status).toBe('needs_work');
    expect(m.get('e')!.status).toBe('learning'); // one answer is not mastery
    expect(summarise(m, 10)).toMatchObject({ understood: 2, retained: 1, needsWork: 1, unseen: 6 });
  });
});

describe('revision plan', () => {
  const chapters = [
    { id: '1', title: 'Essential weak', priority: 'ESSENTIAL' as const, mastery: 0.2 },
    { id: '2', title: 'Important', priority: 'IMPORTANT' as const, mastery: 0.6 },
    { id: '3', title: 'Advanced mastered', priority: 'ADVANCED' as const, mastery: 0.9 },
  ];
  it('stays within the daily time and never repeats a chapter the same day', () => {
    const p = planRevision(chapters, { today: d('2026-11-18'), examDate: d('2026-12-08'), minutesPerDay: 90 });
    const perDay = new Map<string, number>();
    for (const s of p.sessions) perDay.set(s.date, (perDay.get(s.date) ?? 0) + s.minutes);
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(90);
    const keys = p.sessions.map((s) => `${s.date}|${s.chapterId}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(p.sessions.every((s) => new Date(`${s.date}T12:00:00Z`).getUTCDay() !== 0)).toBe(true);
    expect(p.sessions.filter((s) => s.chapterId === '1').length).toBeGreaterThanOrEqual(3);
    expect(p.shortfallMinutes).toBe(0);
  });
  it('reports a shortfall instead of cramming', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: String(i), title: `C${i}`, priority: 'ESSENTIAL' as const, mastery: 0 }));
    const p = planRevision(many, { today: d('2026-11-18'), examDate: d('2026-11-21'), minutesPerDay: 45 });
    expect(p.shortfallMinutes).toBeGreaterThan(0);
    expect(p.dropped.length).toBeGreaterThan(0);
    expect(p.sessions.length).toBeLessThanOrEqual(3);
  });
  it('refuses a past exam', () => expect(planRevision(chapters, { today: d('2026-11-18'), examDate: d('2026-11-18'), minutesPerDay: 60 }).sessions).toHaveLength(0));
});
