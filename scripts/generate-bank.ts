/**
 * Builds src/shared/bank.json: the warm-up and two story weeks of puzzles.
 * Each scene's cast comes from the story plan below; the poses are rolled
 * from a fixed seed until the solver proves exactly one answer and the par
 * fits the weekday. Run: npm run bank
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  GH,
  GW,
  count,
  encodeMask,
  getBit,
  type Mask,
} from '../src/shared/grid.ts';
import {
  parOf,
  shadowOf,
  solve,
  type PuzzleDef,
  type Slot,
} from '../src/shared/puzzle.ts';
import {
  DEFAULT_POSE,
  DEPTHS,
  POSES,
  SLOTS,
  poseFromIndex,
  puppetMask,
  type Pose,
} from '../src/shared/shadow.ts';
import { andNotInto, emptyMask, orInto } from '../src/shared/grid.ts';

type Spec = {
  lakon: string;
  title: string;
  scene: string;
  cast: string[];
  decoys: string[];
  /** the chapter told after the solve; it ends on tomorrow's hook */
  tale: string;
};

const W1 = 'Bima Suci';
const W2 = 'Arjuna Wiwaha';

export const STORY: Spec[] = [
  {
    lakon: W1,
    title: 'Semar opens the screen',
    scene:
      'Before every lakon the old servant steps out first. Cast his shadow.',
    cast: ['semar'],
    decoys: ['gareng'],
    tale: 'Semar bows to the lamp and the night begins. Far away in Astina, the teacher Durna has a strange errand for Bima. Who will he send into the dark?',
  },
  {
    lakon: W1,
    title: 'Bima asks the way',
    scene: 'Bima will search for the water of life, wherever it hides.',
    cast: ['bima'],
    decoys: ['arjuna', 'buta'],
    tale: 'Durna tells Bima that the water of life lies under Mount Reksamuka. Bima does not ask why. He simply walks. But the mountain is not empty.',
  },
  {
    lakon: W1,
    title: 'The giant of the mountain',
    scene:
      'On Mount Reksamuka a giant guards the forest. Bima walks straight in.',
    cast: ['bima', 'buta'],
    decoys: ['cakil', 'duryudana'],
    tale: 'Two giants, Rukmuka and Rukmakala, rush down the mountain. Bima breaks them with his bare hands, and where they fall, two gods rise up. One small giant is still watching from the trees.',
  },
  {
    lakon: W1,
    title: 'Bima against Cakil',
    scene: 'A quick giant blocks the path. Only one of the two will stand.',
    cast: ['bima', 'cakil'],
    decoys: ['arjuna', 'buta'],
    tale: 'Cakil dances in, all knives and laughter. Bima does not dance. The forest goes quiet. Somewhere behind, two familiar voices are arguing.',
  },
  {
    lakon: W1,
    title: 'The brothers follow',
    scene: 'Petruk and Gareng run after Bima, arguing all the way.',
    cast: ['petruk', 'gareng'],
    decoys: ['bagong', 'semar', 'sengkuni'],
    tale: 'Petruk and Gareng find no water on the mountain, only broken rocks. Durna was wrong, or Durna lied. Back in the palace, someone is smiling.',
  },
  {
    lakon: W1,
    title: "Sengkuni's errand",
    scene: 'The quest was a trap: Sengkuni and his king hope Bima drowns.',
    cast: ['sengkuni', 'duryudana', 'bima'],
    decoys: ['yudhistira', 'arjuna'],
    tale: 'Sengkuni whispers to Duryudana: send Bima to the bottom of the sea, and he will never come back. Bima hears the new order and walks into the waves.',
  },
  {
    lakon: W1,
    title: 'The god in the sea',
    scene: 'In the deep ocean Bima meets a god the size of his thumb.',
    cast: ['dewaruci', 'bima', 'semar'],
    decoys: ['guru', 'bagong'],
    tale: "In the deep, a god no bigger than Bima's thumb asks him to step inside his ear. Inside, Bima sees the whole world, and himself. Next week a new story begins on a mountain.",
  },
  {
    lakon: W2,
    title: 'Arjuna on Indrakila',
    scene: 'Arjuna climbs the mountain alone to sit in stillness.',
    cast: ['arjuna'],
    decoys: ['nakula'],
    tale: 'Arjuna leaves his brothers to sit in stillness on Mount Indrakila. Before he goes, the eldest brother has one thing to say.',
  },
  {
    lakon: W2,
    title: "The eldest brother's blessing",
    scene: 'Yudhistira lets his brother go with a quiet word.',
    cast: ['yudhistira'],
    decoys: ['sadewa', 'sengkuni'],
    tale: 'Yudhistira, who has never told a lie, gives Arjuna his blessing and a warning: the gods will test you. While Arjuna is gone, the camp needs guards.',
  },
  {
    lakon: W2,
    title: 'The twins keep watch',
    scene: 'Nakula and Sadewa guard the camp while Arjuna is away.',
    cast: ['nakula', 'sadewa'],
    decoys: ['arjuna', 'gareng'],
    tale: 'Nakula and Sadewa watch the camp all night, and nothing comes. Up on the mountain, something does.',
  },
  {
    lakon: W2,
    title: 'The flower battle',
    scene:
      'Cakil leaps from the forest. Arjuna does not even draw his keris at first.',
    cast: ['arjuna', 'cakil'],
    decoys: ['bima', 'buta'],
    tale: 'Cakil leaps at the meditating Arjuna. Arjuna moves only once. The giant falls on his own keris, as every Cakil always does. Down in the village, Bagong heard the story too.',
  },
  {
    lakon: W2,
    title: 'Bagong tells it wrong',
    scene: 'Bagong retells the battle to Petruk, and wins it himself.',
    cast: ['bagong', 'petruk'],
    decoys: ['gareng', 'semar', 'sengkuni'],
    tale: 'By the time Bagong finishes the story, Arjuna is not in it at all. Petruk laughs so hard he falls over. In Astina, nobody is laughing.',
  },
  {
    lakon: W2,
    title: "Duryudana's envy",
    scene: 'In Astina the king hears of Arjuna and plots with his uncle.',
    cast: ['duryudana', 'sengkuni', 'arjuna'],
    decoys: ['yudhistira', 'cakil'],
    tale: 'Duryudana cannot bear another tale of Arjuna. Sengkuni has a plan, as always. But a god is already on his way to the mountain.',
  },
  {
    lakon: W2,
    title: "Batara Guru's gift",
    scene:
      'The king of the gods tests Arjuna, then lends him the arrow to end the giant king.',
    cast: ['guru', 'arjuna', 'buta'],
    decoys: ['bima', 'duryudana'],
    tale: 'Batara Guru disguises himself as a hunter and fights Arjuna over a boar, then reveals himself and gives him the Pasopati arrow. With it, Arjuna ends the giant king. Next week the story starts again, and the old servant opens the screen.',
  },
];

