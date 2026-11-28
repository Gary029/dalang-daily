import type { Poly } from './grid.ts';

/**
 * Wayang figures as flat silhouettes. Frame: y up, feet on y = 0, the figure
 * faces +x, 1 unit = a standard satria's height. Every figure has carved
 * holes (light shines through them), two arms on rods that bend at the
 * shoulder and the elbow, and a head that can bow or rise.
 *
 * The shapes follow Surakarta wayang kulit purwa: a frontal torso on profile
 * legs and head, the refined knights' tiny waist, long arms and bowed head
 * with the dodot ballooning into a round flap (bokongan) behind, the strong
 * figures' wide stride, each character's own hairdo or crown, and the red
 * ground strip (palemahan) joining the feet.
 */

export type SetId =
  'punakawan' | 'pandawa' | 'kurawa' | 'dewa' | 'raksasa' | 'ramayana';

/** open: alus pointing hand; claw: Pancanaka thumbnail; fist; splay: raksasa claws */
export type Hand = 'open' | 'claw' | 'fist' | 'splay';

/** what a body polygon is painted as (and built from in Blender) */
export type Kind =
  'body' | 'face' | 'cloth' | 'hair' | 'gold' | 'white' | 'horn' | 'red';
/** kind and stacking layer (higher = nearer the viewer's side of the slab) */
export type Tag = [Kind, number];

/** cloth motif painted on the kain in the card art */
export type Pattern = 'poleng' | 'parang' | 'kawung';

export type Figure = {
  id: string;
  name: string;
  set: SetId;
  role: string;
  story: string;
  /** top of the figure in frame units */
  height: number;
  body: Poly[];
  /** one tag per body polygon, in the same order (the gapit is 'horn') */
  tags: Tag[];
  holes: Poly[];
  /** the back arm's shoulder (it shares the front arm's lengths and hand) */
  back: [number, number];
  /** the head turns about this point; everything above it is the head */
  neck: [number, number];
  arm: {
    shoulder: [number, number];
    upper: number;
    fore: number;
    width: number;
    hand: Hand;
  };
  /** colours for the card art (painted side of the puppet) */
  skin: string;
  cloth: string;
  /** the wanda colour of the face: black calm, red hot-tempered, white pure */
  face: string;
  pattern?: Pattern;
};

export const SETS: { id: SetId; name: string; blurb: string }[] = [
  {
    id: 'punakawan',
    name: 'Punakawan',
    blurb: 'The clown-servants who tell the truth',
  },
  { id: 'pandawa', name: 'Pandawa', blurb: 'The five brothers' },
  { id: 'kurawa', name: 'Kurawa', blurb: 'Their rival cousins' },
  { id: 'dewa', name: 'Dewa', blurb: 'The gods' },
  { id: 'raksasa', name: 'Raksasa', blurb: 'The giants' },
  { id: 'ramayana', name: 'Ramayana', blurb: "Rama's company" },
];

// --- shape kit -------------------------------------------------------------

const ell = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n = 18,
  rot = 0
): Poly => {
  const p: Poly = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let k = 0; k < n; k++) {
    const t = (k / n) * Math.PI * 2;
    const x = Math.cos(t) * rx;
    const y = Math.sin(t) * ry;
    p.push(cx + x * c - y * s, cy + x * s + y * c);
  }
  return p;
};

/** tapered capsule between two points */
const cap = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r1: number,
  r2 = r1
): Poly => {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p: Poly = [];
  const n = 7;
  for (let k = 0; k <= n; k++) {
    const t = a + Math.PI / 2 + (k / n) * Math.PI;
    p.push(x1 + Math.cos(t) * r1, y1 + Math.sin(t) * r1);
  }
  for (let k = 0; k <= n; k++) {
    const t = a - Math.PI / 2 + (k / n) * Math.PI;
    p.push(x2 + Math.cos(t) * r2, y2 + Math.sin(t) * r2);
  }
  return p;
};

const P = (...xy: number[]): Poly => xy;

const diamond = (cx: number, cy: number, r: number): Poly =>
  P(cx, cy - r * 1.25, cx + r, cy, cx, cy + r * 1.25, cx - r, cy);

const hole = (cx: number, cy: number, r: number): Poly => ell(cx, cy, r, r, 10);

/** Catmull-Rom points through control points (closed or open) */
const curve = (pts: number[], closed: boolean, per = 6): number[] => {
  const n = pts.length / 2;
  const at = (i: number): [number, number] => {
    const j = closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i));
    return [pts[j * 2]!, pts[j * 2 + 1]!];
  };
  const out: number[] = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    for (let s = 0; s < per; s++) {
      const t = s / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b +
          (-a + c) * t +
          (2 * a - 5 * b + 4 * c - d) * t2 +
          (-a + 3 * b - 3 * c + d) * t3);
      out.push(f(x0, x1, x2, x3), f(y0, y1, y2, y3));
    }
  }
  if (!closed) out.push(...at(n - 1));
  return out;
};

/** a smooth closed blob through the control points */
const spl = (...xy: number[]): Poly => curve(xy, true, 5);

/** width at fraction t of a ribbon, from evenly spaced widths */
const widthAt = (ws: number[], t: number): number => {
  if (ws.length === 1) return ws[0]!;
  const u = t * (ws.length - 1);
  const i = Math.min(ws.length - 2, Math.floor(u));
  return ws[i]! + (ws[i + 1]! - ws[i]!) * (u - i);
};

/** a tapered ribbon along a smooth open path (curls, crests, sashes) */
const rib = (pts: number[], ws: number[]): Poly => {
  const c = curve(pts, false, 6);
  const m = c.length / 2;
  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i < m; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(m - 1, i + 1);
    const tx = c[b * 2]! - c[a * 2]!;
    const ty = c[b * 2 + 1]! - c[a * 2 + 1]!;
    const l = Math.hypot(tx, ty) || 1;
    const w = widthAt(ws, i / (m - 1)) / 2;
    const nx = (-ty / l) * w;
    const ny = (tx / l) * w;
    left.push(c[i * 2]! + nx, c[i * 2 + 1]! + ny);
    right.push(c[i * 2]! - nx, c[i * 2 + 1]! - ny);
  }
  const out = [...left];
  for (let i = m - 1; i >= 0; i--) out.push(right[i * 2]!, right[i * 2 + 1]!);
  return out;
};

/** small round holes along a path, from fraction t0 to t1 */
const dots = (
  pts: number[],
  r: number,
  count: number,
  t0 = 0.1,
  t1 = 0.9
): Poly[] => {
  const c = curve(pts, false, 8);
  const m = c.length / 2;
  const out: Poly[] = [];
  for (let k = 0; k < count; k++) {
    const t = count === 1 ? (t0 + t1) / 2 : t0 + ((t1 - t0) * k) / (count - 1);
    const i = Math.round(t * (m - 1));
    out.push(ell(c[i * 2]!, c[i * 2 + 1]!, r, r, 8));
  }
  return out;
};

/** holes in a ring (the lace of a bokongan or a bun) */
const ring = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  r: number,
  count: number,
  shape: 'round' | 'diamond' = 'round'
): Poly[] =>
  Array.from({ length: count }, (_, k) => {
    const t = (k / count) * Math.PI * 2 + 0.3;
    const x = cx + Math.cos(t) * rx;
    const y = cy + Math.sin(t) * ry;
    return shape === 'round' ? ell(x, y, r, r, 8) : diamond(x, y, r);
  });

/**
 * A scalloped ruffle tail (rapekan): hangs from (x0, y0) to (x1, y1), its
 * edges a row of lobes.
 */
const ruffle = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  lobes = 5
): Poly => {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = Math.hypot(dx, dy);
  const nx = -dy / l;
  const ny = dx / l;
  const left: number[] = [];
  const right: number[] = [];
  const steps = lobes * 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const taper = 1 - 0.55 * t;
    const bulge = i % 2 === 1 ? 1 : 0.55;
    const h = (w / 2) * taper * bulge;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    left.push(x + nx * h, y + ny * h);
    right.push(x - nx * h, y - ny * h);
  }
  const out = [...left];
  for (let i = steps; i >= 0; i--) out.push(right[i * 2]!, right[i * 2 + 1]!);
  return out;
};

/** a round mass with a scalloped edge (curly hair, gimbal) */
const lobed = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n: number,
  depth: number
): Poly => {
  const p: Poly = [];
  const m = n * 4;
  for (let k = 0; k < m; k++) {
    const t = (k / m) * Math.PI * 2;
    const r = 1 - depth * (0.5 - 0.5 * Math.cos(n * t));
    p.push(cx + Math.cos(t) * rx * r, cy + Math.sin(t) * ry * r);
  }
  return p;
};

/** a foot in profile pointing +x, the ankle about ax + 0.01 */
const foot = (ax: number, len = 0.1, h = 0.04): Poly =>
  P(
    ax - 0.03,
    0,
    ax + len,
    0,
    ax + len * 0.96,
    0.012,
    ax + len * 0.6,
    h * 0.55,
    ax + 0.02,
    h,
    ax - 0.024,
    h * 0.85,
    ax - 0.036,
    0.014
  );

/** the palemahan: the ground strip the feet stand on */
const strip = (x0: number, x1: number): Poly =>
  P(x0, 0, x1, 0, x1, 0.016, x0, 0.016);

const area = (q: Poly): number => {
  let a = 0;
  for (let i = 0, j = q.length - 2; i < q.length; j = i, i += 2)
    a += q[j]! * q[i + 1]! - q[i]! * q[j + 1]!;
  return a / 2;
};

/** every polygon wound the same way, so a nonzero fill never cancels overlaps */
const ccw = (q: Poly): Poly => {
  if (area(q) >= 0) return q;
  const out: Poly = new Array<number>(q.length);
  for (let i = 0; i < q.length; i += 2) {
    out[q.length - 2 - i] = q[i]!;
    out[q.length - 1 - i] = q[i + 1]!;
  }
  return out;
};

const lowest = (q: Poly): number => {
  let lo = Infinity;
  for (let k = 1; k < q.length; k += 2) lo = Math.min(lo, q[k]!);
  return lo;
};

// --- the builder ---------------------------------------------------------------

type Xf = (x: number, y: number) => [number, number];
const ID: Xf = (x, y) => [x, y];

