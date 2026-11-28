import {
  FIGURES,
  REST,
  armPolys,
  figure,
  figureParts,
  type Figure,
  type Joints,
} from './figures.ts';
import {
  GH,
  GW,
  andNotInto,
  emptyMask,
  fillPolys,
  orInto,
  type Mask,
  type Poly,
} from './grid.ts';

/**
 * A puppet's place in front of the lamp. Every value snaps:
 *  x     0..6  which rod slot along the banana trunk
 *  d     0..4  depth: 4 is closest to the lamp (biggest shadow)
 *  a     0..7  tilt in 45 degree steps
 *  flip        facing left instead of right
 * and its joints (see Joints): two shoulders, two elbows and the head,
 * each 0..2.
 */
export type Pose = Joints & {
  x: number;
  d: number;
  a: number;
  flip: boolean;
};

export const SLOTS = 7;
export const DEPTHS = 5;
export const ANGLES = 8;
/** positions per joint */
export const ARMS = 3;
export const JOINT_KEYS = [
  'arm',
  'elbow',
  'back',
  'backElbow',
  'head',
] as const;
export const BASES = SLOTS * DEPTHS * ANGLES * 2;
export const JOINT_SETS = ARMS ** JOINT_KEYS.length;
export const POSES = BASES * JOINT_SETS;

export const DEPTH_SCALE = [0.78, 0.89, 1.0, 1.12, 1.25];
export const LAMP_X = GW / 2;
export const BASELINE = 6;
/** shadow height of a 1-unit figure at depth 2, in cells */
export const UNIT = 76;

export const DEFAULT_POSE: Pose = { x: 3, d: 2, a: 0, flip: false, ...REST };

export const slotX = (x: number): number => 28 + x * 24;

export const baseIndex = (p: Pose): number =>
  ((p.x * DEPTHS + p.d) * ANGLES + p.a) * 2 + (p.flip ? 1 : 0);

export const jointIndex = (p: Joints): number =>
  JOINT_KEYS.reduce((n, k) => n * ARMS + p[k], 0);

export const poseIndex = (p: Pose): number =>
  baseIndex(p) * JOINT_SETS + jointIndex(p);

export const poseFromIndex = (i: number): Pose => {
  let j = i % JOINT_SETS;
  let b = Math.floor(i / JOINT_SETS);
  const joints = {} as Joints;
  for (let k = JOINT_KEYS.length - 1; k >= 0; k--) {
    joints[JOINT_KEYS[k]!] = j % ARMS;
    j = Math.floor(j / ARMS);
  }
  const flip = b % 2 === 1;
  b = Math.floor(b / 2);
  const a = b % ANGLES;
  b = Math.floor(b / ANGLES);
  const d = b % DEPTHS;
  const x = Math.floor(b / DEPTHS);
  return { x, d, a, flip, ...joints };
};

export const samePose = (p: Pose, q: Pose): boolean =>
  poseIndex(p) === poseIndex(q);

/**
 * Which joints a puzzle lets you move. The week opens with one shoulder and
 * adds the elbow, the back arm and the head as it gets harder:
 *  0 front shoulder · 1 + front elbow · 2 + back arm · 3 + head
 */
export const JOINT_LEVELS = 4;
export const jointChoices = (level: number): Record<keyof Joints, number[]> => {
  const all = [0, 1, 2];
  const rest = [0];
  return {
    arm: all,
    elbow: level >= 1 ? all : rest,
    back: level >= 2 ? all : rest,
    backElbow: level >= 2 ? all : rest,
    head: level >= 3 ? all : rest,
  };
};
/** a pose from outside (the post, a saved answer) is well formed */
export const isPose = (v: unknown): v is Pose => {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  const int = (x: unknown, n: number) =>
    Number.isInteger(x) && (x as number) >= 0 && (x as number) < n;
  return (
    int(p.x, SLOTS) &&
    int(p.d, DEPTHS) &&
    int(p.a, ANGLES) &&
    typeof p.flip === 'boolean' &&
    JOINT_KEYS.every((k) => int(p[k], ARMS))
  );
};

export const jointsAllowed = (p: Joints, level: number): boolean => {
  const c = jointChoices(level);
  return JOINT_KEYS.every((k) => c[k].includes(p[k]));
};

/** Frame-to-kelir transform for a pose. */
export const poseTransform = (f: Figure, p: Pose) => {
  const s = DEPTH_SCALE[p.d]! * UNIT;
  const cx = LAMP_X + (slotX(p.x) - LAMP_X) * DEPTH_SCALE[p.d]!;
  const pivotY = f.height * 0.5;
  // tilt: positive steps lean the figure back (counter-clockwise when facing right)
  const ang = (p.a * Math.PI) / 4;
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const fl = p.flip ? -1 : 1;
  return (x: number, y: number): [number, number] => {
    const fx = x * fl;
    const fy = y - pivotY;
    const rx = fx * c - fy * sn;
    const ry = fx * sn + fy * c + pivotY;
    return [cx + rx * s, BASELINE + ry * s];
  };
};

/**
 * The same transform as poseTransform written as a 2D affine matrix
 * (x' = a x + c y + e, y' = b x + d y + f), for painting a puppet in its pose.
 */
export const poseAffine = (f: Figure, p: Pose) => {
  const m = DEPTH_SCALE[p.d]!;
  const s = m * UNIT;
  const cx = LAMP_X + (slotX(p.x) - LAMP_X) * m;
  const pv = f.height * 0.5;
  const ang = (p.a * Math.PI) / 4;
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const fl = p.flip ? -1 : 1;
  return {
    a: s * fl * c,
    b: s * fl * sn,
    c: -s * sn,
    d: s * c,
    e: cx + s * pv * sn,
    f: BASELINE + s * (pv - pv * c),
  };
};