const PAR: [number, number][] = [
  [3, 5],
  [4, 7],
  [6, 9],
  [7, 10],
  [8, 12],
  [10, 14],
  [12, 16],
];
const TILTS: number[][] = [
  [0],
  [0],
  [0, 0, 1, 7],
  [0, 1, 7],
  [0, 1, 7],
  [0, 1, 7, 2, 6],
  [0, 1, 7, 2, 6],
];

// mulberry32
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const touchesEdge = (m: Mask): boolean => {
  for (let j = 0; j < GH; j++)
    if (getBit(m, 0, j) || getBit(m, GW - 1, j)) return true;
  for (let i = 0; i < GW; i++) if (getBit(m, i, GH - 1)) return true;
  return false;
};

/** each puppet in the answer must keep at least `share` of its shadow visible */
const visibleShares = (cast: string[], poses: Pose[]): number[] =>
  cast.map((id, k) => {
    const own = new Uint32Array(puppetMask(id, poses[k]!));
    const others = emptyMask();
    cast.forEach((o, n) => {
      if (n !== k) orInto(others, puppetMask(o, poses[n]!));
    });
    const total = count(own);
    andNotInto(own, others);
    return count(own) / total;
  });

/** the best share of a decoy's shadow that can lie inside the target */
const bestFit = (id: string, target: Mask): number => {
  let best = 0;
  const tmp = emptyMask();
  for (let i = 0; i < POSES; i++) {
    const m = puppetMask(id, poseFromIndex(i));
    const total = count(m);
    if (total === 0) continue;
    tmp.set(m);
    andNotInto(tmp, target);
    best = Math.max(best, 1 - count(tmp) / total);
  }
  return best;
};

/** from Wednesday, puppets overlap: one hides part of another (and its holes) */
const OVERLAP_FROM = 2;
const MIN_HIDDEN = 0.15;
/** from Thursday, at least one decoy almost fits */
const NEAR_MISS_FROM = 3;
const NEAR_MISS = 0.86;

