import { describe, expect, it } from 'vitest';
import { evaluate, InvalidAnswerError, normalise, totalScore } from '@/lib/scoring';

const single = { choices: [{ id: 'a', text: 'A', correct: true, explanation: '' }, { id: 'b', text: 'B', correct: false, explanation: '' }] };
const multi = { choices: [
  { id: 'a', text: 'A', correct: true, explanation: '' }, { id: 'b', text: 'B', correct: true, explanation: '' },
  { id: 'c', text: 'C', correct: false, explanation: '' }, { id: 'd', text: 'D', correct: false, explanation: '' }] };

describe('single choice and true/false', () => {
  it('validates a correct answer', () => expect(evaluate('single', single, { choice: 'a' })).toMatchObject({ score: 1, correct: true, evaluation: 'auto' }));
  it('validates an incorrect answer', () => expect(evaluate('true_false', single, { choice: 'b' })).toMatchObject({ score: 0, correct: false }));
  it('rejects a missing or unknown choice', () => {
    expect(() => evaluate('single', single, {})).toThrow(InvalidAnswerError);
    expect(() => evaluate('single', single, { choice: 'z' })).toThrow(InvalidAnswerError);
  });
});

describe('multiple-select scoring', () => {
  it('gives full marks only for the exact set', () => expect(evaluate('multiple', multi, { choices: ['a', 'b'] })).toMatchObject({ score: 1, correct: true }));
  it('gives partial credit for some correct options', () => expect(evaluate('multiple', multi, { choices: ['a'] })).toMatchObject({ score: 0.5, correct: false }));
  it('subtracts for wrong options', () => expect(evaluate('multiple', multi, { choices: ['a', 'b', 'c'] }).score).toBe(0.5));
  it('never goes below zero', () => expect(evaluate('multiple', multi, { choices: ['c', 'd'] }).score).toBe(0));
  it('ignores duplicates', () => expect(evaluate('multiple', multi, { choices: ['a', 'a'] }).score).toBe(0.5));
  it('rejects an empty selection', () => expect(() => evaluate('multiple', multi, { choices: [] })).toThrow(InvalidAnswerError));
});

describe('matching and ordering', () => {
  const pairs = { pairs: [{ left: 'x', right: '1' }, { left: 'y', right: '2' }, { left: 'z', right: '3' }, { left: 'w', right: '4' }] };
  it('scores each correct pair', () => expect(evaluate('matching', pairs, { matches: { x: '1', y: '2', z: '4', w: '3' } })).toMatchObject({ score: 0.5, correct: false }));
  it('requires every pair', () => expect(() => evaluate('matching', pairs, { matches: { x: '1' } })).toThrow(InvalidAnswerError));
  const items = { items: ['a', 'b', 'c'] };
  it('scores items in place', () => expect(evaluate('ordering', items, { order: ['a', 'c', 'b'] }).score).toBeCloseTo(1 / 3));
  it('accepts the exact order', () => expect(evaluate('ordering', items, { order: ['a', 'b', 'c'] })).toMatchObject({ score: 1, correct: true }));
  it('rejects a list with missing or repeated items', () => expect(() => evaluate('ordering', items, { order: ['a', 'a', 'b'] })).toThrow(InvalidAnswerError));
});

describe('written answers', () => {
  const short = { rubric: ['one', 'two', 'three'], modelAnswer: 'm', accepted: ['Connaissement'] };
  it('accepts a listed answer regardless of case and accents', () => expect(evaluate('short', short, { text: ' connaissément ' })).toMatchObject({ score: 1, evaluation: 'auto' }));
  it('needs review until self-assessed', () => expect(evaluate('short', short, { text: 'something else' })).toMatchObject({ score: 0, evaluation: 'needs_review' }));
  it('scores the share of rubric criteria met', () => expect(evaluate('scenario', short, { text: 'x', rubricMet: [0, 2, 2, 9] })).toMatchObject({ score: 2 / 3, evaluation: 'self_assessed', correct: false }));
  it('rejects an empty text', () => expect(() => evaluate('short', short, { text: '  ' })).toThrow(InvalidAnswerError));
});

describe('totals', () => {
  it('computes score and percentage', () => expect(totalScore([1, 0.5, 0, 0])).toEqual({ score: 1.5, max: 4, percent: 38 }));
  it('normalises text', () => expect(normalise('Éléphant, rose!')).toBe('elephant rose'));
});
