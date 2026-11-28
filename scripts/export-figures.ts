/**
 * Dumps every wayang for the Blender build (tools/blender/build_wayang.py):
 * each body polygon tagged with what it is (skin, face, cloth, hair, gold...),
 * a stacking layer and whether it belongs to the turning head, the carved
 * holes (head or not), the neck pivot, both arms in all nine shoulder/elbow
 * positions, where the eyes and bracelets go, and the colours.
 *
 *   node --experimental-strip-types scripts/export-figures.ts
 *
 * The tags follow the polygon order in src/shared/figures.ts: if a body kit
 * gains or loses a polygon, update its list here (the script checks counts).
 * Which polygons are the head is the engine's own split (figureParts), read
 * back here, so the 3D head turns exactly what the scored shadow turns.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  ELBOW,
  FIGURES,
  HEAD,
  REST,
  SHOULDER,
  armPolys,
  figureParts,
  type Figure,
} from '../src/shared/figures.ts';
import type { Poly } from '../src/shared/grid.ts';

type Kind = 'body' | 'face' | 'cloth' | 'hair' | 'gold' | 'white' | 'horn';
/** kind and stacking layer (higher = nearer the viewer's side of the slab) */
type Tag = [Kind, number];

const B = (l = 0): Tag => ['body', l];
const F = (l = 3): Tag => ['face', l];
const C = (l = 2): Tag => ['cloth', l];
const H = (l = 4): Tag => ['hair', l];
const G = (l = 4): Tag => ['gold', l];
const W = (l = 5): Tag => ['white', l];

const feetLegs = [B(), B(), B(), B()];
/** feet, legs, dodot, torso, neck, head, nose, chin */
const alus10 = [...feetLegs, C(), B(1), B(1), F(), F(4), F(4)];
const crowns: Record<string, Tag[]> = {
  gelung: [H(), H(), H()],
  makuta: [G(5), H(2)],
  topong: [G(5), H(2)],
  jamang: [G(5), H(2)],
};
const alus = (crown: string, extra: Tag[] = []) => [
  ...alus10,
  ...crowns[crown]!,
  ...extra,
];
const bima = [...feetLegs, C(), B(1), B(1), F(), F(4), H(), H(), H()];
const buta = [...feetLegs, B(1.5), C(), B(1), B(1), F(), F(4), W(), G(), H(2)];

/** per figure: tags for the body polygons (before the gapit), head index */
const TAGS: Record<string, { tags: Tag[]; head: number }> = {
  semar: {
    tags: [...feetLegs, B(1), B(-1), C(), F(), F(4), F(4), H(), H()],
    head: 7,
  },
  gareng: { tags: [...feetLegs, C(), B(1), F(), F(4), H()], head: 6 },
  petruk: { tags: [...feetLegs, C(), B(1), B(1), F(), F(4), H()], head: 7 },
  bagong: { tags: [...feetLegs, B(1), C(), F(), F(4), F(4)], head: 6 },
  yudhistira: { tags: alus('jamang'), head: 7 },
  bima: { tags: bima, head: 7 },
  arjuna: { tags: alus('gelung'), head: 7 },
  nakula: { tags: alus('topong'), head: 7 },
  sadewa: { tags: alus('topong'), head: 7 },
  duryudana: { tags: alus('makuta'), head: 7 },
  sengkuni: { tags: alus('jamang', [B(-1), G(6), F(4)]), head: 7 },
  guru: { tags: alus('makuta', [B(-3), B(-3), B(-3), G(6), G(-4)]), head: 7 },
  dewaruci: { tags: bima, head: 7 },
  cakil: {
    tags: [...feetLegs, C(), B(1), B(1), F(), F(4), W(), H(5), H(2), H(2)],
    head: 7,
  },
  buta: { tags: buta, head: 8 },
  rama: { tags: alus('makuta'), head: 7 },
  sinta: {
    tags: [B(), C(), C(-1), B(1), B(1), F(), F(4), H(), H(), G(5)],
    head: 5,
  },
  hanoman: {
    tags: [
      ...feetLegs,
      C(),
      B(1),
      B(-1),
      B(-1),
      B(-1),
      B(1),
      F(),
      F(4),
      H(),
      H(),
    ],
    head: 10,
  },
  rahwana: { tags: [...buta, G(5), G(5), G(5)], head: 8 },
};

const GOLD = '#e2b247';
const BLACK = '#2a2321';
/** vinyl-toy colours, after the Dalang VR figures */
const PALETTE: Record<
  string,
  Partial<Record<Kind, string>> & { bracelet?: string }
> = {
  semar: {
    body: '#2a2321',
    face: '#f1e9d6',
    cloth: '#c9b37a',
    bracelet: '#c0302a',
  },
  gareng: { body: '#3a2f2a', face: '#3a2f2a', cloth: '#a8302c' },
  petruk: { body: '#262020', face: '#d9a441', cloth: '#b5332b' },
  bagong: { body: '#352b27', face: '#352b27', cloth: '#5b8a3a' },
  yudhistira: { body: GOLD, face: BLACK, cloth: '#efe4c2' },
  bima: { body: BLACK, face: BLACK, cloth: '#d9b84e' },
  arjuna: { body: GOLD, face: BLACK, cloth: '#9b2f2f' },
  nakula: { body: GOLD, face: BLACK, cloth: '#3f7b86' },
  sadewa: { body: GOLD, face: BLACK, cloth: '#7a54a0' },
  duryudana: { body: '#a3322a', face: '#a3322a', cloth: '#d4a23a' },
  sengkuni: { body: '#d8c09a', face: '#d8c09a', cloth: '#56662e' },
  guru: { body: '#e0b85a', face: '#e0b85a', cloth: '#8a2f44' },
  dewaruci: { body: '#e8b96a', face: '#e8b96a', cloth: '#2f5f8f' },
  cakil: { body: '#efe3c4', face: '#e8908a', cloth: '#cf4436' },
  buta: { body: '#b8322a', face: '#b8322a', cloth: '#2d2a4a' },
  rama: { body: GOLD, face: BLACK, cloth: '#2f6b4f' },
  sinta: { body: '#e3bc62', face: '#e3bc62', cloth: '#7a2f66' },
  hanoman: {
    body: '#f2ede2',
    face: '#f2ede2',
    cloth: '#3b3532',
    hair: '#2a2321',
  },
  rahwana: { body: '#9a2430', face: '#9a2430', cloth: '#2a2348' },
};
const BASE: Record<Kind, string> = {
  body: BLACK,
  face: BLACK,
  cloth: '#888888',
  hair: '#1a1412',
  gold: GOLD,
  white: '#f5efe2',
  horn: '#4a3220',
};

