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
import type { Joints } from '../src/shared/figures.ts';
import {
  BASES,
  DEFAULT_POSE,
  DEPTHS,
  JOINT_SETS,
  SLOTS,
  jointChoices,
  partMask,
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
  /** the heirloom this scene gives */
  pusaka: string;
};

const W1 = 'Bima Suci';
const W2 = 'Arjuna Wiwaha';
const W3 = 'Hanoman Duta';

export const STORY: Spec[] = [
  {
    lakon: W1,
    title: 'Semar greets the night',
    scene:
      'After the kayon is lifted, the old servant steps out first. Cast his shadow.',
    cast: ['semar'],
    decoys: ['gareng'],
    tale: 'Semar laughs and the night begins. In Astina, King Duryudana wants Bima gone before the great war, and the teacher Durna has an idea: send him to find the water of life. Who will Durna call?',
    pusaka: 'kayon',
  },
  {
    lakon: W1,
    title: "Durna's errand",
    scene:
      'Durna says the water of life waits on Mount Candramuka. Bima will go, wherever it hides.',
    cast: ['bima'],
    decoys: ['arjuna', 'buta'],
    tale: "Durna swears the water, Tirta Pawitra, lies in a cave on Mount Candramuka. Bima's brothers smell a trap. Bima bows to his teacher and simply walks. But the mountain is not empty.",
    pusaka: 'rujakpolo',
  },
  {
    lakon: W1,
    title: 'The giants of Candramuka',
    scene:
      'Bima tears the cave apart, and a giant of the mountain wakes. Bima walks straight in.',
    cast: ['bima', 'buta'],
    decoys: ['cakil', 'duryudana'],
    tale: "The giants Rukmuka and Rukmakala rush at him, and Bima knocks their heads together. Where they fall, the gods Indra and Bayu stand, freed from Batara Guru's curse. “There is no water here,” they say. On the way down, another giant waits in the trees.",
    pusaka: 'pancanaka',
  },
  {
    lakon: W1,
    title: 'Bima against Cakil',
    scene:
      'On the road home, quick Cakil leaps out to bar the way. Only one of the two will stand.',
    cast: ['bima', 'cakil'],
    decoys: ['arjuna', 'buta'],
    tale: 'Cakil spins in, all twirls and knife. Bima does not dance. Like every Cakil, the giant ends on his own keris. Bima stamps back to Astina, and somewhere behind him two familiar voices are arguing.',
    pusaka: 'keris-cakil',
  },
  {
    lakon: W1,
    title: 'Goro-goro on the mountain',
    scene:
      "The clowns' interlude: Petruk and Gareng argue about the water of life.",
    cast: ['petruk', 'gareng'],
    decoys: ['bagong', 'semar', 'sengkuni'],
    tale: 'Gareng says the water was a trick; Petruk says a teacher never lies. They settle it with a song and a fall. In Astina, Durna tells Bima the mountain was only a test: the real water lies at the bottom of the sea. Someone in the palace is smiling.',
    pusaka: 'kentongan',
  },
  {
    lakon: W1,
    title: 'The Kurawa court',
    scene: 'In Astina, Sengkuni and his king hope the sea will swallow Bima.',
    cast: ['sengkuni', 'duryudana', 'bima'],
    decoys: ['yudhistira', 'arjuna'],
    tale: 'Sengkuni whispers to Duryudana: no man comes back from the deep. Bima walks into the waves anyway, and the naga Nemburnawa coils around him. He tears it apart with his thumbnail Pancanaka. Then, in the quiet of the deep, someone small speaks his name.',
    pusaka: 'dadu',
  },
  {
    lakon: W1,
    title: 'Dewaruci in the sea',
    scene:
      "At the bottom of the sea, a god with Bima's own face waits, no bigger than his palm.",
    cast: ['dewaruci', 'bima', 'semar'],
    decoys: ['guru', 'bagong'],
    tale: 'Dewaruci tells Bima to enter his left ear. Inside lies a world wider than the sea, and there Bima learns the water of life was never outside him. He comes home calm. Next week, on Mount Indrakila, another Pandawa sits down to be still.',
    pusaka: 'tirta',
  },
  {
    lakon: W2,
    title: 'Arjuna on Indrakila',
    scene:
      'Arjuna climbs Mount Indrakila alone to meditate as the hermit Begawan Ciptoning.',
    cast: ['arjuna'],
    decoys: ['nakula'],
    tale: 'Mpu Kanwa told it in Old Javanese almost a thousand years ago: Arjuna goes up the mountain to ask the gods for a weapon, so his brothers can win back what the Kurawa took. Before he goes, the eldest brother has one thing to say.',
    pusaka: 'pulanggeni',
  },
  {
    lakon: W2,
    title: "The eldest brother's blessing",
    scene: 'Yudhistira lets his brother go with a quiet word.',
    cast: ['yudhistira'],
    decoys: ['sadewa', 'sengkuni'],
    tale: 'Yudhistira gives Arjuna his blessing and a warning: the gods will test you. While Arjuna is gone, the camp needs guards.',
    pusaka: 'kalimasada',
  },
  {
    lakon: W2,
    title: 'The twins keep watch',
    scene: 'Nakula and Sadewa guard the camp while Arjuna is away.',
    cast: ['nakula', 'sadewa'],
    decoys: ['arjuna', 'gareng'],
    tale: "Nakula and Sadewa watch all night, and nothing comes. On the mountain, Indra sends seven nymphs of heaven, Supraba and Tilotama among them, to break Arjuna's stillness. He does not open his eyes. Then something less lovely comes out of the forest.",
    pusaka: 'gandewa',
  },
  {
    lakon: W2,
    title: 'The flower battle',
    scene:
      'The perang kembang: Cakil leaps from the forest at the quiet knight.',
    cast: ['arjuna', 'cakil'],
    decoys: ['bima', 'buta'],
    tale: 'Cakil spins and slashes; Arjuna barely moves. As in every flower battle, the giant falls on his own keris. Then an old brahmin climbs the path and asks Arjuna why he wants a weapon. Arjuna answers well, and the old man is Indra. Down in the village, Bagong heard it all wrong.',
    pusaka: 'wijayakusuma',
  },
  {
    lakon: W2,
    title: 'Bagong tells it wrong',
    scene:
      'Goro-goro: Bagong retells the battle to Petruk, and wins it himself.',
    cast: ['bagong', 'petruk'],
    decoys: ['gareng', 'semar', 'sengkuni'],
    tale: 'By the time Bagong finishes, Arjuna is not in the story and all seven nymphs wanted Bagong. Petruk laughs so hard he falls over. In Astina, nobody is laughing.',
    pusaka: 'kendhi',
  },
  {
    lakon: W2,
    title: "Duryudana's envy",
    scene:
      'In the Kurawa court the king hears of Arjuna and plots with his uncle.',
    cast: ['duryudana', 'sengkuni', 'arjuna'],
    decoys: ['yudhistira', 'cakil'],
    tale: 'Duryudana fears what Arjuna will bring down from the mountain. Sengkuni has a plan, as always. But the gods have their own: the giant king Niwatakawaca threatens heaven, and only a man can kill him. Someone is already hunting on Indrakila.',
    pusaka: 'gada-inten',
  },
  {
    lakon: W2,
    title: "Batara Guru's gift",
    scene:
      'A hunter fights Arjuna over a boar. He is the king of the gods, and the giant king is next.',
    cast: ['guru', 'arjuna', 'buta'],
    decoys: ['bima', 'duryudana'],
    tale: "Arjuna and the hunter shoot the same boar, quarrel and fight, until the hunter shows his true face: Batara Guru, who gives him the arrow Pasopati. With Supraba's help Arjuna learns the giant king's secret and shoots him through the tip of his tongue. Next week, across the sea, a prince has lost everything.",
    pusaka: 'pasopati',
  },
  {
    lakon: W3,
    title: "Rama's grief",
    scene:
      'Rama has lost Sinta in the forest. He strings his bow and does not know where to aim.',
    cast: ['rama'],
    decoys: ['arjuna'],
    tale: 'The dying bird Jatayu told him: the giant king of Alengka took her. Now Rama waits in his camp at Maliawan with the monkey king Sugriwa and his army. One white monkey steps forward and bows.',
    pusaka: 'guwawijaya',
  },
  {
    lakon: W3,
    title: "The white monkey's vow",
    scene: 'Hanoman swears to find Sinta. Rama gives him one thing to carry.',
    cast: ['hanoman'],
    decoys: ['bima', 'buta'],
    tale: "Rama puts his ring in Hanoman's hand: show her this, and she will know you come from me. Hanoman climbs a mountain by the shore. Between him and Alengka lies the whole sea.",
    pusaka: 'ampal',
  },
  {
    lakon: W3,
    title: 'Across the sea',
    scene:
      'Hanoman leaps from the mountain. A giant rises from the waves to swallow him.',
    cast: ['hanoman', 'buta'],
    decoys: ['cakil', 'rahwana'],
    tale: 'The sea giant opens its mouth; Hanoman flies in and out again. On the far shore the lovely Sayempraba feeds him, and her food blinds him, until the old bird Sempati gives him back his sight. Ahead, Alengka glows. Somewhere inside is a garden.',
    pusaka: 'poleng',
  },
  {
    lakon: W3,
    title: 'The garden of Argasoka',
    scene:
      'Sinta sits in the Argasoka garden. A monkey in the branches shows her a ring.',
    cast: ['sinta', 'hanoman'],
    decoys: ['arjuna', 'bagong'],
    tale: 'Sinta weeps, then laughs, then takes a jewel from her hair: give him this, and tell him I wait. Hanoman could carry her home, but she says Rama himself must come. Then Hanoman lets the giants see him.',
    pusaka: 'konde',
  },
  {
    lakon: W3,
    title: 'Hanoman Obong',
    scene:
      "Caught by Rahwana's son Indrajit, Hanoman lets the giants tie oiled cloth to his tail and light it.",
    cast: ['hanoman', 'buta'],
    decoys: ['cakil', 'rahwana', 'bima'],
    tale: 'Hanoman slips his bonds and leaps from roof to roof with his burning tail, and Alengka burns. The dalang calls this night Hanoman Obong. From his throne, the giant king watches his city glow.',
    pusaka: 'obor',
  },
  {
    lakon: W3,
    title: "The giant king's rage",
    scene:
      'Rahwana roars at his giants: find the monkey. His crown has never felt so heavy.',
    cast: ['rahwana', 'buta', 'cakil'],
    decoys: ['duryudana', 'guru'],
    tale: 'Rahwana swears that no monkey and no prince will take what he has taken. His brother Wibisana begs him to give Sinta back, and is driven out. But the monkey is already over the sea.',
    pusaka: 'mahkota',
  },
  {
    lakon: W3,
    title: 'Hanoman returns',
    scene: "Hanoman lands at Rama's feet with a jewel and a story.",
    cast: ['hanoman', 'rama', 'semar'],
    decoys: ['bima', 'arjuna'],
    tale: "Rama holds Sinta's jewel and, for the first time in many nights, weeps and smiles. The monkeys begin a causeway across the sea, and the war for Alengka can begin. Next week the dalang lights the lamp again, and Semar steps out to greet the night.",
    pusaka: 'astagina',
  },
];