/**
 * Collects a figure's polygons in painting order. Inside head() everything
 * is drawn in the head's own frame (origin at the throat, facing +x) and
 * placed, tilted and scaled onto the neck.
 */
class Kit {
  body: Poly[] = [];
  tags: Tag[] = [];
  holes: Poly[] = [];
  private xf: Xf = ID;
  private inHead = false;
  headPolys: Poly[] = [];
  headHoles = new Set<number>();
  origin: [number, number] = [0, 0];

  private map(q: Poly): Poly {
    if (this.xf === ID) return q;
    const out: Poly = new Array<number>(q.length);
    for (let k = 0; k < q.length; k += 2) {
      const [x, y] = this.xf(q[k]!, q[k + 1]!);
      out[k] = x;
      out[k + 1] = y;
    }
    return out;
  }

  add(kind: Kind, layer: number, ...qs: Poly[]) {
    for (const q of qs) {
      const m = this.map(q);
      this.body.push(m);
      this.tags.push([kind, layer]);
      if (this.inHead) this.headPolys.push(m);
    }
    return this;
  }

  cut(...qs: Poly[]) {
    for (const q of qs) {
      if (this.inHead) this.headHoles.add(this.holes.length);
      this.holes.push(this.map(q));
    }
    return this;
  }

  head(ox: number, oy: number, deg: number, s: number, draw: () => void) {
    const r = (deg * Math.PI) / 180;
    const c = Math.cos(r) * s;
    const sn = Math.sin(r) * s;
    this.origin = [ox, oy];
    this.xf = (x, y) => [ox + x * c - y * sn, oy + x * sn + y * c];
    this.inHead = true;
    draw();
    this.inHead = false;
    this.xf = ID;
  }
}

type Built = {
  body: Poly[];
  tags: Tag[];
  holes: Poly[];
  back: [number, number];
  neck: [number, number];
  arm: Figure['arm'];
};

/**
 * Finish a figure: scale it, and set the neck just under the lowest point of
 * the head so the engine's head split (lowest point >= neck - 0.005) turns
 * exactly what was drawn as the head.
 */
const finish = (
  id: string,
  k: Kit,
  o: {
    s?: number;
    back: [number, number];
    front: [number, number];
    upper: number;
    fore: number;
    width: number;
    hand: Hand;
  }
): Built => {
  const s = o.s ?? 1;
  const S = (q: Poly) => q.map((v) => v * s);
  let neckY = Infinity;
  for (const q of k.headPolys) neckY = Math.min(neckY, lowest(q));
  const neck: [number, number] = [k.origin[0] * s, neckY * s];
  const body = k.body.map(S);
  const holes = k.holes.map(S);
  const isHead = (q: Poly) => lowest(q) >= neck[1] - 0.005;
  const head = new Set(k.headPolys);
  k.body.forEach((q, i) => {
    if (isHead(body[i]!) !== head.has(q))
      throw new Error(`${id}: body polygon ${i} is on the wrong side of the neck`);
  });
  holes.forEach((q, i) => {
    if (isHead(q) !== k.headHoles.has(i))
      throw new Error(`${id}: hole ${i} is on the wrong side of the neck`);
  });
  return {
    body,
    tags: k.tags,
    holes,
    neck,
    back: [o.back[0] * s, o.back[1] * s],
    arm: {
      shoulder: [o.front[0] * s, o.front[1] * s],
      upper: o.upper * s,
      fore: o.fore * s,
      width: o.width * s,
      hand: o.hand,
    },
  };
};

// --- heads (drawn in the head frame: throat at 0,0, facing +x) ----------------

/** the refined profile: forehead running straight into a blade nose */
const alusFace = (k: Kit, o: { moustache?: boolean; eye?: boolean } = {}) => {
  k.add(
    'face',
    3,
    P(
      -0.03,
      0.0,
      -0.038,
      0.04,
      -0.03,
      0.075,
      0.0,
      0.095,
      0.025,
      0.09,
      0.05,
      0.07,
      0.09,
      0.034,
      0.06,
      0.03,
      0.062,
      0.02,
      0.052,
      0.016,
      0.056,
      0.007,
      0.035,
      -0.004,
      0.005,
      -0.006
    )
  );
  // hair over the back of the skull
  k.add(
    'hair',
    4,
    P(
      -0.04,
      0.0,
      -0.046,
      0.045,
      -0.034,
      0.084,
      -0.002,
      0.1,
      0.026,
      0.096,
      0.004,
      0.078,
      -0.012,
      0.045,
      -0.012,
      0.002
    )
  );
  // sumping behind the ear
  k.add('gold', 5, ell(-0.014, 0.045, 0.022, 0.009, 10, -0.9));
  if (o.moustache)
    k.add('hair', 5, rib([0.05, 0.028, 0.062, 0.024, 0.07, 0.016], [0.007, 0.003]));
  if (o.eye !== false) k.cut(P(0.018, 0.061, 0.042, 0.057, 0.02, 0.056));
};

/** jamang: the forehead diadem band */
const jamang = (k: Kit) =>
  k.add('gold', 5, rib([-0.006, 0.093, 0.018, 0.094, 0.04, 0.082], [0.013, 0.008]));

/** gelung supit urang: a crest of curls sweeping back and hooking over */
const SUPIT = [
  -0.03, 0.035, -0.07, 0.075, -0.088, 0.13, -0.075, 0.185, -0.04, 0.218, 0.0,
  0.226, 0.03, 0.206, 0.038, 0.178, 0.022, 0.164,
];
const supit = (k: Kit, size = 1, big = false) => {
  const pts = SUPIT.map((v, i) =>
    i % 2 === 1 ? 0.03 + (v - 0.03) * size * (big ? 1.15 : 1) : v * size
  );
  k.add('hair', 4, rib(pts, [0.04, 0.052, 0.046, 0.036, 0.026, 0.018, 0.012, 0.008].map((w) => w * size)));
  // garuda mungkur where the crest leaves the head
  k.add('gold', 5, P(-0.045, 0.05, -0.09, 0.035, -0.083, 0.07, -0.055, 0.075));
  k.cut(...dots(pts, 0.0055 * size, 6, 0.2, 0.8));
  k.cut(...dots(pts, 0.011 * size, 1, 0.34, 0.34));
  jamang(k);
};

/** the long-nosed, bulb-nosed gagah profile with an open mouth */
const gagahFace = (k: Kit) => {
  k.add(
    'face',
    3,
    P(
      -0.04,
      0.0,
      -0.05,
      0.05,
      -0.035,
      0.095,
      0.0,
      0.11,
      0.035,
      0.1,
      0.058,
      0.08,
      0.07,
      0.072,
      0.09,
      0.07,
      0.106,
      0.057,
      0.101,
      0.041,
      0.085,
      0.037,
      0.08,
      0.03,
      0.092,
      0.022,
      0.077,
      0.012,
      0.07,
      0.0,
      0.045,
      -0.012,
      0.0,
      -0.01
    )
  );
  // moustache and beard
  k.add('hair', 4, rib([0.07, 0.036, 0.088, 0.031, 0.096, 0.02], [0.009, 0.004]));
  k.add('hair', 4, rib([0.064, 0.004, 0.045, -0.006, 0.02, -0.004], [0.004, 0.012, 0.006]));
  // pupuk mas on the forehead
  k.add('gold', 5, ell(0.046, 0.09, 0.008, 0.006, 8));
  k.cut(ell(0.05, 0.07, 0.009, 0.007, 8));
};

/** gelung minangkara: a great crescent of curls from the brow over the back */
const MINANG = [
  0.03, 0.095, 0.03, 0.15, -0.01, 0.2, -0.07, 0.222, -0.13, 0.2, -0.17, 0.15,
  -0.176, 0.09, -0.152, 0.054, -0.116, 0.06, -0.108, 0.094, -0.128, 0.11,
];
const minangkara = (k: Kit) => {
  k.add('hair', 4, rib(MINANG, [0.03, 0.05, 0.066, 0.07, 0.064, 0.054, 0.044, 0.034, 0.024, 0.016, 0.01]));
  // garuda mungkur and the pandan-flower sumping
  k.add('gold', 5, P(-0.04, 0.03, -0.1, 0.022, -0.092, 0.062, -0.05, 0.07));
  k.add('gold', 5, ell(-0.02, 0.04, 0.026, 0.009, 10, -1.1));
  k.cut(...dots(MINANG, 0.0055, 8, 0.12, 0.72));
  k.cut(ell(-0.07, 0.222, 0.016, 0.016, 10));
};

/** makuta: a tall tiered crown with a lotus-bud tip, garuda mungkur and hair fall */
const makuta = (k: Kit, c = 1, round = false) => {
  const C = (q: Poly) => q.map((v) => v * c);
  if (round) {
    k.add('gold', 5, C(spl(-0.04, 0.065, 0.038, 0.085, 0.05, 0.13, 0.04, 0.18, 0.01, 0.208, -0.03, 0.198, -0.052, 0.15, -0.055, 0.1)));
    k.add('red', 6, C(rib([-0.048, 0.12, 0.0, 0.13, 0.045, 0.12], [0.014])));
    k.add('gold', 6, C(ell(0.004, 0.232, 0.012, 0.024, 10)));
    k.cut(C(diamond(-0.006, 0.165, 0.011)));
    return;
  }
  // hair fall behind
  k.add('hair', 2, C(rib([-0.04, 0.075, -0.078, 0.06, -0.088, 0.025, -0.07, 0.006, -0.055, 0.02], [0.032, 0.024, 0.016, 0.01])));
  // garuda mungkur: a backward-facing bird plate
  k.add('gold', 4, C(P(-0.05, 0.09, -0.1, 0.078, -0.142, 0.108, -0.118, 0.138, -0.142, 0.172, -0.09, 0.152, -0.055, 0.132)));
  k.add(
    'gold',
    5,
    C(
      P(
        -0.042, 0.062, 0.036, 0.086, 0.046, 0.102, 0.034, 0.12, 0.04, 0.136,
        0.024, 0.142, 0.027, 0.166, 0.012, 0.172, 0.012, 0.2, 0.0, 0.244,
        -0.015, 0.2, -0.026, 0.195, -0.031, 0.162, -0.047, 0.156, -0.051,
        0.124, -0.062, 0.114, -0.056, 0.085
      )
    )
  );
  k.add('red', 6, C(rib([-0.05, 0.1, 0.0, 0.104, 0.042, 0.098], [0.012])));
  k.cut(C(diamond(-0.008, 0.135, 0.011)));
  k.cut(...ring(-0.008, 0.135, 0.026, 0.018, 0.004, 5).map(C));
  k.cut(C(hole(-0.11, 0.125, 0.008)));
};

