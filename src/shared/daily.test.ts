import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BANK } from './bank.ts';
import {
  loadPuzzle,
  recordSolve,
  saveUgc,
  tomorrowOf,
  todayFor,
} from './game.ts';
import { memoryKV } from './memkv.ts';
import { shadowOf } from './puzzle.ts';
import { checkShadow, newUgcId, toUgc } from './ugc.ts';
import { DEFAULT_POSE } from './shadow.ts';

type MemKV = ReturnType<typeof memoryKV>;

const solveDay = (kv: MemKV, day: number, moves: number, user = 'u') => {
  const d = BANK.puzzles[day % BANK.puzzles.length]!;
  return recordSolve(kv, {
    postId: `t3_${day}`,
    user,
    info: { day, index: day % BANK.puzzles.length },
    def: d,
    slots: d.solution,
    moves: moves < 0 ? d.par : moves,
  });
};

test('gold solves fill the lamp oil, which keeps a streak across a missed day', async () => {
  const kv = memoryKV();
  const r0 = await solveDay(kv, 0, -1);
  assert.equal(r0.oil, 1);
  const r1 = await solveDay(kv, 1, -1);
  assert.equal(r1.oil, 2);
  assert.equal(r1.streak, 2);
  // miss day 2: one oil burns, the streak goes on
  const r3 = await solveDay(kv, 3, 99);
  assert.equal(r3.oilUsed, 1);
  assert.equal(r3.oil, 1);
  assert.equal(r3.streak, 3);
  // miss days 4 and 5 with only one oil left: the streak starts again
  const r6 = await solveDay(kv, 6, 99);
  assert.equal(r6.oilUsed, 0);
  assert.equal(r6.streak, 1);
});

test('the oil never goes above the limit', async () => {
  const kv = memoryKV();
  let last = await solveDay(kv, 0, -1);
  for (let d = 1; d < 6; d++) last = await solveDay(kv, d, -1);
  assert.equal(last.oil, 3);
});

test('solving an older post does not break the streak', async () => {
  const kv = memoryKV();
  await solveDay(kv, 4, 99);
  await solveDay(kv, 5, 99);
  const old = await solveDay(kv, 1, 99);
  assert.equal(old.streak, 2);
});

test('the board ranks fewest moves first, then the earliest solver', async () => {
  const kv = memoryKV();
  await solveDay(kv, 1, 20, 'slow');
  await solveDay(kv, 1, 9, 'early');
  await solveDay(kv, 1, 9, 'late');
  const me = await solveDay(kv, 1, -1, 'best');
  assert.deepEqual(
    me.board.map((r) => r.name),
    ['best', 'early', 'late', 'slow']
  );
  assert.equal(me.board[0]!.gold, true);
  assert.equal(me.myRank, 1);
});

test('the story chapter is only sent once the shadow is solved', async () => {
  const kv = memoryKV();
  const info = { day: 2, index: 2 };
  const before = await todayFor(kv, {
    postId: 't3_2',
    user: 'u',
    info,
    peek: false,
    subredditName: null,
  });
  assert.equal(before.tale, null);
  assert.ok(!JSON.stringify(before).includes('solution'));
  const r = await solveDay(kv, 2, 99);
  assert.ok(r.tale && r.tale.length > 20);
  const after = await todayFor(kv, {
    postId: 't3_2',
    user: 'u',
    info,
    peek: false,
    subredditName: null,
  });
  assert.equal(after.tale, r.tale);
});

test("tomorrow's newcomer is a wayang from the next scene", () => {
  for (let day = 0; day < BANK.puzzles.length; day++) {
    const t = tomorrowOf({ day, index: day });
    const next = BANK.puzzles[(day + 1) % BANK.puzzles.length]!;
    assert.ok(next.cast.includes(t.figure));
  }
});

// --- player-made shadows ---------------------------------------------------------

const owned = ['semar', 'gareng', 'petruk', 'bima'];

