import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BANK, WARMUP, puzzleForDay } from './bank.ts';
import { FIGURES } from './figures.ts';
import {
  CELLS,
  count,
  decodeMask,
  emptyMask,
  encodeMask,
  equal,
  fillPolys,
  matchRatio,
} from './grid.ts';
import {
  bankIndexForDay,
  dayNumber,
  hintsFor,
  isSolved,
  parOf,
  poseDistance,
  shadowOf,
  solve,
  ANCHOR_UTC,
} from './puzzle.ts';
import {
  DEFAULT_POSE,
  POSES,
  placedPolys,
  poseFromIndex,
  poseIndex,
  puppetMask,
} from './shadow.ts';

test('a square fills the cells whose centres it covers', () => {
  const m = fillPolys(emptyMask(), [[10, 10, 20, 10, 20, 15, 10, 15]]);
  assert.equal(count(m), 10 * 5);
});

test('mask text encoding round-trips', () => {
  const m = puppetMask('bima', { x: 2, d: 3, a: 1, arm: 2, flip: true });
  assert.ok(count(m) > 100 && count(m) < CELLS);
  assert.ok(equal(decodeMask(encodeMask(m)), m));
});

test('match is 1 only for identical shadows', () => {
  const a = puppetMask('arjuna', DEFAULT_POSE);
  const b = puppetMask('arjuna', { ...DEFAULT_POSE, x: 4 });
  assert.equal(matchRatio(a, a), 1);
  assert.ok(matchRatio(a, b) < 1);
});

test('pose index covers every pose exactly once', () => {
  for (let i = 0; i < POSES; i += 37)
    assert.equal(poseIndex(poseFromIndex(i)), i);
});

test('carved holes let light through every figure', () => {
  for (const f of FIGURES) {
    const p = { ...DEFAULT_POSE, d: 4 };
    const { solids } = placedPolys(f, p);
    const solid = count(fillPolys(emptyMask(), solids));
    const carved = count(puppetMask(f.id, p));
    assert.ok(
      carved > 0 && carved < solid,
      `${f.id}: ${carved} of ${solid} cells`
    );
  }
});

test('every figure casts a different shadow in the same pose', () => {
  const seen = new Map<string, string>();
  for (const f of FIGURES) {
    const key = encodeMask(puppetMask(f.id, DEFAULT_POSE));
    assert.ok(!seen.has(key), `${f.id} looks exactly like ${seen.get(key)}`);
    seen.set(key, f.id);
  }
});

test('moves: tilt wraps, arm cycles forward only', () => {
  const a = { ...DEFAULT_POSE, a: 0, arm: 0 };
  assert.equal(poseDistance(a, { ...a, a: 7 }), 1);
  assert.equal(poseDistance(a, { ...a, arm: 2 }), 2);
  assert.equal(poseDistance({ ...a, arm: 2 }, a), 1);
});

test('par counts placing a puppet from the chest and removing decoys', () => {
  const goal = { ...DEFAULT_POSE, d: 3 };
  assert.equal(parOf([null, DEFAULT_POSE], [goal, null]), 1 + 1 + 1);
});

test('the warm-up has one answer and is solved by its solution only', () => {
  const t = decodeMask(WARMUP.target);
  assert.equal(solve(WARMUP.offered, t, 2).solutions.length, 1);
  assert.ok(isSolved(WARMUP, WARMUP.solution));
  assert.ok(!isSolved(WARMUP, WARMUP.start));
});

test('the calendar starts on Monday 23 Nov 2026 and cycles the bank', () => {
  assert.equal(new Date(ANCHOR_UTC).getUTCDay(), 1);
  assert.equal(dayNumber(ANCHOR_UTC + 3600_000), 0);
  assert.equal(bankIndexForDay(-1, 14), 13);
  assert.equal(puzzleForDay(14).id, BANK.puzzles[0]!.id);
  assert.equal(puzzleForDay(6).weekday, 6);
});

test('hints never give away more than three things', () => {
  for (const p of BANK.puzzles) {
    const h = hintsFor(p);
    assert.ok(h.length >= 1 && h.length <= 3, p.id);
  }
});

test('shadowOf ignores puppets in the chest', () => {
  const p = BANK.puzzles[3]!;
  const none = p.offered.map(() => null);
  assert.equal(count(shadowOf(p.offered, none)), 0);
});