/** raksasa profile: bulging eye, a terong or hooked nose, open mouth with fangs */
const raksasaFace = (k: Kit, nose: 'terong' | 'hook') => {
  k.add(
    'face',
    3,
    P(
      -0.045, 0.0, -0.06, 0.05, -0.045, 0.1, 0.0, 0.118, 0.045, 0.104, 0.062,
      0.088, 0.078, 0.082, 0.09, 0.07, 0.092, 0.05, 0.088, 0.036, 0.1, 0.03,
      0.09, 0.016, 0.1, 0.006, 0.08, -0.006, 0.04, -0.016, 0.0, -0.012
    )
  );
  if (nose === 'terong')
    k.add('face', 4, ell(0.105, 0.046, 0.036, 0.022, 14, -0.7));
  else
    k.add('face', 4, P(0.07, 0.078, 0.108, 0.07, 0.122, 0.05, 0.106, 0.036, 0.088, 0.04, 0.08, 0.06));
  // fangs up and down, and a brow
  k.add('white', 5, P(0.082, 0.026, 0.092, 0.05, 0.096, 0.024), P(0.084, 0.012, 0.096, -0.012, 0.098, 0.012));
  k.add('hair', 5, rib([0.08, 0.034, 0.1, 0.03, 0.112, 0.016], [0.01, 0.004]));
  k.cut(ell(0.046, 0.078, 0.013, 0.011, 10));
};

// --- body kits -----------------------------------------------------------------

type KnightOpts = {
  stance?: number;
  bok?: number;
  broad?: number;
  /** front leg pushed out (a gagah-alus king) */
  open?: number;
};

/**
 * The alus knight below the neck: close feet on a ground strip, thin legs,
 * the dodot with its round bokongan behind and a narrow front panel, a tiny
 * waist widening to flat square shoulders, a long neck leaning forward.
 */
const knight = (k: Kit, o: KnightOpts = {}) => {
  const st = o.stance ?? 1;
  const b = o.bok ?? 1;
  const br = o.broad ?? 1;
  const bx = -0.07 * st;
  const fx = 0.055 * st + (o.open ?? 0);
  k.add('red', -2, strip(bx - 0.04, fx + 0.11));
  k.add('body', 0, foot(bx), foot(fx));
  // bokongan: the dodot ballooning behind
  k.add('cloth', -1, ell(-0.06 - 0.045 * b, 0.31, 0.068 * b, 0.1 * b, 26, 0.12));
  k.add('body', 0, cap(-0.03, 0.42, bx + 0.006, 0.035, 0.024, 0.014));
  k.add('body', 0, cap(0.015, 0.42, fx + 0.006, 0.035, 0.024, 0.014));
  // uncal: a bead string at the waist
  k.add('gold', 1, rib([0.05, 0.45, 0.085, 0.4, 0.07, 0.33, 0.09, 0.27], [0.012, 0.008]));
  k.add(
    'cloth',
    2,
    P(
      0.045, 0.475, 0.07, 0.42, 0.078, 0.34, 0.07, 0.26, 0.052, 0.18, 0.032,
      0.09, 0.018, 0.17, -0.004, 0.22, -0.036, 0.25, -0.062, 0.32, -0.066,
      0.46
    )
  );
  // sabuk: the waist band
  k.add('gold', 3, P(-0.048, 0.448, 0.046, 0.448, 0.05, 0.486, -0.05, 0.486));
  k.add(
    'body',
    1,
    P(
      -0.032, 0.47, 0.032, 0.47, 0.048, 0.53, 0.066 * br, 0.585, 0.09 * br,
      0.626, 0.09 * br, 0.652, 0.025, 0.66, -0.025, 0.66, -0.102 * br, 0.652,
      -0.102 * br, 0.626, -0.064 * br, 0.585, -0.046, 0.53
    )
  );
  // kalung: the necklace
  k.add('gold', 2, rib([-0.028, 0.652, 0.0, 0.612, 0.03, 0.606, 0.05, 0.645], [0.006, 0.009, 0.006]));
  k.add('body', 1, cap(0.0, 0.64, 0.03, 0.722, 0.017, 0.014));
  return {
    front: [0.088 * br, 0.64] as [number, number],
    back: [-0.1 * br, 0.64] as [number, number],
  };
};

/**
 * The gagah body below the neck: a wide stride with bent knees, a short
 * hitched kampuh with long ruffle tails, a broad chest.
 */
const gagah = (
  k: Kit,
  o: { stance?: number; tails?: number; neckX?: number } = {}
) => {
  const st = o.stance ?? 1;
  const bx = -0.19 * st;
  const fx = 0.15 * st;
  k.add('red', -2, strip(bx - 0.04, fx + 0.12));
  k.add('body', 0, foot(bx, 0.11, 0.05), foot(fx, 0.11, 0.05));
  const kx = (x: number) => x * (0.6 + 0.4 * st);
  k.add('body', 0, cap(-0.05, 0.45, kx(-0.13), 0.25, 0.046, 0.034));
  k.add('body', 0, cap(kx(-0.13), 0.25, bx + 0.008, 0.04, 0.034, 0.024));
  k.add('body', 0, cap(0.05, 0.45, kx(0.12), 0.25, 0.046, 0.034));
  k.add('body', 0, cap(kx(0.12), 0.25, fx + 0.008, 0.04, 0.034, 0.024));
  // ruffle tails hanging between and behind the legs
  k.add('cloth', 1, ruffle(-0.005, 0.42, 0.0, 0.08 + 0.06 * (1 - (o.tails ?? 1)), 0.05, 6));
  k.add('cloth', -1, ruffle(-0.1, 0.42, kx(-0.16), 0.15, 0.042, 5));
  // the hitched kampuh
  k.add(
    'cloth',
    2,
    P(
      -0.12, 0.535, 0.1, 0.535, 0.13, 0.47, 0.118, 0.37, 0.075, 0.42, 0.03,
      0.385, -0.02, 0.33, -0.065, 0.39, -0.125, 0.345, -0.15, 0.43
    )
  );
  k.add('gold', 3, P(-0.08, 0.52, 0.075, 0.52, 0.08, 0.555, -0.084, 0.555));
  k.add(
    'body',
    1,
    P(
      -0.06, 0.54, 0.06, 0.54, 0.08, 0.61, 0.12, 0.69, 0.125, 0.722, 0.03,
      0.735, -0.03, 0.735, -0.14, 0.722, -0.136, 0.69, -0.09, 0.61
    )
  );
  // naga sash across the chest
  k.add('gold', 2, rib([-0.1, 0.71, -0.04, 0.66, 0.02, 0.6, 0.06, 0.56], [0.012, 0.016, 0.01]));
  const nx = o.neckX ?? 0.025;
  k.add('body', 1, cap(0.0, 0.72, nx, 0.79, 0.032, 0.028));
  return {
    front: [0.12, 0.71] as [number, number],
    back: [-0.13, 0.71] as [number, number],
  };
};

// --- the cast -----------------------------------------------------------------

const ALUS_ARM = { upper: 0.24, fore: 0.25, width: 0.018 };

const arjunaB = () => {
  const k = new Kit();
  const sh = knight(k);
  k.head(0.03, 0.722, -10, 1, () => {
    supit(k);
    alusFace(k);
  });
  k.cut(
    hole(-0.105, 0.31, 0.022),
    ...ring(-0.105, 0.31, 0.044, 0.068, 0.009, 6),
    diamond(-0.008, 0.565, 0.016),
    ...dots([0.05, 0.42, 0.045, 0.3, 0.035, 0.18], 0.007, 3)
  );
  return finish('arjuna', k, { ...sh, ...ALUS_ARM, hand: 'open' });
};

const yudhisB = () => {
  const k = new Kit();
  const sh = knight(k, { bok: 1.06 });
  k.head(0.03, 0.722, -18, 1, () => {
    // gelung keling: a big smooth round bun
    k.add('hair', 4, ell(-0.03, 0.086, 0.058, 0.054, 24));
    k.cut(...ring(-0.03, 0.086, 0.046, 0.042, 0.0045, 10));
    alusFace(k);
    jamang(k);
  });
  k.cut(
    diamond(-0.108, 0.36, 0.016),
    diamond(-0.108, 0.3, 0.016),
    diamond(-0.108, 0.24, 0.014),
    hole(0.0, 0.565, 0.017),
    ...dots([0.05, 0.42, 0.045, 0.3, 0.035, 0.18], 0.007, 3)
  );
  return finish('yudhistira', k, { s: 0.97, ...sh, ...ALUS_ARM, hand: 'open' });
};

const twinB = (id: string, holes: 'round' | 'diamond') => {
  const k = new Kit();
  const sh = knight(k, { bok: 0.95 });
  k.head(0.03, 0.722, -8, 1, () => {
    supit(k, 0.9);
    alusFace(k);
  });
  if (holes === 'round')
    k.cut(
      hole(0.02, 0.38, 0.026),
      hole(0.0, 0.565, 0.022),
      ...ring(-0.103, 0.31, 0.038, 0.06, 0.008, 5)
    );
  else
    k.cut(
      diamond(-0.02, 0.33, 0.024),
      diamond(0.025, 0.4, 0.022),
      diamond(0.0, 0.565, 0.018),
      ...ring(-0.103, 0.31, 0.038, 0.06, 0.008, 5, 'diamond')
    );
  return finish(id, k, { s: 0.93, ...sh, ...ALUS_ARM, hand: 'open' });
};

