/**
 * Dumps every wayang for the Blender build (tools/blender/build_wayang.py):
 * each body polygon tagged with what it is (skin, face, cloth, hair, gold...),
 * a stacking layer and whether it belongs to the turning head, the carved
 * holes (head or not), the neck pivot, both arms in all nine shoulder/elbow
 * positions, where the eyes and bracelets go, and the colours.
 *
 *   node --experimental-strip-types scripts/export-figures.ts
 *
 * The tags (kind and layer) come from the figures themselves (Figure.tags),
 * and so do the body, face and cloth colours. Which polygons are the head is the engine's own split (figureParts), read
 * back here, so the 3D head turns exactly what the scored shadow turns.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  ELBOW,
  FIGURES,
  HEAD,
  REST,
  SHOULDER,
  armKinds,
  armPolys,
  figureParts,
  type Figure,
} from '../src/shared/figures.ts';
import type { Poly } from '../src/shared/grid.ts';

type Kind = Figure['tags'][number][0];
type Tag = [Kind, number];

const GOLD = '#e2b247';
const BLACK = '#2a2321';
/** extra colours per figure (the rest come from the figure) */
const EXTRA: Record<string, { hair?: string; bracelet?: string }> = {
  semar: { bracelet: '#c0302a' },
  hanoman: { hair: '#2a2321' },
};
const BASE: Record<Kind, string> = {
  body: BLACK,
  face: BLACK,
  cloth: '#888888',
  hair: '#1a1412',
  gold: GOLD,
  white: '#f5efe2',
  horn: '#4a3220',
  red: '#a8302a',
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
  const tags: Tag[] = armKinds(f.arm.hand).map((kind, k): Tag => [
    kind,
    kind === 'horn' ? base - 2 : k < 2 ? base : base + 0.5,
  ]);
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
  const headBody = headSet(f, 'body');
  const headHoles = headSet(f, 'holes');
  const parts = f.body.map((poly, k) => ({
    poly,
    kind: f.tags[k]![0],
    layer: f.tags[k]![1],
    head: headBody.has(k),
  }));
  // the face polygon: the biggest face piece that turns with the head
  let face = -1;
  let best = -1;
  f.body.forEach((q, k) => {
    if (f.tags[k]![0] !== 'face' || !headBody.has(k)) return;
    const b = bbox(q);
    const a = (b.x1 - b.x0) * (b.y1 - b.y0);
    if (a > best) {
      best = a;
      face = k;
    }
  });
  if (face < 0) throw new Error(`${f.id}: no face polygon in the head`);
  const hb = bbox(f.body[face]!);
  const extra = EXTRA[f.id] ?? {};
  const colors: Record<Kind, string> = {
    ...BASE,
    body: f.skin,
    face: f.face,
    cloth: f.cloth,
    ...(extra.hair ? { hair: extra.hair } : {}),
  };
  return {
    id: f.id,
    name: f.name,
    set: f.set,
    height: f.height,
    colors,
    bracelet: extra.bracelet ?? GOLD,
    pattern: f.pattern ?? null,
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
      turns: true,
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
