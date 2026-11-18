import { describe, expect, it } from 'vitest';
import { bucket, newCard, review } from '@/lib/sm2';

const DAY = 86_400_000;
const t0 = new Date('2026-11-18T10:00:00Z');

describe('SM-2 scheduling', () => {
  it('schedules a new card answered "good" for the next day, then six days', () => {
    const a = review(newCard(t0), 'good', t0);
    expect(a.intervalDays).toBe(1);
    expect(a.dueAt.getTime() - t0.getTime()).toBe(DAY);
    const b = review(a, 'good', a.dueAt);
    expect(b.intervalDays).toBe(6);
    const c = review(b, 'good', b.dueAt);
    expect(c.intervalDays).toBe(Math.round(6 * c.ease));
  });
  it('sends a forgotten card back to learning in ten minutes and counts a lapse', () => {
    const a = review(review(newCard(t0), 'good', t0), 'good', t0);
    const f = review(a, 'again', t0);
    expect(f.state).toBe('learning');
    expect(f.repetitions).toBe(0);
    expect(f.lapses).toBe(1);
    expect(f.dueAt.getTime() - t0.getTime()).toBe(10 * 60_000);
  });
  it('lowers ease on "hard" and never below 1.3', () => {
    let c = newCard(t0);
    for (let i = 0; i < 20; i++) c = review(c, 'again', t0);
    expect(c.ease).toBeGreaterThanOrEqual(1.3);
    expect(review(newCard(t0), 'hard', t0).ease).toBeLessThan(2.5);
  });
  it('classifies cards', () => {
    expect(bucket(newCard(t0))).toBe('new');
    expect(bucket({ ...newCard(t0), state: 'review', intervalDays: 30 })).toBe('mastered');
    expect(bucket({ ...newCard(t0), state: 'review', intervalDays: 6, lapses: 3 })).toBe('difficult');
  });
});