const ramaB = () => {
  const k = new Kit();
  const sh = knight(k, { bok: 1.04 });
  // the kain wrapped over the shoulder
  k.add('cloth', 3, rib([-0.085, 0.645, -0.03, 0.6, 0.02, 0.52, 0.035, 0.47], [0.028, 0.022, 0.014]));
  k.head(0.03, 0.722, -8, 1, () => {
    supit(k, 1.08, true);
    // the fine strand rising from the hook
    k.add('hair', 4, rib([0.03, 0.26, 0.0, 0.29, -0.04, 0.285], [0.006, 0.003]));
    alusFace(k);
  });
  k.cut(
    diamond(0.0, 0.53, 0.02),
    hole(-0.108, 0.31, 0.02),
    hole(0.035, 0.22, 0.014),
    ...ring(-0.108, 0.31, 0.046, 0.07, 0.006, 8)
  );
  return finish('rama', k, { ...sh, ...ALUS_ARM, hand: 'open' });
};

const duryuB = () => {
  const k = new Kit();
  // the praba: a flame plate standing up behind the shoulders
  k.add(
    'gold',
    -3,
    P(
      -0.05, 0.58, -0.15, 0.58, -0.205, 0.66, -0.175, 0.675, -0.215, 0.75,
      -0.175, 0.757, -0.19, 0.83, -0.11, 0.76, -0.05, 0.7
    )
  );
  const sh = knight(k, { stance: 1.4, bok: 1.25, broad: 1.12, open: 0.02 });
  k.head(0.035, 0.722, 0, 1, () => {
    makuta(k, 1);
    alusFace(k, { moustache: true });
  });
  k.cut(
    hole(0.02, 0.4, 0.026),
    P(-0.155, 0.36, -0.08, 0.36, -0.118, 0.3),
    ...ring(-0.118, 0.3, 0.056, 0.086, 0.008, 7),
    hole(-0.15, 0.63, 0.012),
    hole(-0.172, 0.69, 0.01)
  );
  return finish('duryudana', k, {
    s: 1.04,
    ...sh,
    upper: 0.235,
    fore: 0.24,
    width: 0.022,
    hand: 'fist',
  });
};

const bimaB = (id: string, o: { s?: number; head?: number; stance?: number }) => {
  const k = new Kit();
  const sh = gagah(k, { stance: o.stance ?? 1 });
  k.head(0.025, 0.79, 4, o.head ?? 1, () => {
    minangkara(k);
    gagahFace(k);
  });
  k.cut(
    P(-0.075, 0.5, -0.035, 0.5, -0.035, 0.46, -0.075, 0.46),
    P(0.025, 0.46, 0.065, 0.46, 0.065, 0.42, 0.025, 0.42),
    hole(0.0, 0.64, 0.034),
    ...dots([-0.0, 0.4, -0.0, 0.1], 0.007, 4, 0.15, 0.75)
  );
  return finish(id, k, {
    s: o.s ?? 1,
    ...sh,
    upper: 0.23,
    fore: 0.235,
    width: 0.034,
    hand: 'claw',
  });
};

const hanomanB = () => {
  const k = new Kit();
  // a small tail curled low behind
  k.add('body', -2, rib([-0.11, 0.4, -0.2, 0.44, -0.235, 0.53, -0.205, 0.6, -0.165, 0.585], [0.028, 0.024, 0.02, 0.016, 0.012]));
  const sh = gagah(k, { stance: 0.9 });
  k.head(0.025, 0.79, 2, 1, () => {
    // the curl crest from the top of the head, jamang with a small point
    const crest = [-0.015, 0.09, -0.06, 0.13, -0.075, 0.19, -0.05, 0.235, -0.005, 0.25, 0.03, 0.232, 0.035, 0.205, 0.018, 0.195];
    k.add('hair', 4, rib(crest, [0.036, 0.046, 0.04, 0.03, 0.022, 0.014, 0.008]));
    k.cut(...dots(crest, 0.0055, 5, 0.2, 0.8), ...dots(crest, 0.011, 1, 0.3, 0.3));
    // monkey muzzle with an open mouth
    k.add(
      'face',
      3,
      P(
        -0.04, 0.0, -0.05, 0.05, -0.032, 0.09, 0.01, 0.102, 0.045, 0.088,
        0.062, 0.068, 0.1, 0.058, 0.118, 0.042, 0.106, 0.028, 0.09, 0.026,
        0.1, 0.012, 0.075, 0.0, 0.03, -0.01, 0.0, -0.01
      )
    );
    k.add('gold', 5, P(-0.012, 0.088, 0.046, 0.088, 0.032, 0.112, 0.016, 0.132, 0.004, 0.11));
    k.add('gold', 5, ell(-0.022, 0.04, 0.026, 0.01, 10, -1.0));
    k.add('white', 5, P(0.086, 0.027, 0.092, 0.04, 0.097, 0.027));
    k.cut(ell(0.048, 0.064, 0.01, 0.008, 8));
  });
  k.cut(
    hole(0.0, 0.62, 0.03),
    diamond(-0.035, 0.44, 0.022),
    hole(-0.205, 0.53, 0.008),
    ...dots([-0.0, 0.4, -0.0, 0.1], 0.007, 3, 0.2, 0.7)
  );
  return finish('hanoman', k, { ...sh, upper: 0.22, fore: 0.22, width: 0.03, hand: 'claw' });
};

const semarB = () => {
  const k = new Kit();
  k.add('red', -2, strip(-0.15, 0.19));
  k.add('body', 0, foot(-0.1, 0.085, 0.04), foot(0.08, 0.085, 0.04));
  // short bowed legs in a crouch
  k.add('body', 0, cap(-0.06, 0.2, -0.105, 0.11, 0.04, 0.032), cap(-0.105, 0.11, -0.09, 0.035, 0.032, 0.025));
  k.add('body', 0, cap(0.05, 0.2, 0.1, 0.11, 0.04, 0.032), cap(0.1, 0.11, 0.09, 0.035, 0.032, 0.025));
  // the great backside and the belly
  k.add('body', 0, ell(-0.12, 0.31, 0.105, 0.115, 22));
  k.add('body', 1, ell(-0.005, 0.47, 0.085, 0.075, 18));
  k.add('body', 1, ell(0.05, 0.37, 0.125, 0.15, 24, 0.25));
  k.add('body', 1, ell(0.105, 0.47, 0.04, 0.03, 12, -0.4));
  // the kain wrapped round the hips and backside, with a striped sash
  k.add('cloth', 2, spl(-0.225, 0.3, -0.16, 0.4, -0.04, 0.35, 0.08, 0.27, 0.13, 0.2, 0.05, 0.165, -0.08, 0.17, -0.2, 0.2));
  k.add('red', 3, rib([-0.17, 0.39, -0.06, 0.355, 0.04, 0.31, 0.1, 0.265], [0.018]));
  // head turned up (ndangak), snub nose, grin, kuncung at the front
  k.head(0.04, 0.49, 18, 1.25, () => {
    k.add(
      'face',
      3,
      P(
        -0.05, 0.0, -0.068, 0.05, -0.058, 0.1, -0.02, 0.128, 0.03, 0.124,
        0.06, 0.1, 0.075, 0.076, 0.094, 0.07, 0.088, 0.052, 0.076, 0.05,
        0.086, 0.036, 0.07, 0.03, 0.088, 0.016, 0.07, 0.003, 0.045, -0.014,
        0.0, -0.015
      )
    );
    k.add('hair', 4, P(-0.056, 0.0, -0.075, 0.05, -0.064, 0.102, -0.03, 0.126, -0.006, 0.11, -0.02, 0.06, -0.026, 0.0));
    k.add('hair', 5, rib([0.018, 0.122, 0.035, 0.15, 0.06, 0.152], [0.02, 0.012, 0.005]));
    k.add('red', 5, ell(0.078, 0.014, 0.012, 0.006, 8));
    k.cut(P(0.04, 0.083, 0.064, 0.078, 0.046, 0.074));
  });
  k.cut(
    hole(0.04, 0.39, 0.034),
    hole(-0.13, 0.29, 0.026),
    diamond(-0.005, 0.475, 0.018),
    ...dots([-0.18, 0.25, -0.05, 0.22, 0.08, 0.2], 0.007, 4)
  );
  return finish('semar', k, {
    back: [-0.075, 0.49],
    front: [0.065, 0.475],
    upper: 0.15,
    fore: 0.145,
    width: 0.03,
    hand: 'open',
  });
};

const garengB = () => {
  const k = new Kit();
  k.add('red', -2, strip(-0.11, 0.13));
  k.add('body', 0, foot(-0.07, 0.075, 0.035));
  // the lame front leg, bent, on a short turned club foot
  k.add('body', 0, ell(0.072, 0.03, 0.036, 0.026, 12, 0.3));
  k.add('body', 0, cap(-0.02, 0.24, -0.06, 0.035, 0.022, 0.016));
  k.add('body', 0, cap(0.02, 0.24, 0.075, 0.13, 0.022, 0.018), cap(0.075, 0.13, 0.068, 0.045, 0.018, 0.015));
  k.add('cloth', 2, spl(-0.09, 0.34, 0.07, 0.34, 0.09, 0.26, 0.06, 0.17, -0.02, 0.19, -0.1, 0.175, -0.11, 0.27));
  k.add('cloth', 1, ruffle(-0.01, 0.2, -0.005, 0.1, 0.03, 3));
  k.add('body', 1, spl(-0.055, 0.33, 0.045, 0.33, 0.07, 0.38, 0.055, 0.44, 0.04, 0.47, -0.05, 0.47, -0.062, 0.4));
  k.add('body', 1, cap(0.0, 0.46, 0.015, 0.49, 0.016, 0.014));
  k.head(0.015, 0.49, 0, 1, () => {
    k.add(
      'face',
      3,
      P(
        -0.045, 0.0, -0.058, 0.05, -0.04, 0.098, 0.0, 0.114, 0.04, 0.1, 0.06,
        0.072, 0.072, 0.062, 0.088, 0.064, 0.098, 0.05, 0.088, 0.034, 0.068,
        0.032, 0.07, 0.02, 0.056, 0.006, 0.03, -0.01, 0.0, -0.01
      )
    );
    k.add('hair', 4, P(-0.05, 0.0, -0.062, 0.05, -0.044, 0.098, -0.012, 0.112, -0.022, 0.06, -0.024, 0.0));
    k.add('hair', 5, rib([-0.01, 0.108, -0.03, 0.135, -0.052, 0.14], [0.016, 0.01, 0.004]));
    // the big squinting round eye
    k.cut(ell(0.032, 0.066, 0.014, 0.013, 12));
  });
  k.cut(diamond(-0.005, 0.4, 0.02), hole(-0.03, 0.27, 0.017), hole(0.04, 0.26, 0.008));
  return finish('gareng', k, {
    back: [-0.05, 0.455],
    front: [0.045, 0.455],
    upper: 0.135,
    fore: 0.125,
    width: 0.02,
    hand: 'fist',
  });
};

