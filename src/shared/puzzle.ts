import { figure } from './figures.ts';
import {
  GW,
  count,
  decodeMask,
  emptyMask,
  equal,
  orInto,
  subsetOf,
  type Mask,
} from './grid.ts';
import {
  ANGLES,
  ARMS,
  BASES,
  DEFAULT_POSE,
  JOINT_KEYS,
  JOINT_LEVELS,
  JOINT_SETS,
  jointChoices,
  partMask,
  poseFromIndex,
  puppetMask,
  placedByLamp,
  sceneMask,
  type Placement,
  type PlacedPolys,
  type Pose,
} from './shadow.ts';

export type Slot = Pose | null;

/** What the post needs to play a puzzle. The answer is not in here. */
export type PuzzlePublic = {
  id: string;
  /** -1 for the warm-up, else position in the bank */
  index: number;
  lakon: string;
  title: string;
  scene: string;
  weekday: number; // 0 = Monday
  offered: string[];
  start: Slot[];
  par: number;
  /** 1, or 2 on two-lamp nights (every puppet casts two shadows) */
  lamps: number;
  /** which joints move: 0 front shoulder, 1 + elbow, 2 + back arm, 3 + head */
  joints: number;
  /** run-length encoded target shadow: what the match is checked against */
  target: string;
  /** the same target as outlines, only for drawing it smoothly */
  targetShapes: PlacedPolys[];
};

export type PuzzleDef = Omit<PuzzlePublic, 'targetShapes'> & {
  solution: Slot[];
  /** the story chapter, told only after the solve */
  tale: string;
  /** the pusaka this scene gives */
  cards: string[];
  /** the wayang in the answer (kept on the server: it names the decoys) */
  cast: string[];
};

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
/** difficulty climbs through the week */
export const LEVELS = [
  'Gentle',
  'Easy',
  'Steady',
  'Tricky',
  'Hard',
  'Harder',
  'Fiendish',
];

export const toPublic = (p: PuzzleDef): PuzzlePublic => ({
  id: p.id,
  index: p.index,
  lakon: p.lakon,
  title: p.title,
  scene: p.scene,
  weekday: p.weekday,
  offered: p.offered,
  start: p.start,
  par: p.par,
  lamps: p.lamps,
  joints: p.joints,
  target: p.target,
  targetShapes: shapesOf(p.offered, p.solution, p.lamps),
});

const round = (q: number[]) => q.map((v) => Math.round(v * 100) / 100);

/** outlines of every puppet on stage, in kelir cells */
export const shapesOf = (
  offered: readonly string[],
  slots: readonly Slot[],
  lamps = 1
): PlacedPolys[] =>
  offered.flatMap((id, k) => {
    const pose = slots[k];
    if (!pose) return [];
    return placedByLamp(figure(id), pose, lamps).map((s) => ({
      ...s,
      solids: s.solids.map(round),
      holes: s.holes.map(round),
    }));
  });

export const placements = (
  offered: readonly string[],
  slots: readonly Slot[]
): Placement[] => offered.map((id, k) => ({ id, pose: slots[k] ?? null }));

export const shadowOf = (
  offered: readonly string[],
  slots: readonly Slot[],
  lamps = 1
): Mask => sceneMask(placements(offered, slots), lamps);

export const isSolved = (
  p: { offered: readonly string[]; target: string; lamps?: number },
  slots: readonly Slot[]
): boolean =>
  equal(shadowOf(p.offered, slots, p.lamps ?? 1), decodeMask(p.target));

// --- moves -------------------------------------------------------------------

/**
 * Moves are taps: slot ±1, depth ±1, tilt ±45°, arm (cycles down→forward→up),
 * flip, put on stage (always at DEFAULT_POSE) and take off stage.
 */
export const poseDistance = (a: Pose, b: Pose): number => {
  const da = Math.abs(a.a - b.a);
  // every joint taps forward through its three positions
  const joints = JOINT_KEYS.reduce(
    (n, k) => n + ((b[k] - a[k] + ARMS) % ARMS),
    0
  );
  return (
    Math.abs(a.x - b.x) +
    Math.abs(a.d - b.d) +
    Math.min(da, ANGLES - da) +
    joints +
    (a.flip === b.flip ? 0 : 1)
  );
};

export const slotDistance = (from: Slot, to: Slot): number => {
  if (!from && !to) return 0;
  if (from && !to) return 1;
  if (!from && to) return 1 + poseDistance(DEFAULT_POSE, to);
  // both on stage: walk there, or lift it out and put it back fresh
  return Math.min(
    poseDistance(from!, to!),
    2 + poseDistance(DEFAULT_POSE, to!)
  );
};

/** Fewest taps from the start to the answer (moves are independent per puppet). */
export const parOf = (
  start: readonly Slot[],
  solution: readonly Slot[]
): number =>
  solution.reduce<number>(
    (sum, s, k) => sum + slotDistance(start[k] ?? null, s),
    0
  );

// --- solver ------------------------------------------------------------------

export type SolveResult = { solutions: Slot[][]; candidates: number[] };

/**
 * Every way the offered puppets can cast exactly the target. Stops after
 * `limit` answers. Since shadows only add up, a puppet in an answer must cast
 * a shadow entirely inside the target, which keeps the search small.
 */
