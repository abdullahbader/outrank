import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basePoints, pointsFor, rotate, isValidRank } from '../src/scoring.ts';
import { newGame } from './helpers.ts';

test('scoring table matches the brief exactly', () => {
  const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9, 20, -11, -12];
  expected.forEach((pts, i) => assert.equal(basePoints(i + 1), pts));
  assert.throws(() => basePoints(0));
  assert.throws(() => basePoints(13));
  assert.equal(isValidRank(2.5), false);
});

test('edge 1–4: rank 1 = +1, rank 10 = +20, rank 11 = −11, rank 12 = −12 in play', () => {
  const g = newGame(['A', 'B', 'C', 'D']);
  g.answer(1); g.answer(10); g.answer(11); g.answer(12);
  assert.deepEqual(['A', 'B', 'C', 'D'].map((p) => g.score(p)), [1, 20, -11, -12]);
});

test('multiplier applies to negative points too', () => {
  assert.equal(pointsFor(5, 5), 25);
  assert.equal(pointsFor(10, 5), 100);
  assert.equal(pointsFor(11, 5), -55);
});

test('rotation: first player moves to the end, order otherwise kept', () => {
  assert.deepEqual(rotate(['Ahmed', 'Omar', 'Sara', 'Ali']), ['Omar', 'Sara', 'Ali', 'Ahmed']);
  assert.deepEqual(rotate(['x']), ['x']);
});