const petrukB = () => {
  const k = new Kit();
  k.add('red', -2, strip(-0.125, 0.2));
  k.add('body', 0, foot(-0.08, 0.1, 0.04), foot(0.08, 0.1, 0.04));
  k.add('body', 0, cap(-0.02, 0.38, -0.072, 0.035, 0.022, 0.015), cap(0.02, 0.38, 0.086, 0.035, 0.022, 0.015));
  // the axe Kyai Pethel tucked at the back of the waist
  k.add('horn', -1, cap(-0.03, 0.5, -0.11, 0.625, 0.008, 0.007));
  k.add('white', -1, P(-0.1, 0.6, -0.15, 0.62, -0.158, 0.672, -0.112, 0.648));
  k.add('cloth', 1, ruffle(0.0, 0.34, 0.005, 0.12, 0.034, 4));
  k.add('cloth', 2, spl(-0.08, 0.48, 0.07, 0.465, 0.1, 0.38, 0.08, 0.3, 0.0, 0.325, -0.09, 0.3, -0.1, 0.4));
  // the low sagging belly
  k.add('body', 1, ell(0.04, 0.47, 0.072, 0.068, 18));
  k.add('body', 1, P(-0.042, 0.48, 0.032, 0.5, 0.036, 0.66, 0.05, 0.722, -0.06, 0.722, -0.046, 0.62));
  // the bell pendant
  k.add('gold', 2, rib([-0.03, 0.715, 0.0, 0.69, 0.03, 0.715], [0.006]), ell(0.0, 0.672, 0.014, 0.016, 10));
  k.add('body', 1, cap(0.0, 0.71, 0.02, 0.832, 0.016, 0.013));
  k.head(0.02, 0.832, 0, 1, () => {
    k.add(
      'face',
      3,
      P(
        -0.035, 0.0, -0.045, 0.05, -0.03, 0.085, 0.0, 0.095, 0.03, 0.086,
        0.04, 0.07, 0.1, 0.066, 0.17, 0.064, 0.186, 0.058, 0.176, 0.05, 0.1,
        0.046, 0.05, 0.04, 0.06, 0.03, 0.078, 0.022, 0.056, 0.01, 0.03,
        -0.005, 0.0, -0.008
      )
    );
    k.add('hair', 4, P(-0.04, 0.0, -0.05, 0.05, -0.032, 0.09, 0.0, 0.1, 0.026, 0.092, 0.0, 0.076, -0.014, 0.03, -0.014, 0.0));
    k.add('hair', 4, rib([-0.035, 0.074, -0.08, 0.066, -0.1, 0.035, -0.094, 0.006], [0.022, 0.016, 0.01, 0.005]));
    k.add('red', 5, ell(0.062, 0.014, 0.014, 0.006, 8));
    k.cut(ell(0.02, 0.066, 0.008, 0.008, 8));
  });
  k.cut(
    hole(0.0, 0.6, 0.02),
    hole(0.04, 0.47, 0.024),
    diamond(-0.03, 0.39, 0.018),
    hole(-0.128, 0.64, 0.007)
  );
  return finish('petruk', k, {
    back: [-0.055, 0.712],
    front: [0.045, 0.712],
    upper: 0.23,
    fore: 0.24,
    width: 0.017,
    hand: 'open',
  });
};

const bagongB = () => {
  const k = new Kit();
  k.add('red', -2, strip(-0.135, 0.18));
  k.add('body', 0, foot(-0.09, 0.09, 0.04), foot(0.08, 0.09, 0.04));
  k.add('body', 0, cap(-0.04, 0.2, -0.082, 0.035, 0.04, 0.03), cap(0.04, 0.2, 0.086, 0.035, 0.04, 0.03));
  // hunched back and fat round body
  k.add('body', 0, ell(-0.075, 0.44, 0.08, 0.075, 18));
  k.add('body', 1, ell(0.0, 0.35, 0.12, 0.14, 22));
  k.add('cloth', 2, spl(-0.14, 0.36, 0.0, 0.33, 0.12, 0.3, 0.11, 0.19, -0.02, 0.17, -0.14, 0.2, -0.16, 0.28));
  k.add('red', 3, rib([-0.13, 0.35, 0.0, 0.32, 0.115, 0.295], [0.018]));
  k.add('body', 1, cap(0.0, 0.44, 0.03, 0.47, 0.03, 0.026));
  k.head(0.03, 0.47, -4, 1, () => {
    k.add(
      'face',
      3,
      P(
        -0.05, 0.0, -0.075, 0.05, -0.07, 0.1, -0.035, 0.135, 0.01, 0.14,
        0.05, 0.12, 0.07, 0.09, 0.076, 0.07, 0.086, 0.06, 0.08, 0.05, 0.096,
        0.045, 0.116, 0.034, 0.11, 0.02, 0.094, 0.017, 0.11, 0.006, 0.1,
        -0.006, 0.07, -0.008, 0.04, -0.015, 0.0, -0.01
      )
    );
    k.add('hair', 4, P(-0.056, 0.0, -0.082, 0.05, -0.074, 0.104, -0.04, 0.135, -0.03, 0.1, -0.035, 0.05, -0.03, 0.0));
    // the thick protruding lips
    k.add('red', 5, P(0.08, 0.05, 0.096, 0.045, 0.116, 0.034, 0.11, 0.02, 0.094, 0.017, 0.11, 0.006, 0.1, -0.006, 0.075, 0.0, 0.07, 0.03));
    // the huge round eye
    k.cut(ell(0.028, 0.076, 0.022, 0.021, 14));
  });
  k.cut(hole(0.0, 0.33, 0.035), diamond(-0.08, 0.44, 0.02), ...dots([-0.12, 0.24, 0.0, 0.22, 0.09, 0.22], 0.007, 3));
  return finish('bagong', k, {
    back: [-0.08, 0.45],
    front: [0.065, 0.45],
    upper: 0.14,
    fore: 0.135,
    width: 0.03,
    hand: 'open',
  });
};

const sengkuniB = () => {
  const k = new Kit();
  // wide stride, leaning forward from the hips
  k.add('red', -2, strip(-0.22, 0.27));
  k.add('body', 0, foot(-0.17, 0.095, 0.038), foot(0.15, 0.095, 0.038));
  k.add('body', 0, cap(-0.03, 0.4, -0.1, 0.22, 0.026, 0.02), cap(-0.1, 0.22, -0.16, 0.035, 0.02, 0.014));
  k.add('body', 0, cap(0.03, 0.4, 0.11, 0.22, 0.026, 0.02), cap(0.11, 0.22, 0.157, 0.035, 0.02, 0.014));
  // the keris at the back of the waist
  k.add('red', -1, rib([-0.04, 0.46, -0.1, 0.52, -0.16, 0.56], [0.016, 0.012]));
  k.add('horn', -1, cap(-0.04, 0.46, -0.015, 0.44, 0.01, 0.008));
  k.add('cloth', 1, ruffle(0.0, 0.38, 0.0, 0.12, 0.036, 5));
  k.add('cloth', 2, P(-0.09, 0.47, 0.07, 0.47, 0.105, 0.41, 0.1, 0.33, 0.06, 0.38, 0.02, 0.35, -0.01, 0.29, -0.04, 0.35, -0.09, 0.31, -0.125, 0.4));
  k.add('gold', 3, P(-0.06, 0.455, 0.05, 0.455, 0.055, 0.49, -0.064, 0.49));
  k.add('body', 1, P(-0.03, 0.48, 0.035, 0.48, 0.06, 0.55, 0.098, 0.61, 0.1, 0.635, 0.04, 0.645, -0.03, 0.64, -0.075, 0.625, -0.07, 0.6, -0.045, 0.55));
  k.add('body', 1, cap(0.03, 0.63, 0.07, 0.69, 0.016, 0.013));
  k.head(0.07, 0.69, 6, 1, () => {
    // thin face, long sharp nose, sneering open mouth
    k.add(
      'face',
      3,
      P(
        -0.032, 0.0, -0.038, 0.045, -0.028, 0.08, 0.004, 0.092, 0.03, 0.085,
        0.045, 0.07, 0.11, 0.046, 0.06, 0.036, 0.07, 0.024, 0.05, 0.022,
        0.066, 0.008, 0.04, -0.004, 0.01, -0.008
      )
    );
    // the black kethu cap with gold dots, curls at the nape
    k.add('hair', 4, spl(-0.044, 0.03, -0.036, 0.085, 0.0, 0.108, 0.04, 0.094, 0.036, 0.076, 0.0, 0.07, -0.016, 0.03));
    k.add('hair', 4, lobed(-0.04, 0.018, 0.022, 0.024, 4, 0.3));
    k.add('gold', 5, ell(0.0, 0.092, 0.005, 0.005, 6), ell(0.018, 0.088, 0.005, 0.005, 6), ell(-0.02, 0.08, 0.005, 0.005, 6), ell(-0.026, 0.058, 0.005, 0.005, 6));
    k.add('white', 5, P(0.05, 0.022, 0.068, 0.024, 0.06, 0.017));
    k.cut(ell(0.032, 0.06, 0.006, 0.004, 6));
  });
  k.cut(hole(0.02, 0.57, 0.018), diamond(0.0, 0.42, 0.018), hole(0.06, 0.4, 0.01), hole(-0.06, 0.39, 0.01));
  return finish('sengkuni', k, {
    s: 0.95,
    back: [-0.072, 0.625],
    front: [0.098, 0.625],
    upper: 0.2,
    fore: 0.21,
    width: 0.016,
    hand: 'open',
  });
};

