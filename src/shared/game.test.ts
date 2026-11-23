import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BANK, WARMUP } from './bank.ts';
import {
  flairText,
  loadProfile,
  recordSolve,
  revealHint,
  shareText,
  solveOf,
  validSlots,
} from './game.ts';
import { memoryKV } from './memkv.ts';

const def = BANK.puzzles[1]!;
const info = (day: number) => ({ day, index: 1 });

test('a wrong shadow is refused and nothing is saved', async () => {
  const kv = memoryKV();
  const r = await recordSolve(kv, {
    postId: 't3_a',
    user: 'u',
    info: info(1),
    def,
    slots: def.start,
    moves: 3,
  });
  assert.equal(r.ok, false);
  assert.equal(await solveOf(kv, 't3_a', 'u'), null);
});

test('a solve at par with no hints earns gold cards and starts a streak', async () => {
  const kv = memoryKV();
  const r = await recordSolve(kv, {
    postId: 't3_a',
    user: 'u',
    info: info(1),
    def,
    slots: def.solution,
    moves: def.par,
  });
  assert.equal(r.ok, true);
  assert.equal(r.gold, true);
  assert.equal(r.streak, 1);
  for (const c of def.cards) assert.equal(r.cards[c], 'gold');
  assert.equal(r.solvers, 1);
});

test('the post cannot claim fewer moves than par', async () => {
  const kv = memoryKV();
  const r = await recordSolve(kv, {
    postId: 't3_a',
    user: 'u',
    info: info(1),
    def,
    slots: def.solution,
    moves: 1,
  });
  assert.equal(r.moves, def.par);
});

test('a hint costs the gold card, not the solve', async () => {
  const kv = memoryKV();
  const hints = await revealHint(kv, 't3_a', 'u', def);
  assert.equal(hints.length, 1);
  const r = await recordSolve(kv, {
    postId: 't3_a',
    user: 'u',
    info: info(1),
    def,
    slots: def.solution,
    moves: def.par,
  });
  assert.equal(r.ok, true);
  assert.equal(r.gold, false);
});

test('streaks grow on consecutive days and reset after a gap', async () => {
  const kv = memoryKV();
  const d0 = BANK.puzzles[0]!;
  const d1 = BANK.puzzles[1]!;
  const d3 = BANK.puzzles[3]!;
  await recordSolve(kv, {
    postId: 't3_0',
    user: 'u',
    info: { day: 0, index: 0 },
    def: d0,
    slots: d0.solution,
    moves: 99,
  });
  const r1 = await recordSolve(kv, {
    postId: 't3_1',
    user: 'u',
    info: { day: 1, index: 1 },
    def: d1,
    slots: d1.solution,
    moves: 99,
  });
  assert.equal(r1.streak, 2);
  const r3 = await recordSolve(kv, {
    postId: 't3_3',
    user: 'u',
    info: { day: 3, index: 3 },
    def: d3,
    slots: d3.solution,
    moves: 99,
  });
  assert.equal(r3.streak, 1);
  const p = await loadProfile(kv, 'u');
  assert.equal(p.bestStreak, 2);
  assert.equal(p.solves, 3);
});

test('solving the same post twice changes nothing', async () => {
  const kv = memoryKV();
  const a = await recordSolve(kv, {
    postId: 't3_a',
    user: 'u',
    info: info(1),
    def,
    slots: def.solution,
    moves: 20,
  });
  const b = await recordSolve(kv, {
    postId: 't3_a',
    user: 'u',
    info: info(1),
    def,
    slots: def.solution,
    moves: def.par,
  });
  assert.equal(b.moves, a.moves);
  assert.equal(b.gold, false);
  assert.equal(b.streak, 1);
  assert.deepEqual(b.newCards, []);
});

test('the warm-up marks the player as warmed up without touching the streak', async () => {
  const kv = memoryKV();
  const r = await recordSolve(kv, {
    postId: 't3_a',
    user: 'u',
    info: info(1),
    def: WARMUP,
    slots: WARMUP.solution,
    moves: 9,
  });
  assert.equal(r.ok, true);
  const p = await loadProfile(kv, 'u');
  assert.equal(p.warmupDone, true);
  assert.equal(p.streak, 0);
});

test('answers from the post are validated before use', () => {
  assert.ok(validSlots(def, def.solution));
  assert.ok(!validSlots(def, 'nope'));
  assert.ok(!validSlots(def, def.solution.slice(1)));
  assert.ok(
    !validSlots(
      def,
      def.solution.map(() => ({ x: 99, d: 0, a: 0, arm: 0, flip: false }))
    )
  );
});

test('flair and comment text read well', () => {
  assert.equal(flairText({}), 'Penonton · 0 wayang');
  assert.match(
    flairText({ a: 'card', b: 'card', c: 'gold' }),
    /^Dalang Muda · 3 wayang/
  );
  const t = shareText(
    def,
    1,
    {
      moves: 7,
      par: def.par,
      gold: false,
      slots: def.solution,
      trail: [0, 1, 3],
    },
    2
  );
  assert.match(t, /100% in 7 moves/);
  assert.match(t, /\u{1F525}2/u);
  assert.match(t, /⬛\u{1F7EB}\u{1F7E8}/u);
  // spoiler-free: nothing about where the puppets stood
  assert.doesNotMatch(t, /"x"|flip|depth/);
});