const bbox = (p: Poly) => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let k = 0; k < p.length; k += 2) {
    x0 = Math.min(x0, p[k]!);
    x1 = Math.max(x1, p[k]!);
    y0 = Math.min(y0, p[k + 1]!);
    y1 = Math.max(y1, p[k + 1]!);
  }
  return { x0, y0, x1, y1 };
};

/** the polygons the engine turns with the head: the ones a bowed head moves */
const headSet = (f: Figure, which: 'body' | 'holes') => {
  const rest = figureParts(f, REST)[which];
  const bowed = figureParts(f, { ...REST, head: 1 })[which];
  return new Set(
    rest.flatMap((q, k) => (q.some((v, i) => v !== bowed[k]![i]) ? [k] : []))
  );
};

/** front arm layer; the back arm hangs about as far behind the body */
const FRONT_LAYER = 7;
const BACK_LAYER = -8;

const armOf = (f: Figure, side: 'front' | 'back', s: number, e: number) => {
  const polys = armPolys(f, side, s, e);
  const [ox, sy] = side === 'front' ? f.arm.shoulder : f.back;
  const mx = side === 'front' ? 1 : -1;
  const r1 = (SHOULDER[s]! * Math.PI) / 180;
  const ex = Math.cos(r1) * f.arm.upper;
  const ey = sy + Math.sin(r1) * f.arm.upper;
  const r2 = ((SHOULDER[s]! + ELBOW[e]!) * Math.PI) / 180;
  const wx = ex + Math.cos(r2) * f.arm.fore;
  const wy = ey + Math.sin(r2) * f.arm.fore;
  const base = side === 'front' ? FRONT_LAYER : BACK_LAYER;
  const tags: Tag[] = [B(base), B(base), B(base + 0.5)];
  if (f.arm.hand === 'claw') tags.push(['gold', base + 0.5]);
  tags.push(['horn', base - 2]);
  if (tags.length !== polys.length) throw new Error(`${f.id}: arm tags`);
  const w = f.arm.width * (side === 'front' ? 1 : 0.92);
  return {
    side,
    shoulder: s,
    elbow: e,
    layer: base,
    parts: polys.map((poly, k) => ({
      poly,
      kind: tags[k]![0],
      layer: tags[k]![1],
    })),
    // the bracelet sits on the forearm just above the hand
    wrist: [
      ox + mx * (wx - Math.cos(r2) * w * 0.6),
      wy - Math.sin(r2) * w * 0.6,
    ],
    /** forearm direction in the figure frame */
    angle: side === 'front' ? r2 : Math.PI - r2,
    width: w * 0.7,
  };
};

const out = FIGURES.map((f) => {
  const t = TAGS[f.id];
  if (!t) throw new Error(`no tags for ${f.id}`);
  const n = f.body.length - 1; // the last one is the gapit
  if (t.tags.length !== n)
    throw new Error(`${f.id}: ${t.tags.length} tags for ${n} body polygons`);
  const headBody = headSet(f, 'body');
  const headHoles = headSet(f, 'holes');
  if (!headBody.has(t.head))
    console.warn(`${f.id}: the head polygon ${t.head} does not turn`);
  const parts = f.body.map((poly, k) => ({
    poly,
    kind: k < n ? t.tags[k]![0] : ('horn' as Kind),
    layer: k < n ? t.tags[k]![1] : 0,
    head: headBody.has(k),
  }));
  const hb = bbox(f.body[t.head]!);
  const pal = PALETTE[f.id] ?? {};
  const colors = { ...BASE, ...pal } as Record<Kind, string>;
  return {
    id: f.id,
    name: f.name,
    set: f.set,
    height: f.height,
    colors,
    bracelet: pal.bracelet ?? GOLD,
    parts,
    holes: f.holes.map((poly, k) => ({ poly, head: headHoles.has(k) })),
    neck: f.neck,
    shoulders: { front: f.arm.shoulder, back: f.back },
    head: {
      cx: (hb.x0 + hb.x1) / 2,
      cy: (hb.y0 + hb.y1) / 2,
      rx: (hb.x1 - hb.x0) / 2,
      ry: (hb.y1 - hb.y0) / 2,
      /** the eyes turn with the head when the face polygon does */
      turns: headBody.has(t.head),
    },
    /** side * 9 + shoulder * 3 + elbow, side 0 front, 1 back */
    arms: (['front', 'back'] as const).flatMap((side) =>
      [0, 1, 2].flatMap((s) => [0, 1, 2].map((e) => armOf(f, side, s, e)))
    ),
  };
});

mkdirSync('tools/blender', { recursive: true });
writeFileSync(
  'tools/blender/figures.json',
  JSON.stringify({ head: HEAD, shoulder: SHOULDER, elbow: ELBOW, figures: out })
);
console.log(`wrote tools/blender/figures.json (${out.length} figures)`);