const guruB = () => {
  const k = new Kit();
  // the praba plate behind
  k.add(
    'gold',
    -3,
    P(
      -0.07, 0.6, -0.17, 0.61, -0.215, 0.67, -0.2, 0.69, -0.235, 0.75, -0.2,
      0.76, -0.215, 0.83, -0.175, 0.82, -0.16, 0.9, -0.12, 0.83, -0.08, 0.8,
      -0.05, 0.7
    )
  );
  // the second pair of arms folded at the back of the robe
  k.add('body', -2, cap(-0.1, 0.62, -0.175, 0.52, 0.018, 0.016), cap(-0.175, 0.52, -0.125, 0.44, 0.016, 0.014), ell(-0.115, 0.43, 0.02, 0.012, 10, -0.9));
  k.add('red', -2, strip(-0.08, 0.15));
  // feet together in curled-toe slippers
  k.add('hair', 0, P(-0.05, 0, 0.06, 0, 0.09, 0.03, 0.072, 0.036, 0.06, 0.02, 0.02, 0.034, -0.05, 0.03));
  k.add('hair', 0, P(-0.02, 0, 0.09, 0, 0.12, 0.03, 0.102, 0.036, 0.09, 0.02, 0.05, 0.034, -0.02, 0.03));
  // the jubah: an ankle-length column with a straight front edge
  k.add('cloth', 1, P(-0.105, 0.62, 0.065, 0.62, 0.08, 0.42, 0.085, 0.05, 0.06, 0.03, -0.09, 0.03, -0.12, 0.08, -0.125, 0.36));
  // the shoulder cape
  k.add('gold', 2, P(-0.13, 0.665, 0.085, 0.665, 0.1, 0.6, 0.075, 0.5, -0.02, 0.54, -0.135, 0.5, -0.145, 0.59));
  k.add('red', 3, rib([0.0, 0.62, 0.02, 0.4, 0.03, 0.12], [0.02, 0.024, 0.016]));
  k.add('body', 1, cap(0.0, 0.65, 0.03, 0.722, 0.017, 0.014));
  k.head(0.03, 0.722, -8, 1, () => {
    makuta(k, 1, true);
    alusFace(k, { moustache: true });
  });
  k.cut(
    hole(-0.03, 0.35, 0.024),
    hole(-0.04, 0.18, 0.018),
    diamond(-0.16, 0.69, 0.018),
    hole(-0.19, 0.63, 0.01),
    ...dots([-0.08, 0.6, -0.085, 0.36, -0.08, 0.1], 0.007, 4)
  );
  return finish('guru', k, {
    back: [-0.1, 0.64],
    front: [0.08, 0.64],
    upper: 0.22,
    fore: 0.22,
    width: 0.019,
    hand: 'open',
  });
};

const sintaB = () => {
  const k = new Kit();
  k.add('red', -2, strip(-0.1, 0.24));
  // long hair down the back
  k.add('hair', -1, rib([-0.04, 0.67, -0.085, 0.6, -0.095, 0.5, -0.085, 0.42], [0.03, 0.026, 0.018, 0.006]));
  // the selendang falling behind
  k.add('red', -1, rib([-0.06, 0.41, -0.12, 0.25, -0.115, 0.12, -0.13, 0.06], [0.016, 0.014, 0.01]));
  k.add('body', 0, foot(0.0, 0.07, 0.03));
  // the long kain ending in a forward train curled up at the tip
  k.add(
    'cloth',
    1,
    P(
      -0.072, 0.42, 0.056, 0.42, 0.07, 0.3, 0.078, 0.12, 0.12, 0.05, 0.19,
      0.035, 0.226, 0.07, 0.212, 0.022, 0.16, 0.004, 0.0, 0.004, -0.09, 0.004,
      -0.1, 0.035, -0.08, 0.2
    )
  );
  k.add('body', 1, P(-0.046, 0.42, 0.04, 0.42, 0.055, 0.5, 0.07, 0.54, 0.06, 0.575, 0.0, 0.585, -0.08, 0.578, -0.08, 0.564, -0.052, 0.5));
  // kemben and necklace
  k.add('cloth', 2, P(-0.052, 0.462, 0.055, 0.462, 0.068, 0.53, -0.056, 0.53));
  k.add('gold', 3, rib([-0.02, 0.578, 0.005, 0.548, 0.03, 0.575], [0.006]));
  k.add('body', 1, cap(0.0, 0.575, 0.025, 0.638, 0.014, 0.012));
  k.head(0.025, 0.638, -20, 0.9, () => {
    // the big bun with a hairpin and a flower
    k.add('hair', 4, ell(-0.055, 0.074, 0.044, 0.04, 20));
    k.add('gold', 5, rib([0.0, 0.11, -0.05, 0.08, -0.115, 0.05], [0.006, 0.006, 0.003]));
    k.add('red', 5, ell(-0.05, 0.118, 0.013, 0.013, 10));
    alusFace(k);
  });
  k.cut(
    diamond(0.0, 0.5, 0.018),
    hole(-0.02, 0.3, 0.02),
    hole(-0.01, 0.16, 0.018),
    hole(0.15, 0.028, 0.008),
    ...dots([0.04, 0.4, 0.05, 0.25, 0.06, 0.1], 0.006, 3)
  );
  return finish('sinta', k, {
    back: [-0.072, 0.565],
    front: [0.06, 0.565],
    upper: 0.18,
    fore: 0.185,
    width: 0.015,
    hand: 'open',
  });
};

const cakilB = () => {
  const k = new Kit();
  // the keris at the back of the waist, red sheath
  k.add('red', -2, rib([-0.05, 0.46, -0.12, 0.53, -0.18, 0.58], [0.02, 0.014]));
  k.add('horn', -2, cap(-0.05, 0.46, -0.025, 0.43, 0.012, 0.009));
  k.add('red', -3, strip(-0.25, 0.235));
  k.add('body', 0, foot(-0.215, 0.085, 0.04), foot(0.145, 0.085, 0.04));
  k.add('body', 0, cap(-0.03, 0.38, -0.13, 0.2, 0.03, 0.022), cap(-0.13, 0.2, -0.207, 0.035, 0.022, 0.015));
  k.add('body', 0, cap(0.03, 0.38, 0.115, 0.22, 0.03, 0.022), cap(0.115, 0.22, 0.152, 0.035, 0.022, 0.015));
  k.add('cloth', 1, ruffle(0.0, 0.38, 0.005, 0.11, 0.04, 6), ruffle(-0.075, 0.37, -0.12, 0.15, 0.034, 5));
  k.add('cloth', 2, P(-0.1, 0.48, 0.07, 0.48, 0.105, 0.42, 0.1, 0.33, 0.055, 0.39, 0.0, 0.34, -0.06, 0.37, -0.12, 0.31, -0.14, 0.4));
  k.add('gold', 3, P(-0.065, 0.465, 0.055, 0.465, 0.06, 0.5, -0.07, 0.5));
  k.add('body', 1, P(-0.04, 0.48, 0.04, 0.48, 0.058, 0.56, 0.085, 0.632, 0.082, 0.658, 0.02, 0.665, -0.02, 0.665, -0.09, 0.658, -0.09, 0.632, -0.055, 0.56));
  // ringlets falling down the back
  k.add('hair', -1, rib([-0.03, 0.78, -0.075, 0.74, -0.09, 0.68, -0.085, 0.6], [0.02, 0.016, 0.012, 0.005]));
  k.add('body', 1, cap(0.0, 0.65, 0.035, 0.722, 0.017, 0.014));
  k.head(0.035, 0.722, 6, 1, () => {
    // black hair bun behind
    k.add('hair', 2, ell(-0.045, 0.075, 0.04, 0.034, 16), ell(-0.09, 0.06, 0.022, 0.022, 10));
    // upturned pointed nose and the long jutting lower jaw with a fang
    k.add(
      'face',
      3,
      P(
        -0.035, 0.0, -0.045, 0.05, -0.03, 0.085, 0.0, 0.097, 0.03, 0.088,
        0.05, 0.07, 0.08, 0.06, 0.108, 0.072, 0.092, 0.05, 0.07, 0.042, 0.074,
        0.035, 0.06, 0.03, 0.142, 0.022, 0.152, 0.036, 0.158, 0.006, 0.12,
        -0.006, 0.06, -0.006, 0.02, -0.012, 0.0, -0.01
      )
    );
    k.add('white', 5, P(0.065, 0.03, 0.14, 0.023, 0.13, 0.03, 0.07, 0.036));
    k.add('hair', 5, rib([0.068, 0.044, 0.09, 0.046, 0.1, 0.04], [0.008, 0.003]));
    k.cut(ell(0.04, 0.064, 0.011, 0.009, 10));
  });
  k.cut(
    hole(0.0, 0.57, 0.022),
    diamond(-0.02, 0.42, 0.02),
    hole(-0.075, 0.36, 0.014),
    ...dots([0.0, 0.36, 0.004, 0.13], 0.007, 3, 0.2, 0.8)
  );
  return finish('cakil', k, {
    back: [-0.085, 0.645],
    front: [0.08, 0.645],
    upper: 0.2,
    fore: 0.205,
    width: 0.018,
    hand: 'splay',
  });
};

const butaB = () => {
  const k = new Kit();
  k.add('red', -3, strip(-0.22, 0.29));
  k.add('body', 0, foot(-0.17, 0.12, 0.06), foot(0.13, 0.12, 0.06));
  k.add('body', 0, cap(-0.07, 0.4, -0.16, 0.05, 0.06, 0.045), cap(0.06, 0.4, 0.13, 0.05, 0.06, 0.045));
  k.add('cloth', 1, ruffle(-0.005, 0.34, 0.0, 0.08, 0.06, 6), ruffle(-0.15, 0.32, -0.2, 0.1, 0.046, 5));
  k.add('cloth', 2, P(-0.18, 0.5, 0.17, 0.48, 0.2, 0.4, 0.17, 0.3, 0.11, 0.36, 0.04, 0.31, -0.03, 0.34, -0.12, 0.29, -0.2, 0.32, -0.21, 0.42));
  k.add('body', 1, ell(0.04, 0.56, 0.165, 0.165, 26));
  k.add('gold', 2, P(-0.15, 0.47, 0.17, 0.45, 0.18, 0.49, -0.15, 0.51));
  k.add('body', 1, P(-0.14, 0.62, 0.12, 0.62, 0.15, 0.8, 0.14, 0.84, -0.16, 0.84, -0.15, 0.78));
  k.add('body', 1, cap(0.0, 0.82, 0.03, 0.885, 0.05, 0.045));
  k.head(0.03, 0.885, 0, 1.35, () => {
    // gimbal: a wild mass of curly hair behind, with a small jamang
    k.add('hair', 2, lobed(-0.055, 0.07, 0.07, 0.065, 9, 0.22));
    raksasaFace(k, 'terong');
    k.add('gold', 5, P(-0.02, 0.1, 0.045, 0.1, 0.035, 0.125, 0.012, 0.15, 0.0, 0.122));
  });
  k.cut(
    hole(0.04, 0.55, 0.045),
    diamond(-0.06, 0.72, 0.03),
    hole(0.0, 0.42, 0.026),
    ...dots([-0.13, 0.47, 0.0, 0.47, 0.15, 0.46], 0.008, 5)
  );
  return finish('buta', k, {
    back: [-0.145, 0.8],
    front: [0.13, 0.8],
    upper: 0.22,
    fore: 0.22,
    width: 0.042,
    hand: 'splay',
  });
};