test('a player shadow needs a name, a decoy and one answer', () => {
  const one = { ...DEFAULT_POSE, x: 1 };
  assert.equal(
    checkShadow(
      { title: '', offered: ['semar', 'gareng'], slots: [one, null] },
      owned
    ).ok,
    false
  );
  const noDecoy = checkShadow(
    {
      title: 'Two old men',
      offered: ['semar', 'gareng'],
      slots: [one, { ...DEFAULT_POSE, x: 5 }],
    },
    owned
  );
  assert.equal(noDecoy.ok, false);
  const notOwned = checkShadow(
    { title: 'Giant', offered: ['buta', 'semar'], slots: [one, null] },
    owned
  );
  assert.equal(notOwned.ok, false);
  const good = checkShadow(
    { title: 'Semar alone', offered: ['semar', 'gareng'], slots: [one, null] },
    owned
  );
  assert.equal(good.ok, true);
  if (good.ok) assert.equal(good.par, 1 + 2);
});

test('a player shadow plays like any post, on its own board, with no cards or streak', async () => {
  const kv = memoryKV();
  const req = {
    title: 'Semar alone',
    offered: ['semar', 'gareng'],
    slots: [{ ...DEFAULT_POSE, x: 1, arm: 1 }, null],
  };
  const check = checkShadow(req, owned);
  assert.ok(check.ok);
  if (!check.ok) return;
  const def = toUgc(req, check, 'maker', newUgcId());
  assert.deepEqual(def.start, [null, null]);
  await saveUgc(kv, def);
  const info = { day: 3, index: -2, ugc: def.id };
  const loaded = await loadPuzzle(kv, info);
  assert.equal(loaded.id, def.id);
  assert.ok(
    shadowOf(loaded.offered, loaded.solution).every(
      (w, k) => w === shadowOf(req.offered, req.slots)[k]
    )
  );
  const r = await recordSolve(kv, {
    postId: 't3_ugc',
    user: 'friend',
    info,
    def: loaded,
    slots: loaded.solution,
    moves: loaded.par,
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.newCards, []);
  assert.equal(r.streak, 0);
  assert.equal(r.board[0]!.name, 'friend');
  const t = await todayFor(kv, {
    postId: 't3_ugc',
    user: 'friend',
    info,
    peek: true,
    subredditName: null,
  });
  assert.equal(t.author, 'maker');
});

test('a second lamp splits each shadow, wider the closer the puppet stands', async () => {
  const { lampShift, puppetMask } = await import('./shadow.ts');
  const { count } = await import('./grid.ts');
  const shifts = [0, 1, 2, 3, 4].map((d) => lampShift({ ...DEFAULT_POSE, d }));
  for (let k = 1; k < shifts.length; k++)
    assert.ok(shifts[k]! > shifts[k - 1]!);
  const one = count(puppetMask('bima', { ...DEFAULT_POSE, d: 4 }, 1));
  const two = count(puppetMask('bima', { ...DEFAULT_POSE, d: 4 }, 2));
  assert.ok(two > one * 1.2, 'two lamps cast more shadow than one');
});

test('Sundays are two-lamp nights, the rest of the week one lamp', () => {
  for (const p of BANK.puzzles) assert.equal(p.lamps, p.weekday === 6 ? 2 : 1);
  assert.equal(BANK.warmup.lamps, 1);
});

test('a solve fills the book: the pusaka, the wayang met and the chapter', async () => {
  const kv = memoryKV();
  const def = BANK.puzzles[2]!;
  const r = await recordSolve(kv, {
    postId: 't3_book',
    user: 'u',
    info: { day: 2, index: 2 },
    def,
    slots: def.solution,
    moves: 99,
  });
  assert.deepEqual(r.newCards, def.cards);
  assert.equal(r.cards[def.cards[0]!], 'card');
  for (const id of def.cast) assert.equal(r.met[id], true);
  for (const id of def.offered.filter((_, k) => !def.solution[k]))
    assert.equal(r.met[id], undefined, 'decoys are not met');
  assert.deepEqual(r.read, [def.id]);
});