const PAR: [number, number][] = [
  [3, 5],
  [4, 7],
  [6, 10],
  [8, 12],
  [9, 14],
  [11, 16],
  [12, 18],
];
/** which joints move each weekday: shoulder, + elbow, + back arm, + head */
const JOINTS = [0, 1, 1, 2, 2, 3, 3];

const randomJoints = (r: () => number, level: number): Joints => {
  const c = jointChoices(level);
  const pick = (xs: number[]) => xs[Math.floor(r() * xs.length)]!;
  return {
    arm: pick(c.arm),
    elbow: pick(c.elbow),
    back: pick(c.back),
    backElbow: pick(c.backElbow),
    head: pick(c.head),
  };
};
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

/** Sunday is a two-lamp night */
const lampsFor = (weekday: number) => (weekday === 6 ? 2 : 1);

const touchesEdge = (m: Mask): boolean => {
  for (let j = 0; j < GH; j++)
    if (getBit(m, 0, j) || getBit(m, GW - 1, j)) return true;
  for (let i = 0; i < GW; i++) if (getBit(m, i, GH - 1)) return true;
  return false;
};

/** each puppet in the answer must keep at least `share` of its shadow visible */
const visibleShares = (
  cast: string[],
  poses: Pose[],
  lamps: number
): number[] =>
  cast.map((id, k) => {
    const own = new Uint32Array(puppetMask(id, poses[k]!, lamps));
    const others = emptyMask();
    cast.forEach((o, n) => {
      if (n !== k) orInto(others, puppetMask(o, poses[n]!, lamps));
    });
    const total = count(own);
    andNotInto(own, others);
    return count(own) / total;
  });