/** Dasamuka: one head, a tall gagah king under a towering makuta */
const rahwanaB = () => {
  const k = new Kit();
  // the praba
  k.add(
    'gold',
    -3,
    P(
      -0.08, 0.7, -0.2, 0.7, -0.26, 0.8, -0.22, 0.815, -0.27, 0.91, -0.225,
      0.92, -0.25, 1.02, -0.15, 0.94, -0.075, 0.87
    )
  );
  k.add('red', -3, strip(-0.27, 0.33));
  k.add('body', 0, foot(-0.21, 0.12, 0.05), foot(0.18, 0.12, 0.05));
  k.add('body', 0, cap(-0.05, 0.5, -0.14, 0.27, 0.046, 0.036), cap(-0.14, 0.27, -0.2, 0.04, 0.036, 0.026));
  k.add('body', 0, cap(0.05, 0.5, 0.135, 0.27, 0.046, 0.036), cap(0.135, 0.27, 0.188, 0.04, 0.036, 0.026));
  // masses of ruffle tails
  k.add(
    'cloth',
    1,
    ruffle(0.0, 0.47, 0.0, 0.09, 0.05, 7),
    ruffle(-0.1, 0.46, -0.17, 0.13, 0.044, 6),
    ruffle(0.08, 0.46, 0.105, 0.24, 0.032, 4)
  );
  k.add('cloth', 2, P(-0.13, 0.62, 0.1, 0.62, 0.145, 0.54, 0.13, 0.43, 0.08, 0.49, 0.0, 0.44, -0.08, 0.47, -0.15, 0.41, -0.17, 0.52));
  k.add('gold', 3, P(-0.09, 0.6, 0.08, 0.6, 0.085, 0.64, -0.095, 0.64));
  k.add(
    'body',
    1,
    P(
      -0.065, 0.62, 0.065, 0.62, 0.095, 0.72, 0.14, 0.83, 0.14, 0.862, 0.03,
      0.872, -0.03, 0.872, -0.16, 0.862, -0.155, 0.83, -0.1, 0.72
    )
  );
  k.add('gold', 2, rib([-0.12, 0.85, -0.06, 0.79, 0.0, 0.72, 0.07, 0.66], [0.014, 0.018, 0.012]));
  k.add('body', 1, cap(0.0, 0.86, 0.03, 0.925, 0.036, 0.03));
  k.head(0.03, 0.925, 4, 1.15, () => {
    makuta(k, 1.35);
    raksasaFace(k, 'hook');
  });
  k.cut(
    hole(0.0, 0.76, 0.03),
    diamond(-0.03, 0.55, 0.024),
    hole(-0.19, 0.78, 0.014),
    hole(-0.22, 0.87, 0.011),
    ...dots([0.0, 0.45, 0.0, 0.12], 0.008, 4, 0.15, 0.75)
  );
  return finish('rahwana', k, {
    back: [-0.155, 0.85],
    front: [0.135, 0.85],
    upper: 0.25,
    fore: 0.26,
    width: 0.03,
    hand: 'splay',
  });
};

/** a rod: the gapit through the body, or a tuding from a hand */
const rod = (x1: number, y1: number, x2: number, y2: number): Poly =>
  cap(x1, y1, x2, y2, 0.008, 0.007);
const ROD_END = -0.16;

const top = (polys: Poly[]): number => {
  let m = 0;
  for (const p of polys)
    for (let k = 1; k < p.length; k += 2) m = Math.max(m, p[k]!);
  return m;
};

type Story = Pick<Figure, 'id' | 'name' | 'set' | 'role' | 'story'>;
type Paint = Pick<Figure, 'skin' | 'cloth' | 'face' | 'pattern'>;

const fig = (s: Story, b: Built, c: Paint): Figure => {
  const height = Math.max(top(b.body), 0.2);
  return {
    ...s,
    ...c,
    height,
    // the gapit runs from the crown down past the feet
    body: [...b.body, rod(0.005, height * 0.9, -0.01, ROD_END)].map(ccw),
    tags: [...b.tags, ['horn', 0]],
    holes: b.holes.map(ccw),
    back: b.back,
    neck: b.neck,
    arm: b.arm,
  };
};

const GOLD = '#d2a94e';
const BLACK = '#1d1a19';

export const FIGURES: Figure[] = [
  fig(
    {
      id: 'semar',
      name: 'Semar',
      set: 'punakawan',
      role: 'Clown-servant and hidden god',
      story:
        'The round old servant of the Pandawa, who in Javanese tradition is really the god Batara Ismaya, brother of Batara Guru, living as a commoner. He guides his masters with jokes and plain truth, and even the gods listen to him.',
    },
    semarB(),
    { skin: '#2b2522', cloth: '#d8c79a', face: '#eee6d4', pattern: 'parang' }
  ),
  fig(
    {
      id: 'gareng',
      name: 'Gareng',
      set: 'punakawan',
      role: "Semar's eldest son",
      story:
        "Once the proud knight Bambang Sukodadi, he became Semar's adopted eldest son. His crossed eyes, crooked arm and limp are read as lessons: look carefully, act carefully, and never take what is not yours.",
    },
    garengB(),
    { skin: '#1f1b1a', cloth: '#8c2d2d', face: '#d9a441', pattern: 'poleng' }
  ),
  fig(
    {
      id: 'petruk',
      name: 'Petruk',
      set: 'punakawan',
      role: "Semar's tall son",
      story:
        'Tall, long-nosed and long-armed, Petruk is the quick-tongued joker of the punakawan. In the lakon Petruk Dadi Ratu he hides the sacred Kalimasada and crowns himself king, until Bagong unmasks him.',
    },
    petrukB(),
    { skin: '#26201e', cloth: '#9b2a24', face: '#d9a441', pattern: 'kawung' }
  ),
  fig(
    {
      id: 'bagong',
      name: 'Bagong',
      set: 'punakawan',
      role: "Made from Semar's shadow",
      story:
        'Semar asked for a companion and was told his truest friend was his own shadow; the shadow became Bagong. The youngest and least polite punakawan, he says out loud what everyone else only thinks.',
    },
    bagongB(),
    { skin: '#2a2421', cloth: '#2a2a2e', face: '#f1ebdd', pattern: 'kawung' }
  ),
  fig(
    {
      id: 'yudhistira',
      name: 'Yudhistira',
      set: 'pandawa',
      role: 'Eldest of the Pandawa',
      story:
        'Also called Puntadewa, the patient, honest king of Amarta and eldest of the five brothers. His only weapon is the sacred book Jamus Kalimasada.',
    },
    yudhisB(),
    { skin: GOLD, cloth: '#e6d6a8', face: BLACK }
  ),
  fig(
    {
      id: 'bima',
      name: 'Bima',
      set: 'pandawa',
      role: 'The strongest Pandawa',
      story:
        'The second Pandawa, also called Werkudara, son of the wind god Bayu. He speaks plainly to everyone, even the gods, and fights with his club Rujakpolo and the thumbnail Pancanaka.',
    },
    bimaB('bima', { s: 1.02, stance: 0.85 }),
    { skin: GOLD, cloth: '#f1ece0', face: BLACK, pattern: 'poleng' }
  ),
  fig(
    {
      id: 'arjuna',
      name: 'Arjuna',
      set: 'pandawa',
      role: 'The archer knight',
      story:
        'The third Pandawa, the finest archer and the most refined of the brothers: calm outside, fierce in battle. As the hermit Begawan Ciptoning on Mount Indrakila he won the arrow Pasopati from the gods.',
    },
    arjunaB(),
    { skin: GOLD, cloth: '#a8342c', face: BLACK }
  ),
  fig(
    {
      id: 'nakula',
      name: 'Nakula',
      set: 'pandawa',
      role: 'Twin son of Madrim',
      story:
        'One of the twin sons of Pandu and Madrim. In the Mahabharata he is the handsomest of the brothers and a master of horses.',
    },
    twinB('nakula', 'round'),
    { skin: GOLD, cloth: '#3f6b74', face: BLACK }
  ),
  fig(
    {
      id: 'sadewa',
      name: 'Sadewa',
      set: 'pandawa',
      role: 'The youngest Pandawa',
      story:
        "Nakula's twin and the youngest brother, wise in the reading of stars and fate. In the old Javanese tale Sudamala, with Semar beside him, he frees the goddess Durga from a curse.",
    },
    twinB('sadewa', 'diamond'),
    { skin: GOLD, cloth: '#6a4a86', face: BLACK }
  ),
  fig(
    {
      id: 'duryudana',
      name: 'Duryudana',
      set: 'kurawa',
      role: 'King of Astina',
      story:
        "Eldest of the hundred Kurawa and king of Astina, who would rather go to war than share the kingdom with his Pandawa cousins. He falls to Bima's club at the end of the Baratayuda.",
    },
    duryuB(),
    { skin: GOLD, cloth: '#2f6a3c', face: '#a8382a' }
  ),
  fig(
    {
      id: 'sengkuni',
      name: 'Sengkuni',
      set: 'kurawa',
      role: "Patih of Astina, the Kurawa's uncle",
      story:
        'Patih of Astina and uncle of the Kurawa, also called Harya Suman. Behind nearly every trap for the Pandawa, from the dice game onward, stands Sengkuni.',
    },
    sengkuniB(),
    { skin: '#c9a27a', cloth: '#4f5a2e', face: '#d9a98a' }
  ),
  fig(
    {
      id: 'guru',
      name: 'Batara Guru',
      set: 'dewa',
      role: 'King of the gods',
      story:
        'Batara Guru, also called Manikmaya, rules the gods from his heaven. The Javanese wayang shows him with four arms, riding the bull Nandini. Disguised as a hunter, he tests Arjuna on Mount Indrakila.',
    },
    guruB(),
    { skin: GOLD, cloth: '#7d2a3a', face: BLACK }
  ),
  fig(
    {
      id: 'dewaruci',
      name: 'Dewaruci',
      set: 'dewa',
      role: 'The tiny god in the sea',
      story:
        "A god small enough to stand on Bima's palm, but with Bima's own face, waiting at the bottom of the sea. Bima enters his left ear, finds a whole world inside, and learns that the water of life was within him.",
    },
    bimaB('dewaruci', { s: 0.56, head: 1.3, stance: 0.6 }),
    { skin: GOLD, cloth: '#5f8fb0', face: '#d98a7a' }
  ),
  fig(
    {
      id: 'cakil',
      name: 'Cakil',
      set: 'raksasa',
      role: 'The jutting-jawed giant',
      story:
        'A giant with a jutting lower jaw, a Javanese invention not found in the Indian epics. Restless and loyal, he challenges the knight in the perang kembang (flower battle), and always loses, often to his own keris.',
    },
    cakilB(),
    { skin: GOLD, cloth: '#2f6f7a', face: '#d0604f' }
  ),
  fig(
    {
      id: 'buta',
      name: 'Buta Terong',
      set: 'raksasa',
      role: 'The eggplant-nosed giant',
      story:
        'A stock giant named for his nose, shaped like a terong (eggplant). Giants like him storm in as soldiers and guards whenever a lakon needs a fight.',
    },
    butaB(),
    { skin: '#a5482e', cloth: '#2d2a4a', face: '#c4382a' }
  ),
  fig(
    {
      id: 'rama',
      name: 'Rama',
      set: 'ramayana',
      role: 'The exiled prince of Ayodya',
      story:
        'Prince of Ayodya, also called Ramawijaya or Regawa. Exiled to the forest, he loses his wife Sinta to Rahwana and wins her back with the monkey army of Sugriwa and Hanoman.',
    },
    ramaB(),
    { skin: GOLD, cloth: '#2f6b4f', face: BLACK }
  ),
  fig(
    {
      id: 'sinta',
      name: 'Sinta',
      set: 'ramayana',
      role: "Rama's wife",
      story:
        "Held in the Argasoka garden of Alengka, she will not bow to Rahwana. When a white monkey shows her Rama's ring, she sends back a jewel from her hair.",
    },
    sintaB(),
    { skin: GOLD, cloth: '#6a2a5a', face: '#e0b45a' }
  ),
  fig(
    {
      id: 'hanoman',
      name: 'Hanoman',
      set: 'ramayana',
      role: 'The white monkey',
      story:
        "Son of the wind god Bayu and Anjani, white as cotton, with the same Pancanaka thumbnail as Bima. As Rama's envoy he leaps the sea, finds Sinta and sets Alengka on fire.",
    },
    hanomanB(),
    { skin: '#efe9dc', cloth: '#f1ece0', face: '#f6f1e6', pattern: 'poleng' }
  ),
  fig(
    {
      id: 'rahwana',
      name: 'Rahwana',
      set: 'raksasa',
      role: 'The giant king of Alengka',
      story:
        'Also called Dasamuka, "the ten-faced". In the Javanese tellings his magic arts keep him from dying; he carried off Sinta and will not give her back.',
    },
    rahwanaB(),
    { skin: '#d39a52', cloth: '#2f6b3a', face: '#b53a26' }
  ),
];