const mapPoly = (
  poly: Poly,
  t: (x: number, y: number) => [number, number]
): Poly => {
  const out: Poly = new Array<number>(poly.length);
  for (let k = 0; k < poly.length; k += 2) {
    const [x, y] = t(poly[k]!, poly[k + 1]!);
    out[k] = x;
    out[k + 1] = y;
  }
  return out;
};

/** `lamp` 1 marks the second lamp's copy of a shadow (two-lamp nights) */
export type PlacedPolys = { solids: Poly[]; holes: Poly[]; lamp?: number };

/**
 * Two-lamp nights: a second blencong hangs LAMP_B_DX cells to the left of
 * the first, at the same height and distance. Every puppet then casts a
 * second shadow, shifted right by more the closer it stands to the lamps.
 * The shift is the real projection used by the 3D reveal (magnify = how much
 * bigger than the puppet its shadow is), so the reveal's second light lands
 * on exactly this shadow.
 */
export const LAMP_B_DX = -30;
export const lampMagnify = (d: number): number =>
  1.15 + (DEPTH_SCALE[d]! - 0.78) * 2;
export const lampShift = (p: Pose): number =>
  -LAMP_B_DX * (lampMagnify(p.d) - 1);

const shifted = (
  f: Figure,
  p: Pose,
  shift: number
): ((x: number, y: number) => [number, number]) => {
  const t0 = poseTransform(f, p);
  return shift === 0
    ? t0
    : (x, y) => {
        const [X, Y] = t0(x, y);
        return [X + shift, Y];
      };
};

/**
 * The puppet's outline in kelir space, as two pieces: the body (holes cut
 * through) and the arms in front of it (not holed). Drawing both the same
 * way as scoring keeps what you see equal to what counts.
 */
export const placedPolys = (f: Figure, p: Pose, shift = 0): PlacedPolys[] => {
  const t = shifted(f, p, shift);
  const parts = figureParts(f, p);
  return [
    {
      solids: parts.body.map((q) => mapPoly(q, t)),
      holes: parts.holes.map((q) => mapPoly(q, t)),
    },
    { solids: parts.arms.map((q) => mapPoly(q, t)), holes: [] },
  ];
};

/** every piece of the outline, per lamp (the second lamp's pieces carry lamp 1) */
export const placedByLamp = (f: Figure, p: Pose, lamps = 1): PlacedPolys[] =>
  lamps === 2
    ? [
        ...placedPolys(f, p),
        ...placedPolys(f, p, lampShift(p)).map((q) => ({ ...q, lamp: 1 })),
      ]
    : placedPolys(f, p);

type Part = 'body' | 'front' | 'back';

const partCache = new Map<string, Mask>();

const partKey = (id: string, p: Pose, part: Part, lamps: number): string => {
  const b = baseIndex(p);
  const j =
    part === 'body'
      ? p.head
      : part === 'front'
        ? p.arm * 3 + p.elbow
        : p.back * 3 + p.backElbow;
  return `${id}:${b}:${part}${j}:${lamps}`;
};

/**
 * The shadow of one piece of a puppet: the body (head turned, holes cut) or
 * one arm. Shadows only add up, so a whole puppet is the union of its pieces,
 * which lets the solver check each piece on its own.
 */
export const partMask = (id: string, p: Pose, part: Part, lamps = 1): Mask => {
  const key = partKey(id, p, part, lamps);
  const hit = partCache.get(key);
  if (hit) return hit;
  const f = figure(id);
  const m = emptyMask();
  for (const shift of lamps === 2 ? [0, lampShift(p)] : [0]) {
    const t = shifted(f, p, shift);
    if (part === 'body') {
      const parts = figureParts(f, { ...REST, head: p.head });
      const one = fillPolys(
        emptyMask(),
        parts.body.map((q) => mapPoly(q, t))
      );
      andNotInto(
        one,
        fillPolys(
          emptyMask(),
          parts.holes.map((q) => mapPoly(q, t))
        )
      );
      orInto(m, one);
    } else {
      const polys =
        part === 'front'
          ? armPolys(f, 'front', p.arm, p.elbow)
          : armPolys(f, 'back', p.back, p.backElbow);
      fillPolys(
        m,
        polys.map((q) => mapPoly(q, t))
      );
    }
  }
  if (partCache.size > 60000) partCache.clear();
  partCache.set(key, m);
  return m;
};

const cache = new Map<string, Mask>();

/** The shadow one puppet casts: body (minus its carved holes) and both arms. */
export const puppetMask = (id: string, p: Pose, lamps = 1): Mask => {
  const key = `${id}:${poseIndex(p)}:${lamps}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const m = new Uint32Array(partMask(id, p, 'body', lamps));
  orInto(m, partMask(id, p, 'front', lamps));
  orInto(m, partMask(id, p, 'back', lamps));
  if (cache.size > 20000) cache.clear();
  cache.set(key, m);
  return m;
};

/** One puppet on the stage (null pose = resting in the chest). */
export type Placement = { id: string; pose: Pose | null };

/** The whole shadow on the kelir: union of every puppet on stage. */
export const sceneMask = (
  placements: readonly Placement[],
  lamps = 1
): Mask => {
  const m = emptyMask();
  for (const pl of placements)
    if (pl.pose) orInto(m, puppetMask(pl.id, pl.pose, lamps));
  return m;
};

export const ALL_FIGURE_IDS = FIGURES.map((f) => f.id);
export const KELIR = { w: GW, h: GH };