/** the best share of a decoy's shadow that can lie inside the target */
/** the best share of a decoy's body shadow that can lie inside the target */
const bestFit = (id: string, target: Mask, lamps: number): number => {
  let best = 0;
  const tmp = emptyMask();
  for (let b = 0; b < BASES; b++) {
    const base = poseFromIndex(b * JOINT_SETS);
    for (const head of [0, 1, 2]) {
      const m = partMask(id, { ...base, head }, 'body', lamps);
      const total = count(m);
      if (total === 0) continue;
      tmp.set(m);
      andNotInto(tmp, target);
      best = Math.max(best, 1 - count(tmp) / total);
    }
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
  const lamps = lampsFor(weekday);
  const level = JOINTS[weekday]!;
  for (let attempt = 0; attempt < 20000; attempt++) {
    const goal: Pose[] = spec.cast.map(() => ({
      x: Math.floor(r() * SLOTS),
      d: Math.floor(r() * DEPTHS),
      a: (pick(TILTS[weekday]!) + 8) % 8,
      flip: r() < 0.35,
      ...randomJoints(r, level),
    }));
    if (goal.some((g, k) => touchesEdge(puppetMask(spec.cast[k]!, g, lamps))))
      continue;
    const shares = visibleShares(spec.cast, goal, lamps);
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
        flip: r() < 0.3,
        ...randomJoints(r, level),
      };
    });
    if (!start.some((s) => s !== null))
      start[offered.indexOf(spec.cast[0]!)] = { ...DEFAULT_POSE };
    const par = parOf(start, solution);
    if (par < lo || par > hi) continue;
    const target = shadowOf(offered, solution, lamps);
    if (count(shadowOf(offered, start, lamps)) === 0) continue;
    if (
      weekday >= NEAR_MISS_FROM &&
      Math.max(...spec.decoys.map((d) => bestFit(d, target, lamps))) < NEAR_MISS
    )
      continue;
    const { solutions } = solve(offered, target, 2, lamps, level);
    if (solutions.length !== 1) continue;
    const id =
      index < 0
        ? 'warmup'
        : `${spec.lakon === W1 ? 'w1' : spec.lakon === W2 ? 'w2' : 'w3'}-${weekday + 1}`;
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
      lamps,
      joints: level,
      target: encodeMask(target),
      solution,
      cards: [spec.pusaka],
      cast: [...spec.cast],
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
  if (solve(offered, target, 2, 1, 0).solutions.length !== 1)
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
    lamps: 1,
    joints: 0,
    target: encodeMask(target),
    solution,
    cards: ['blencong'],
    cast: ['semar'],
    tale: 'That is all a dalang does: a lamp, a puppet, and a shadow that tells the story. In Java a show like this runs from dusk until dawn.',
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
  // the story text alone (no answers), for the book in the post
  const tales = [bank.warmup, ...bank.puzzles].map((p) => ({
    id: p.id,
    lakon: p.lakon,
    title: p.title,
    weekday: p.weekday,
    tale: p.tale,
    pusaka: p.cards[0]!,
  }));
  writeFileSync(
    fileURLToPath(new URL('../src/shared/tales.json', import.meta.url)),
    JSON.stringify(tales, null, 1) + '\n'
  );
  console.log(`wrote ${out}`);
};

main();