export const figure = (id: string): Figure => {
  const f = FIGURES.find((x) => x.id === id);
  if (!f) throw new Error(`unknown figure ${id}`);
  return f;
};

/** arm positions: shoulder angle and elbow bend, degrees, facing +x */
/** The joints a dalang moves. Each one cycles through three positions. */
export type Joints = {
  /** front shoulder: down, forward, up */
  arm: number;
  /** front elbow: straight, bent, folded */
  elbow: number;
  /** back shoulder, swinging behind the body */
  back: number;
  backElbow: number;
  /** head: level, bowed, raised */
  head: number;
};

export const SHOULDER = [-95, -15, 65];
export const ELBOW = [12, 50, 100];
export const HEAD = [0, -14, 14];
export const SHOULDER_NAMES = ['down', 'forward', 'up'] as const;
export const ELBOW_NAMES = ['straight', 'bent', 'folded'] as const;
export const HEAD_NAMES = ['level', 'bowed', 'raised'] as const;

export const REST: Joints = {
  arm: 0,
  elbow: 0,
  back: 0,
  backElbow: 0,
  head: 0,
};

/**
 * One arm as polygons. The back arm is the front arm mirrored about its own
 * shoulder, so "forward" for it means reaching behind the body.
 */
export const armPolys = (
  f: Figure,
  side: 'front' | 'back',
  shoulder: number,
  elbow: number
): Poly[] => {
  const [ox, sy] = side === 'front' ? f.arm.shoulder : f.back;
  const mx = side === 'front' ? 1 : -1;
  const a0 = SHOULDER[shoulder] ?? SHOULDER[0]!;
  const bend = ELBOW[elbow] ?? ELBOW[0]!;
  // built facing +x from x = 0, then placed (and mirrored for the back arm)
  const sx = 0;
  const r1 = (a0 * Math.PI) / 180;
  const ex = sx + Math.cos(r1) * f.arm.upper;
  const ey = sy + Math.sin(r1) * f.arm.upper;
  const r2 = ((a0 + bend) * Math.PI) / 180;
  const wx = ex + Math.cos(r2) * f.arm.fore;
  const wy = ey + Math.sin(r2) * f.arm.fore;
  const w = f.arm.width * (side === 'front' ? 1 : 0.92);
  const out: Poly[] = [
    cap(sx, sy, ex, ey, w, w * 0.85),
    cap(ex, ey, wx, wy, w * 0.85, w * 0.65),
  ];
  const hx = wx + Math.cos(r2) * w * 1.6;
  const hy = wy + Math.sin(r2) * w * 1.6;
  const along = (a: number, d: number): [number, number] => [
    hx + Math.cos(r2 + a) * d,
    hy + Math.sin(r2 + a) * d,
  ];
  if (f.arm.hand === 'claw') {
    // the Pancanaka: a long thumbnail curving out of the fist
    const [ax, ay] = along(0.45, w * 1.9);
    const [bx, by] = along(0.95, w * 3.4);
    out.push(
      ell(hx, hy, w * 1.4, w * 1.1, 10, r2),
      cap(hx, hy, ax, ay, w * 0.6, w * 0.4),
      cap(ax, ay, bx, by, w * 0.4, w * 0.12)
    );
  } else if (f.arm.hand === 'fist') {
    out.push(ell(hx, hy, w * 1.3, w * 1.3, 10));
  } else if (f.arm.hand === 'splay') {
    // splayed fingers with short claws
    out.push(ell(hx, hy, w * 1.3, w * 1.0, 10, r2));
    for (const a of [-0.6, 0, 0.6]) {
      const [fx, fy] = along(a, w * 3);
      out.push(cap(hx, hy, fx, fy, w * 0.42, w * 0.14));
    }
  } else {
    // a narrow alus hand, the index finger pointing (nuding)
    const [px, py] = along(0, w * 1.1);
    const [fx, fy] = along(0.12, w * 3.6);
    out.push(
      ell(px, py, w * 1.6, w * 0.72, 10, r2),
      cap(px, py, fx, fy, w * 0.36, w * 0.18)
    );
  }
  // the tuding: the dalang works the arm with a rod hanging from the hand
  out.push(rod(hx, hy, hx + 0.04, ROD_END));
  return out.map((q) =>
    ccw(q.map((v, k) => (k % 2 === 0 ? ox + mx * v : v)))
  );
};

/** what each polygon armPolys returns is: upper arm, forearm, hand pieces, rod */
export const armKinds = (hand: Hand): Kind[] => {
  const hands: Record<Hand, Kind[]> = {
    open: ['body', 'body'],
    fist: ['body'],
    claw: ['body', 'gold', 'gold'],
    splay: ['body', 'body', 'body', 'body'],
  };
  return ['body', 'body', ...hands[hand], 'horn'];
};

const headCache = new Map<string, { head: Set<number>; holes: Set<number> }>();

/** which body polygons and holes belong to the head (everything above the neck) */
const headOf = (f: Figure) => {
  const hit = headCache.get(f.id);
  if (hit) return hit;
  const above = (q: Poly) => {
    let lo = Infinity;
    for (let k = 1; k < q.length; k += 2) lo = Math.min(lo, q[k]!);
    return lo >= f.neck[1] - 0.005;
  };
  const out = {
    head: new Set(f.body.flatMap((q, k) => (above(q) ? [k] : []))),
    holes: new Set(f.holes.flatMap((q, k) => (above(q) ? [k] : []))),
  };
  headCache.set(f.id, out);
  return out;
};

const turnAbout = (q: Poly, cx: number, cy: number, deg: number): Poly => {
  if (deg === 0) return q;
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const sn = Math.sin(r);
  const out: Poly = new Array<number>(q.length);
  for (let k = 0; k < q.length; k += 2) {
    const x = q[k]! - cx;
    const y = q[k + 1]! - cy;
    out[k] = cx + x * c - y * sn;
    out[k + 1] = cy + x * sn + y * c;
  }
  return out;
};

/**
 * A posed figure in its own frame. The body (with the head turned) loses its
 * carved holes; the arms are separate pieces held in front, so they are not
 * holed. That is also how the shadow is scored.
 */
export const figureParts = (
  f: Figure,
  j: Joints
): { body: Poly[]; holes: Poly[]; arms: Poly[] } => {
  const { head, holes } = headOf(f);
  const deg = HEAD[j.head] ?? 0;
  const [nx, ny] = f.neck;
  return {
    body: f.body.map((q, k) => (head.has(k) ? turnAbout(q, nx, ny, deg) : q)),
    holes: f.holes.map((q, k) =>
      holes.has(k) ? turnAbout(q, nx, ny, deg) : q
    ),
    arms: [
      ...armPolys(f, 'back', j.back, j.backElbow),
      ...armPolys(f, 'front', j.arm, j.elbow),
    ],
  };
};
