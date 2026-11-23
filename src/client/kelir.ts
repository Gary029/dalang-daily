import { GH, GW, type Poly } from '../shared/grid.ts';
import type { PlacedPolys } from '../shared/shadow.ts';

/**
 * Draws the kelir with smooth shadows. The grid decides the match; this only
 * paints it. Both come from the same polygons, so a true match looks true.
 */

export type KelirLayers = {
  shadow: PlacedPolys[];
  target: PlacedPolys[] | null;
  selected: PlacedPolys | null;
  /** 0..1, warms the cloth when solved */
  glow?: number;
  /** paint shadow that falls outside the outline red (off on the hardest days) */
  overflow?: boolean;
};

let clothCache: { w: number; h: number; c: HTMLCanvasElement } | null = null;

/** the cream cloth lit by the blencong lamp */
const cloth = (w: number, h: number): HTMLCanvasElement => {
  if (clothCache && clothCache.w === w && clothCache.h === h)
    return clothCache.c;
  const c = layer(w, h);
  const g = c.getContext('2d')!;
  const rad = g.createRadialGradient(
    w * 0.5,
    h * 0.4,
    h * 0.05,
    w * 0.5,
    h * 0.5,
    w * 0.62
  );
  rad.addColorStop(0, '#fff4d8');
  rad.addColorStop(0.45, '#f2dcae');
  rad.addColorStop(1, '#b98b55');
  g.fillStyle = rad;
  g.fillRect(0, 0, w, h);
  // weave
  g.globalAlpha = 0.045;
  g.fillStyle = '#6b4a2a';
  const step = Math.max(2, Math.round(w / 160));
  for (let x = 0; x < w; x += step * 2) g.fillRect(x, 0, 1, h);
  for (let y = 0; y < h; y += step * 2) g.fillRect(0, y, w, 1);
  g.globalAlpha = 1;
  clothCache = { w, h, c };
  return c;
};

const layer = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

const toPath = (polys: Poly[], sx: number, sy: number, h: number): Path2D => {
  const p = new Path2D();
  for (const q of polys) {
    if (q.length < 6) continue;
    p.moveTo(q[0]! * sx, h - q[1]! * sy);
    for (let k = 2; k < q.length; k += 2)
      p.lineTo(q[k]! * sx, h - q[k + 1]! * sy);
    p.closePath();
  }
  return p;
};

/** every puppet's solid minus its own holes, unioned, in one colour */
const paintShapes = (
  w: number,
  h: number,
  shapes: PlacedPolys[],
  colour: string
): HTMLCanvasElement => {
  const out = layer(w, h);
  const g = out.getContext('2d')!;
  const sx = w / GW;
  const sy = h / GH;
  const one = layer(w, h);
  const o = one.getContext('2d')!;
  for (const s of shapes) {
    o.globalCompositeOperation = 'source-over';
    o.clearRect(0, 0, w, h);
    o.fillStyle = colour;
    o.fill(toPath(s.solids, sx, sy, h), 'nonzero');
    o.globalCompositeOperation = 'destination-out';
    o.fill(toPath(s.holes, sx, sy, h), 'nonzero');
    g.drawImage(one, 0, 0);
  }
  return out;
};

/** a line hugging the outside of a painted layer */
const outline = (
  src: HTMLCanvasElement,
  colour: string,
  width: number
): HTMLCanvasElement => {
  const w = src.width;
  const h = src.height;
  const out = layer(w, h);
  const g = out.getContext('2d')!;
  const steps = 12;
  for (let k = 0; k < steps; k++) {
    const a = (k / steps) * Math.PI * 2;
    g.drawImage(src, Math.cos(a) * width, Math.sin(a) * width);
  }
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = colour;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-out';
  g.drawImage(src, 0, 0);
  return out;
};

/** keep only the part of `a` outside `b`, recoloured */
const outside = (
  a: HTMLCanvasElement,
  b: HTMLCanvasElement,
  colour: string
): HTMLCanvasElement => {
  const out = layer(a.width, a.height);
  const g = out.getContext('2d')!;
  g.drawImage(a, 0, 0);
  g.globalCompositeOperation = 'destination-out';
  g.drawImage(b, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = colour;
  g.fillRect(0, 0, a.width, a.height);
  return out;
};

export const drawKelir = (canvas: HTMLCanvasElement, layers: KelirLayers) => {
  const w = canvas.width;
  const h = canvas.height;
  if (w === 0 || h === 0) return;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(cloth(w, h), 0, 0);
  if (layers.glow) {
    ctx.globalAlpha = layers.glow * 0.45;
    const g = ctx.createRadialGradient(
      w / 2,
      h * 0.45,
      0,
      w / 2,
      h * 0.45,
      w * 0.55
    );
    g.addColorStop(0, '#ffd77a');
    g.addColorStop(1, 'rgba(255,215,122,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
  const px = w / 400; // one "pixel" at a 400 px wide kelir
  let target: HTMLCanvasElement | null = null;
  if (layers.target) {
    target = paintShapes(w, h, layers.target, '#d6963a');
    ctx.globalAlpha = 0.2;
    ctx.drawImage(target, 0, 0);
    ctx.globalAlpha = 1;
  }
  const shadow = paintShapes(w, h, layers.shadow, '#1d1411');
  // the lamp's soft penumbra, then the crisp shadow
  ctx.save();
  ctx.shadowColor = 'rgba(29, 20, 17, 0.55)';
  ctx.shadowBlur = 5 * px;
  ctx.globalAlpha = 0.94;
  ctx.drawImage(shadow, 0, 0);
  ctx.restore();
  if (target) {
    if (layers.overflow !== false)
      ctx.drawImage(outside(shadow, target, '#6b1414'), 0, 0);
    ctx.drawImage(outline(target, '#a8621c', Math.max(1, 1.3 * px)), 0, 0);
  }
  if (layers.selected) {
    const sel = paintShapes(w, h, [layers.selected], '#000');
    ctx.save();
    ctx.shadowColor = 'rgba(255, 170, 60, 0.9)';
    ctx.shadowBlur = 6 * px;
    ctx.drawImage(outline(sel, '#ffb347', Math.max(1.2, 1.6 * px)), 0, 0);
    ctx.restore();
  }
};

/** kelir cell under a pointer, or null */
export const cellAt = (
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): [number, number] | null => {
  const r = canvas.getBoundingClientRect();
  const u = (clientX - r.left) / r.width;
  const v = (clientY - r.top) / r.height;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return [Math.floor(u * GW), Math.floor((1 - v) * GH)];
};
