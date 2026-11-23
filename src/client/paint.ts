import { armPolys, figure } from '../shared/figures.ts';
import type { Poly } from '../shared/grid.ts';
import { placedPolys, poseAffine, type Pose } from '../shared/shadow.ts';

/**
 * A puppet painted in exactly the pose it was cast in, for the reveal.
 * `box` is in kelir units (y up). `color` is the painted leather with its
 * gilt rim; `mask` is the exact silhouette that casts the scored shadow.
 */
export type Box = { x0: number; y0: number; x1: number; y1: number };
export type PaintedPuppet = {
  id: string;
  pose: Pose;
  box: Box;
  color: HTMLCanvasElement;
  mask: HTMLCanvasElement;
};

/** canvas pixels per kelir cell */
const PX = 8;

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
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

export const paintPuppet = (id: string, pose: Pose): PaintedPuppet => {
  const f = figure(id);
  const placed = placedPolys(f, pose);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of placed.solids)
    for (let k = 0; k < q.length; k += 2) {
      x0 = Math.min(x0, q[k]!);
      x1 = Math.max(x1, q[k]!);
      y0 = Math.min(y0, q[k + 1]!);
      y1 = Math.max(y1, q[k + 1]!);
    }
  const margin = 1.5;
  x0 -= margin;
  y0 -= margin;
  x1 += margin;
  y1 += margin;
  const w = Math.ceil((x1 - x0) * PX);
  const h = Math.ceil((y1 - y0) * PX);
  x1 = x0 + w / PX;
  y1 = y0 + h / PX;

  // figure space -> canvas pixels (kelir y is up, canvas y is down)
  const m = poseAffine(f, pose);
  const setPose = (g: CanvasRenderingContext2D) =>
    g.setTransform(
      PX * m.a,
      -PX * m.b,
      PX * m.c,
      -PX * m.d,
      PX * (m.e - x0),
      PX * (y1 - m.f)
    );
  const solid = pathOf([...f.body, ...armPolys(f, pose.arm)]);
  const holes = pathOf(f.holes);

  const mask = canvas(w, h);
  const mg = mask.getContext('2d')!;
  setPose(mg);
  mg.fillStyle = '#000';
  mg.fill(solid, 'nonzero');
  mg.globalCompositeOperation = 'destination-out';
  mg.fill(holes, 'nonzero');

  // gilt rim: the silhouette in gold, stamped around, under the leather
  const sil = canvas(w, h);
  const sg = sil.getContext('2d')!;
  setPose(sg);
  sg.fillStyle = '#c8973a';
  sg.fill(solid, 'nonzero');
  const color = canvas(w, h);
  const g = color.getContext('2d')!;
  const rim = 0.55 * PX;
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    g.drawImage(sil, Math.cos(a) * rim, Math.sin(a) * rim);
  }
  setPose(g);
  const grad = g.createLinearGradient(0, f.height, 0, 0);
  grad.addColorStop(0, f.skin);
  grad.addColorStop(0.4, f.skin);
  grad.addColorStop(0.52, f.cloth);
  grad.addColorStop(1, f.cloth);
  g.fillStyle = grad;
  g.fill(solid, 'nonzero');
  // a fine gold line inside the edge, like tooled leather
  g.lineWidth = 0.006;
  g.strokeStyle = 'rgba(240, 200, 110, 0.55)';
  g.stroke(solid);
  g.globalCompositeOperation = 'destination-out';
  g.fill(holes, 'nonzero');
  // gold around each carved hole
  g.globalCompositeOperation = 'source-atop';
  g.lineWidth = 0.012;
  g.strokeStyle = '#e0b35a';
  g.stroke(holes);
  g.globalCompositeOperation = 'source-over';

  return { id, pose, box: { x0, y0, x1, y1 }, color, mask };
};

export const paintScene = (
  offered: readonly string[],
  slots: readonly (Pose | null)[]
): PaintedPuppet[] =>
  offered.flatMap((id, k) => {
    const p = slots[k];
    return p ? [paintPuppet(id, p)] : [];
  });
