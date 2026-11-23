/**
 * Dumps every wayang for the Blender build (tools/blender/build_wayang.py):
 * each body polygon tagged with what it is (skin, face, cloth, hair, gold...)
 * and a stacking layer, the carved holes, the front arm in its three poses,
 * where the eyes and bracelets go, and the colours.
 *
 *   node --experimental-strip-types scripts/export-figures.ts
 *
 * The tags follow the polygon order in src/shared/figures.ts: if a body kit
 * gains or loses a polygon, update its list here (the script checks counts).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  ARM_POSES,
  FIGURES,
  armPolys,
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
const alus13 = [
  ...feetLegs,
  C(),
  B(1),
  B(1),
  F(),
  F(4),
  F(4),
  B(-2),
  B(-2),
  B(-2),
];
const crowns: Record<string, Tag[]> = {
  gelung: [H(), H(), H()],
  makuta: [G(5), H(2)],
  topong: [G(5), H(2)],
  jamang: [G(5), H(2)],
};
const alus = (crown: string, extra: Tag[] = []) => [
  ...alus13,
  ...crowns[crown]!,
  ...extra,
];

/** per figure: tags for the body polygons (before the two rods), head index */
const TAGS: Record<string, { tags: Tag[]; head: number }> = {
  semar: {
    tags: [
      ...feetLegs,
      B(1),
      B(-1),
      C(),
      F(),
      F(4),
      F(4),
      H(),
      H(),
      B(-2),
      B(-2),
    ],
    head: 7,
  },
  gareng: { tags: [...feetLegs, C(), B(1), F(), F(4), H(), B(-2)], head: 6 },
  petruk: {
    tags: [...feetLegs, C(), B(1), B(1), F(), F(4), H(), B(-2), B(-2)],
    head: 7,
  },
  bagong: { tags: [...feetLegs, B(1), C(), F(), F(4), F(4), B(-2)], head: 6 },
  yudhistira: { tags: alus('jamang'), head: 7 },
  bima: {
    tags: [
      ...feetLegs,
      C(),
      B(1),
      B(1),
      F(),
      F(4),
      H(),
      H(),
      H(),
      B(-2),
      B(-2),
      B(-2),
    ],
    head: 7,
  },
  arjuna: { tags: alus('gelung'), head: 7 },
  nakula: { tags: alus('topong'), head: 7 },
  sadewa: { tags: alus('topong'), head: 7 },
  duryudana: { tags: alus('makuta'), head: 7 },
  sengkuni: { tags: alus('jamang', [B(-1), G(6), F(4)]), head: 7 },
  guru: { tags: alus('makuta', [B(-3), B(-3), B(-3), G(6), G(-4)]), head: 7 },
  dewaruci: {
    tags: [
      ...feetLegs,
      C(),
      B(1),
      B(1),
      F(),
      F(4),
      H(),
      H(),
      H(),
      B(-2),
      B(-2),
      B(-2),
    ],
    head: 7,
  },
  cakil: {
    tags: [
      ...feetLegs,
      C(),
      B(1),
      B(1),
      F(),
      F(4),
      W(),
      H(5),
      H(2),
      H(2),
      B(-2),
      B(-2),
    ],
    head: 7,
  },
  buta: {
    tags: [
      ...feetLegs,
      B(1.5),
      C(),
      B(1),
      B(1),
      F(),
      F(4),
      W(),
      G(),
      H(2),
      B(-2),
      B(-2),
      B(-2),
    ],
    head: 8,
  },
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

const armOf = (f: Figure, pose: number) => {
  const polys = armPolys(f, pose);
  const [sx, sy] = f.arm.shoulder;
  const [a0, bend] = ARM_POSES[pose]!;
  const r1 = (a0 * Math.PI) / 180;
  const ex = sx + Math.cos(r1) * f.arm.upper;
  const ey = sy + Math.sin(r1) * f.arm.upper;
  const r2 = ((a0 + bend) * Math.PI) / 180;
  const wx = ex + Math.cos(r2) * f.arm.fore;
  const wy = ey + Math.sin(r2) * f.arm.fore;
  const claw = f.arm.hand === 'claw';
  const tags: Tag[] = [B(7), B(7), B(7.5)];
  if (claw) tags.push(['gold', 7.5]);
  tags.push(['horn', 0]);
  if (tags.length !== polys.length) throw new Error(`${f.id}: arm tags`);
  return {
    parts: polys.map((poly, k) => ({
      poly,
      kind: tags[k]![0],
      layer: tags[k]![1],
    })),
    // the bracelet sits on the forearm just above the hand
    wrist: [
      wx - Math.cos(r2) * f.arm.width * 0.6,
      wy - Math.sin(r2) * f.arm.width * 0.6,
    ],
    angle: r2,
    width: f.arm.width * 0.7,
  };
};

const out = FIGURES.map((f) => {
  const t = TAGS[f.id];
  if (!t) throw new Error(`no tags for ${f.id}`);
  const n = f.body.length - 2; // the last two are the gapit and the back tuding
  if (t.tags.length !== n)
    throw new Error(`${f.id}: ${t.tags.length} tags for ${n} body polygons`);
  const parts = f.body.map((poly, k) =>
    k < n
      ? { poly, kind: t.tags[k]![0], layer: t.tags[k]![1] }
      : { poly, kind: 'horn' as Kind, layer: 0 }
  );
  const hb = bbox(f.body[t.head]!);
  const pal = PALETTE[f.id] ?? {};
  const colors = { ...BASE, ...pal } as Record<Kind, string>;
  return {
    id: f.id,
    name: f.name,
    height: f.height,
    colors,
    bracelet: pal.bracelet ?? GOLD,
    parts,
    holes: f.holes,
    head: {
      cx: (hb.x0 + hb.x1) / 2,
      cy: (hb.y0 + hb.y1) / 2,
      rx: (hb.x1 - hb.x0) / 2,
      ry: (hb.y1 - hb.y0) / 2,
    },
    backHand: f.backHand,
    arms: [0, 1, 2].map((a) => armOf(f, a)),
  };
});

mkdirSync('tools/blender', { recursive: true });
writeFileSync('tools/blender/figures.json', JSON.stringify({ figures: out }));
console.log(`wrote tools/blender/figures.json (${out.length} figures)`);
