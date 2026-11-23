import { FIGURES, armPolys, figure, type Figure } from './figures.ts';
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
 *  arm   0..2  down / forward / up
 *  flip        facing left instead of right
 */
export type Pose = {
  x: number;
  d: number;
  a: number;
  arm: number;
  flip: boolean;
};

export const SLOTS = 7;
export const DEPTHS = 5;
export const ANGLES = 8;
export const ARMS = 3;
export const POSES = SLOTS * DEPTHS * ANGLES * ARMS * 2;

export const DEPTH_SCALE = [0.78, 0.89, 1.0, 1.12, 1.25];
export const LAMP_X = GW / 2;
export const BASELINE = 6;
/** shadow height of a 1-unit figure at depth 2, in cells */
export const UNIT = 76;

export const DEFAULT_POSE: Pose = { x: 3, d: 2, a: 0, arm: 0, flip: false };

export const slotX = (x: number): number => 28 + x * 24;

export const poseIndex = (p: Pose): number =>
  (((p.x * DEPTHS + p.d) * ANGLES + p.a) * ARMS + p.arm) * 2 + (p.flip ? 1 : 0);

export const poseFromIndex = (i: number): Pose => {
  const flip = i % 2 === 1;
  i = Math.floor(i / 2);
  const arm = i % ARMS;
  i = Math.floor(i / ARMS);
  const a = i % ANGLES;
  i = Math.floor(i / ANGLES);
  const d = i % DEPTHS;
  const x = Math.floor(i / DEPTHS);
  return { x, d, a, arm, flip };
};

export const samePose = (p: Pose, q: Pose): boolean =>
  p.x === q.x &&
  p.d === q.d &&
  p.a === q.a &&
  p.arm === q.arm &&
  p.flip === q.flip;

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

export type PlacedPolys = { solids: Poly[]; holes: Poly[] };

/** The puppet's outline in kelir space (for drawing and rasterising). */
export const placedPolys = (f: Figure, p: Pose): PlacedPolys => {
  const t = poseTransform(f, p);
  return {
    solids: [...f.body, ...armPolys(f, p.arm)].map((q) => mapPoly(q, t)),
    holes: f.holes.map((q) => mapPoly(q, t)),
  };
};

const cache = new Map<string, Mask>();

/** The shadow one puppet casts: its solid parts minus its carved holes. */
export const puppetMask = (id: string, p: Pose): Mask => {
  const key = `${id}:${poseIndex(p)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { solids, holes } = placedPolys(figure(id), p);
  const m = fillPolys(emptyMask(), solids);
  andNotInto(m, fillPolys(emptyMask(), holes));
  if (cache.size > 20000) cache.clear();
  cache.set(key, m);
  return m;
};

/** One puppet on the stage (null pose = resting in the chest). */
export type Placement = { id: string; pose: Pose | null };

/** The whole shadow on the kelir: union of every puppet on stage. */
export const sceneMask = (placements: readonly Placement[]): Mask => {
  const m = emptyMask();
  for (const pl of placements)
    if (pl.pose) orInto(m, puppetMask(pl.id, pl.pose));
  return m;
};

export const ALL_FIGURE_IDS = FIGURES.map((f) => f.id);
export const KELIR = { w: GW, h: GH };
