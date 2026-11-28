/**
 * The gate every live puzzle must pass (run in CI): exactly one answer,
 * the stored target is that answer's shadow, par is the true fewest taps,
 * the start is not already solved, and every wayang can be collected.
 */
import { BANK } from '../src/shared/bank.ts';
import { FIGURES } from '../src/shared/figures.ts';
import { PUSAKA } from '../src/shared/pusaka.ts';
import { decodeMask, equal } from '../src/shared/grid.ts';
import { jointsAllowed } from '../src/shared/shadow.ts';
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
  if (!equal(shadowOf(p.offered, p.solution, p.lamps), target))
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
  if (p.weekday === 6 && p.index >= 0 && p.lamps !== 2)
    fail(p, 'Sunday should be a two-lamp night');
  for (const slot of [...p.solution, ...p.start])
    if (slot && !jointsAllowed(slot, p.joints))
      fail(p, 'a pose moves a joint this puzzle keeps still');
  const { solutions } = solve(p.offered, target, 2, p.lamps, p.joints);
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
// every pusaka is given by exactly one scene, and every wayang appears somewhere
const given = all.flatMap((p) => p.cards);
for (const q of PUSAKA) {
  const n = given.filter((id) => id === q.id).length;
  if (n !== 1) problems.push(`${q.name} is given by ${n} scenes (want 1)`);
}
for (const id of given)
  if (!PUSAKA.some((q) => q.id === id)) problems.push(`unknown pusaka ${id}`);
const met = new Set(all.flatMap((p) => p.cast));
for (const f of FIGURES)
  if (!met.has(f.id)) problems.push(`${f.name} never appears in an answer`);
for (const p of all)
  for (const id of p.cast)
    if (!p.solution[p.offered.indexOf(id)])
      fail(p, `${id} is in the cast but not in the answer`);
const collectable = new Set(given);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(
  `\nAll ${all.length} puzzles pass: one answer each, true par, ${collectable.size}/${PUSAKA.length} pusaka, ${met.size}/${FIGURES.length} wayang met.`
);
