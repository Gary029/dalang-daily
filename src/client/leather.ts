import {
  armKinds,
  type Figure,
  type Kind,
  type Pattern,
} from '../shared/figures.ts';
import type { Poly } from '../shared/grid.ts';

/**
 * The painted side of a puppet: every polygon in the colour of what it is
 * (prada-gold body, the wanda colour of the face, black hair, gold jewellery,
 * the patterned kain), fine gilt lines on the edges, then the carved holes.
 * The context's transform must map figure units (y up) to pixels.
 */

const HAIR = '#17120f';
const JEWEL = '#e0b85a';
const WHITE = '#f3ecdc';
const HORN = '#2b1d14';
const RED = '#a8302a';
const LOCKED = '#2a2235';

const colourOf = (f: Figure, k: Kind): string => {
  switch (k) {
    case 'body':
      return f.skin;
    case 'face':
      return f.face;
    case 'cloth':
      return f.cloth;
    case 'hair':
      return HAIR;
    case 'gold':
      return JEWEL;
    case 'white':
      return WHITE;
    case 'horn':
      return HORN;
    case 'red':
      return RED;
  }
};

const pathOf = (polys: Poly[]): Path2D => {
  const p = new Path2D();
  for (const q of polys) {
    if (q.length < 6) continue;
    p.moveTo(q[0]!, q[1]!);
    for (let k = 2; k < q.length; k += 2) p.lineTo(q[k]!, q[k + 1]!);
    p.closePath();
  }
  return p;
};

/** pattern tiles, 32 px, and the size of one tile in figure units */
const TILE = 32;
const tiles = new Map<string, HTMLCanvasElement>();
const tile = (name: Pattern | 'ceplok'): HTMLCanvasElement => {
  const hit = tiles.get(name);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = TILE;
  c.height = TILE;
  const g = c.getContext('2d')!;
  const h = TILE / 2;
  if (name === 'poleng') {
    // kampuh poleng: black and white checks, a red one now and then
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? '#1c1a1a' : i ? RED : '#efe9da';
        g.fillRect(i * h, j * h, h, h);
      }
  } else if (name === 'parang') {
    // parang: diagonal bands of linked blades
    g.strokeStyle = 'rgba(40, 20, 10, 0.45)';
    g.lineWidth = 5;
    for (const o of [-TILE, 0, TILE]) {
      g.beginPath();
      g.moveTo(o, TILE);
      g.lineTo(o + TILE, 0);
      g.stroke();
    }
    g.fillStyle = 'rgba(255, 244, 220, 0.5)';
    for (const o of [-h, h])
      for (let k = 0; k < 2; k++) {
        g.beginPath();
        g.arc(o + h + k * h * 0.5, h - k * h * 0.5, 2.2, 0, Math.PI * 2);
        g.fill();
      }
  } else if (name === 'kawung') {
    // kawung: four ovals round a dot, like a palm fruit cut across
    g.fillStyle = 'rgba(255, 244, 220, 0.6)';
    for (const [x, y, r] of [
      [h, h / 2, 0],
      [h, h * 1.5, 0],
      [h / 2, h, Math.PI / 2],
      [h * 1.5, h, Math.PI / 2],
    ] as const) {
      g.beginPath();
      g.ellipse(x, y, h * 0.42, h * 0.24, r + Math.PI / 2, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(30, 20, 15, 0.6)';
    g.beginPath();
    g.arc(h, h, 2, 0, Math.PI * 2);
    g.fill();
  } else {
    // ceplok: a sprinkle of little gilt diamonds
    g.fillStyle = 'rgba(255, 228, 160, 0.45)';
    for (const [x, y] of [
      [h / 2, h / 2],
      [h * 1.5, h * 1.5],
    ] as const) {
      g.beginPath();
      g.moveTo(x, y - 4);
      g.lineTo(x + 3, y);
      g.lineTo(x, y + 4);
      g.lineTo(x - 3, y);
      g.closePath();
      g.fill();
    }
  }
  tiles.set(name, c);
  return c;
};

const patternFor = (
  g: CanvasRenderingContext2D,
  name: Pattern | 'ceplok'
): CanvasPattern | null => {
  const p = g.createPattern(tile(name), 'repeat');
  if (!p) return null;
  // one tile is 0.045 figure units (0.06 for the bold poleng checks)
  const u = (name === 'poleng' ? 0.05 : 0.045) / TILE;
  p.setTransform(new DOMMatrix([u, 0, 0, u, 0, 0]));
  return p;
};

const EDGE = 'rgba(240, 200, 110, 0.55)';

export const paintLeather = (
  g: CanvasRenderingContext2D,
  f: Figure,
  parts: { body: Poly[]; holes: Poly[]; arms: Poly[] },
  locked = false
) => {
  g.lineJoin = 'round';
  const kinds = armKinds(f.arm.hand);
  const per = kinds.length;
  const backArm = parts.arms.slice(0, per);
  const frontArm = parts.arms.slice(per);
  const arm = (polys: Poly[]) =>
    polys.forEach((q, i) => {
      const path = pathOf([q]);
      g.fillStyle = locked ? LOCKED : colourOf(f, kinds[i] ?? 'body');
      g.fill(path);
      if (locked) return;
      g.lineWidth = 0.004;
      g.strokeStyle = EDGE;
      g.stroke(path);
    });
  // the back arm hangs behind the body
  arm(backArm);
  parts.body.forEach((q, i) => {
    const kind = f.tags[i]?.[0] ?? 'body';
    const path = pathOf([q]);
    g.fillStyle = locked ? LOCKED : colourOf(f, kind);
    g.fill(path);
    if (locked) return;
    if (kind === 'cloth') {
      const pat = patternFor(g, f.pattern ?? 'ceplok');
      if (pat) {
        g.fillStyle = pat;
        g.fill(path);
      }
    }
    g.lineWidth = 0.004;
    g.strokeStyle = EDGE;
    g.stroke(path);
  });
  const holes = pathOf(parts.holes);
  g.globalCompositeOperation = 'destination-out';
  g.fill(holes, 'nonzero');
  if (!locked) {
    // gold around each carved hole
    g.globalCompositeOperation = 'source-atop';
    g.lineWidth = 0.008;
    g.strokeStyle = '#e0b35a';
    g.stroke(holes);
  }
  g.globalCompositeOperation = 'source-over';
  // arms are not holed (that is how the shadow is scored): the back arm
  // shows through any hole it lies behind, the front arm is held in front
  g.save();
  g.clip(holes, 'nonzero');
  arm(backArm);
  g.restore();
  arm(frontArm);
};