const build = (
  spec: Spec,
  index: number,
  weekday: number,
  seed: number
): PuzzleDef => {
  const r = rng(seed);
  const pick = <T>(xs: T[]): T => xs[Math.floor(r() * xs.length)]!;
  const offered = [...spec.cast, ...spec.decoys];
  // shuffle the chest so the answer is not always first
  for (let k = offered.length - 1; k > 0; k--) {
    const n = Math.floor(r() * (k + 1));
    [offered[k], offered[n]] = [offered[n]!, offered[k]!];
  }
  const [lo, hi] = PAR[weekday]!;
  for (let attempt = 0; attempt < 20000; attempt++) {
    const goal: Pose[] = spec.cast.map(() => ({
      x: Math.floor(r() * SLOTS),
      d: Math.floor(r() * DEPTHS),
      a: (pick(TILTS[weekday]!) + 8) % 8,
      arm: Math.floor(r() * 3),
      flip: r() < 0.35,
    }));
    if (goal.some((g, k) => touchesEdge(puppetMask(spec.cast[k]!, g))))
      continue;
    const shares = visibleShares(spec.cast, goal);
    if (shares.some((s) => s < 0.45)) continue;
    if (
      weekday >= OVERLAP_FROM &&
      spec.cast.length > 1 &&
      Math.max(...shares.map((s) => 1 - s)) < MIN_HIDDEN
    )
      continue;
    const solution: Slot[] = offered.map((id) => {
      const k = spec.cast.indexOf(id);
      return k >= 0 ? goal[k]! : null;
    });
    const start: Slot[] = offered.map((id): Slot => {
      const onStage = spec.cast.includes(id) ? r() < 0.7 : r() < 0.5;
      if (!onStage) return null;
      return {
        x: Math.floor(r() * SLOTS),
        d: Math.floor(r() * DEPTHS),
        a: 0,
        arm: Math.floor(r() * 3),
        flip: r() < 0.3,
      };
    });
    if (!start.some((s) => s !== null))
      start[offered.indexOf(spec.cast[0]!)] = { ...DEFAULT_POSE };
    const par = parOf(start, solution);
    if (par < lo || par > hi) continue;
    const target = shadowOf(offered, solution);
    if (count(shadowOf(offered, start)) === 0) continue;
    if (
      weekday >= NEAR_MISS_FROM &&
      Math.max(...spec.decoys.map((d) => bestFit(d, target))) < NEAR_MISS
    )
      continue;
    const { solutions } = solve(offered, target, 2);
    if (solutions.length !== 1) continue;
    const id =
      index < 0
        ? 'warmup'
        : `${spec.lakon === W1 ? 'w1' : 'w2'}-${weekday + 1}`;
    console.log(
      `${id.padEnd(7)} ${spec.title.padEnd(32)} par ${par}  (attempt ${attempt})`
    );
    return {
      id,
      index,
      lakon: spec.lakon,
      title: spec.title,
      scene: spec.scene,
      weekday,
      offered,
      start,
      par,
      target: encodeMask(target),
      solution,
      cards: [...spec.cast],
      tale: spec.tale,
    };
  }
  throw new Error(`no unique puzzle found for ${spec.title}`);
};

const warmup = (): PuzzleDef => {
  const offered = ['semar'];
  const start: Slot[] = [{ ...DEFAULT_POSE }];
  const solution: Slot[] = [{ ...DEFAULT_POSE, d: 3, arm: 2 }];
  const target = shadowOf(offered, solution);
  if (solve(offered, target, 2).solutions.length !== 1)
    throw new Error('warm-up is not unique');
  return {
    id: 'warmup',
    index: -1,
    lakon: 'Warm-up',
    title: 'Wake Semar',
    scene: 'Move Semar so his shadow fills the outline exactly.',
    weekday: 0,
    offered,
    start,
    par: parOf(start, solution),
    target: encodeMask(target),
    solution,
    cards: ['semar'],
    tale: 'That is all a dalang does: light, a puppet, and a shadow that tells the story.',
  };
};

const main = () => {
  const bank = {
    warmup: warmup(),
    puzzles: STORY.map((s, k) => build(s, k, k % 7, 1000 + k * 7919)),
  };
  const out = fileURLToPath(
    new URL('../src/shared/bank.json', import.meta.url)
  );
  writeFileSync(out, JSON.stringify(bank, null, 1) + '\n');
  console.log(`wrote ${out}`);
};

main();