export const solve = (
  offered: readonly string[],
  target: Mask,
  limit = 2,
  lamps = 1,
  level = JOINT_LEVELS - 1
): SolveResult => {
  const choice = jointChoices(level);
  const fits = (m: Mask) => count(m) > 0 && subsetOf(m, target);
  // per puppet: every pose whose body and both arms each fit inside the target
  const cands: { pose: Pose; mask: Mask }[][] = offered.map((id) => {
    const out: { pose: Pose; mask: Mask }[] = [];
    for (let b = 0; b < BASES; b++) {
      const base = poseFromIndex(b * JOINT_SETS);
      const heads = choice.head.filter((head) =>
        fits(partMask(id, { ...base, head }, 'body', lamps))
      );
      if (heads.length === 0) continue;
      const fronts: [number, number][] = [];
      for (const arm of choice.arm)
        for (const elbow of choice.elbow)
          if (fits(partMask(id, { ...base, arm, elbow }, 'front', lamps)))
            fronts.push([arm, elbow]);
      if (fronts.length === 0) continue;
      const backs: [number, number][] = [];
      for (const back of choice.back)
        for (const backElbow of choice.backElbow)
          if (fits(partMask(id, { ...base, back, backElbow }, 'back', lamps)))
            backs.push([back, backElbow]);
      if (backs.length === 0) continue;
      for (const head of heads)
        for (const [arm, elbow] of fronts)
          for (const [back, backElbow] of backs) {
            const pose: Pose = { ...base, head, arm, elbow, back, backElbow };
            out.push({ pose, mask: puppetMask(id, pose, lamps) });
          }
    }
    return out;
  });
  // what each suffix of puppets could still cover, for pruning
  const reach: Mask[] = [];
  for (let k = offered.length; k >= 0; k--) {
    const m = emptyMask();
    if (k < offered.length) {
      orInto(m, reach[k + 1]!);
      for (const c of cands[k]!) orInto(m, c.mask);
    }
    reach[k] = m;
  }
  const solutions: Slot[][] = [];
  const chosen: Slot[] = offered.map(() => null);
  const tmp = emptyMask();
  const walk = (k: number, acc: Mask) => {
    if (solutions.length >= limit) return;
    if (k === offered.length) {
      if (equal(acc, target)) solutions.push([...chosen]);
      return;
    }
    tmp.set(acc);
    orInto(tmp, reach[k]!);
    if (!subsetOf(target, tmp)) return;
    chosen[k] = null;
    walk(k + 1, acc);
    for (const c of cands[k]!) {
      const next = new Uint32Array(acc);
      orInto(next, c.mask);
      chosen[k] = c.pose;
      walk(k + 1, next);
      if (solutions.length >= limit) break;
    }
    chosen[k] = null;
  };
  walk(0, emptyMask());
  return { solutions, candidates: cands.map((c) => c.length) };
};

// --- the calendar ---------------------------------------------------------------

/** Monday 23 November 2026, UTC: day 0 of the bank. */
export const ANCHOR_UTC = Date.UTC(2026, 10, 23);
const DAY_MS = 86_400_000;

export const dayNumber = (now: number): number =>
  Math.floor((now - ANCHOR_UTC) / DAY_MS);

export const bankIndexForDay = (day: number, bankSize: number): number =>
  ((day % bankSize) + bankSize) % bankSize;

export const dateLabel = (day: number): string => {
  const d = new Date(ANCHOR_UTC + day * DAY_MS);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
};

// --- Semar's hints ----------------------------------------------------------------

const ARM_WORD = ['hanging down', 'reaching forward', 'raised'];
const ELBOW_WORD = ['straight', 'bent', 'folded back'];
const HEAD_WORD = ['', ', head bowed', ', head raised'];
const DEPTH_WORD = [
  'far from the lamp',
  'a little far',
  'in the middle',
  'close to the lamp',
  'right against the lamp',
];

/** Hints in order: from gentle to almost the answer. */
export const hintsFor = (p: PuzzleDef): string[] => {
  const out: string[] = [];
  const unused = p.offered.filter((_, k) => !p.solution[k]);
  const used = p.offered
    .map((id, k) => ({ id, pose: p.solution[k] }))
    .filter((u): u is { id: string; pose: Pose } => !!u.pose);
  if (unused.length > 0) {
    out.push(`${figure(unused[0]!).name} does not belong in this scene.`);
  } else {
    out.push('Every puppet in the chest belongs in this scene.');
  }
  for (const u of used) {
    const f = figure(u.id);
    const facing = u.pose.flip ? 'facing left' : 'facing right';
    out.push(
      `${f.name} stands ${DEPTH_WORD[u.pose.d]}, ${facing}, front arm ${ARM_WORD[u.pose.arm]}${p.joints >= 1 ? ` and ${ELBOW_WORD[u.pose.elbow]}` : ''}${p.joints >= 2 ? `, back arm ${ARM_WORD[u.pose.back]}` : ''}${p.joints >= 3 ? HEAD_WORD[u.pose.head] : ''}.`
    );
  }
  if (unused.length > 1)
    out.push(
      `${unused
        .slice(1)
        .map((id) => figure(id).name)
        .join(' and ')} are decoys too.`
    );
  return out.slice(0, 3);
};

/** columns of a mask's dark cells (used by tests and the generator) */
export const maskWidth = (m: Mask): number => {
  let lo = GW;
  let hi = -1;
  for (let b = 0; b < m.length * 32; b++) {
    if ((m[b >>> 5]! >>> (b & 31)) & 1) {
      const i = b % GW;
      if (i < lo) lo = i;
      if (i > hi) hi = i;
    }
  }
  return hi < lo ? 0 : hi - lo + 1;
};
