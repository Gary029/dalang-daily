/**
 * The gate every live puzzle must pass (run in CI): exactly one answer,
 * the stored target is that answer's shadow, par is the true fewest taps,
 * the start is not already solved, and every wayang can be collected.
 */
import { BANK } from '../src/shared/bank.ts';
import { FIGURES } from '../src/shared/figures.ts';
import { decodeMask, equal } from '../src/shared/grid.ts';
import {
  isSolved,
  parOf,
  shadowOf,
  solve,
  type PuzzleDef,
} from '../src/shared/puzzle.ts';

const problems: string[] = [];
const fail = (p: PuzzleDef, msg: string) => problems.push(`${p.id}: ${msg}`);

const all = [BANK.warmup, ...BANK.puzzles];
const ids = new Set<string>();
for (const p of all) {
  if (ids.has(p.id)) fail(p, 'duplicate id');
  ids.add(p.id);
  const target = decodeMask(p.target);
  if (!equal(shadowOf(p.offered, p.solution), target))
    fail(p, 'target is not the shadow of the solution');
  if (isSolved(p, p.start)) fail(p, 'already solved at the start');
  if (parOf(p.start, p.solution) !== p.par)
    fail(p, `par ${p.par} but fewest taps is ${parOf(p.start, p.solution)}`);
  if (
    p.offered.length !== p.start.length ||
    p.offered.length !== p.solution.length
  )
    fail(p, 'slot count mismatch');
  if (p.index >= 0 && p.tale.length < 40) fail(p, 'missing story chapter');
  for (const c of p.cards)
    if (!p.solution[p.offered.indexOf(c)])
      fail(p, `card ${c} is not in the answer`);
  const { solutions } = solve(p.offered, target, 2);
  if (solutions.length !== 1)
    fail(p, `${solutions.length} answers (must be exactly 1)`);
  console.log(
    `${p.id.padEnd(7)} par ${String(p.par).padStart(2)}  ${p.offered.length} puppets  ${solutions.length === 1 ? 'one answer' : 'NOT UNIQUE'}`
  );
}

if (BANK.puzzles.length % 7 !== 0)
  problems.push(`bank has ${BANK.puzzles.length} puzzles, want whole weeks`);
BANK.puzzles.forEach((p, k) => {
  if (p.weekday !== k % 7) fail(p, `weekday ${p.weekday}, expected ${k % 7}`);
  if (p.index !== k) fail(p, `index ${p.index}, expected ${k}`);
});
const collectable = new Set(BANK.puzzles.flatMap((p) => p.cards));
for (const f of FIGURES)
  if (!collectable.has(f.id)) problems.push(`${f.name} can never be collected`);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(
  `\nAll ${all.length} puzzles pass: one answer each, true par, ${collectable.size}/${FIGURES.length} wayang collectable.`
);
