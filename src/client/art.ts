import { REST, figure, figureParts } from '../shared/figures.ts';
import type { Poly } from '../shared/grid.ts';
import { paintLeather } from './leather.ts';

/**
 * The painted side of a puppet, for the chest and the album: leather in the
 * figure's colours with gilt edges and the carved holes open.
 */
export type ArtStyle = 'painted' | 'locked' | 'gold';

export const drawPuppet = (
  canvas: HTMLCanvasElement,
  id: string,
  style: ArtStyle = 'painted',
  arm = 0
) => {
  const f = figure(id);
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  const fp = figureParts(f, { ...REST, arm });
  const parts = [...fp.body, ...fp.arms];
  let minX = Infinity;
  let maxX = -Infinity;
  for (const p of parts)
    for (let k = 0; k < p.length; k += 2) {
      minX = Math.min(minX, p[k]!);
      maxX = Math.max(maxX, p[k]!);
    }
  const pad = 0.06;
  // every figure is drawn at the same scale so sizes compare honestly
  const scale = Math.min(
    (h * (1 - pad * 2)) / Math.max(1.16, f.height + 0.03),
    (w * (1 - pad * 2)) / Math.max(0.5, maxX - minX)
  );
  const ox = w / 2 - ((minX + maxX) / 2) * scale;
  const oy = h * (1 - pad);
  const path = (polys: Poly[]) => {
    const p2 = new Path2D();
    for (const p of polys) {
      p2.moveTo(ox + p[0]! * scale, oy - p[1]! * scale);
      for (let k = 2; k < p.length; k += 2)
        p2.lineTo(ox + p[k]! * scale, oy - p[k + 1]! * scale);
      p2.closePath();
    }
    return p2;
  };
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const g = off.getContext('2d')!;
  const solid = path(parts);
  if (style !== 'locked') {
    // gilt rim: the silhouette in gold, nudged around, under the painted leather
    g.fillStyle = style === 'gold' ? '#ffd76a' : '#b8862f';
    const rim = Math.max(1, w / 90);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.setTransform(1, 0, 0, 1, Math.cos(a) * rim, Math.sin(a) * rim);
      g.fill(solid, 'nonzero');
    }
  }
  // figure units (y up) to pixels
  g.setTransform(scale, 0, 0, -scale, ox, oy);
  paintLeather(g, f, fp, style === 'locked');
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (style === 'gold') {
    ctx.shadowColor = 'rgba(255, 205, 90, 0.85)';
    ctx.shadowBlur = w / 10;
  }
  ctx.drawImage(off, 0, 0);
  ctx.shadowBlur = 0;
};
