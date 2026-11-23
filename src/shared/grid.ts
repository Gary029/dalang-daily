/**
 * The kelir (shadow screen) as a grid of cells. A shadow is a bit mask over
 * this grid; two shadows match only when every bit is equal.
 *
 * World space: x runs 0..GW left to right, y runs 0..GH bottom to top.
 * Cell (i, j) covers [i, i+1) x [j, j+1); it is dark when its centre is
 * inside the shadow.
 */
export const GW = 200;
export const GH = 120;
export const CELLS = GW * GH;
export const WORDS = Math.ceil(CELLS / 32);

export type Mask = Uint32Array;
/** A closed polygon as a flat list [x0, y0, x1, y1, ...]. */
export type Poly = number[];

export const emptyMask = (): Mask => new Uint32Array(WORDS);

export const getBit = (m: Mask, i: number, j: number): boolean => {
  const b = j * GW + i;
  return ((m[b >>> 5]! >>> (b & 31)) & 1) === 1;
};

const setSpan = (m: Mask, j: number, i0: number, i1: number) => {
  // set cells i0..i1-1 on row j
  for (let i = i0; i < i1; i++) {
    const b = j * GW + i;
    m[b >>> 5] = m[b >>> 5]! | (1 << (b & 31));
  }
};

/** Rasterises the union of polygons into `out` (scanline, cell centres). */
export const fillPolys = (out: Mask, polys: readonly Poly[]): Mask => {
  const xs: number[] = [];
  for (const p of polys) {
    const n = p.length / 2;
    if (n < 3) continue;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let k = 1; k < p.length; k += 2) {
      const y = p[k]!;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const j0 = Math.max(0, Math.ceil(minY - 0.5));
    const j1 = Math.min(GH - 1, Math.floor(maxY - 0.5));
    for (let j = j0; j <= j1; j++) {
      const cy = j + 0.5;
      xs.length = 0;
      for (let a = 0, b = n - 1; a < n; b = a++) {
        const ay = p[a * 2 + 1]!;
        const by = p[b * 2 + 1]!;
        if (ay > cy !== by > cy) {
          const ax = p[a * 2]!;
          const bx = p[b * 2]!;
          xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
        }
      }
      xs.sort((u, v) => u - v);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil(xs[k]! - 0.5));
        const i1 = Math.min(GW, Math.floor(xs[k + 1]! - 0.5) + 1);
        if (i1 > i0) setSpan(out, j, i0, i1);
      }
    }
  }
  return out;
};

export const orInto = (a: Mask, b: Mask): Mask => {
  for (let k = 0; k < WORDS; k++) a[k] = a[k]! | b[k]!;
  return a;
};

export const andNotInto = (a: Mask, b: Mask): Mask => {
  for (let k = 0; k < WORDS; k++) a[k] = a[k]! & ~b[k]!;
  return a;
};

export const equal = (a: Mask, b: Mask): boolean => {
  for (let k = 0; k < WORDS; k++) if (a[k] !== b[k]) return false;
  return true;
};

/** true when every dark cell of `a` is dark in `b` */
export const subsetOf = (a: Mask, b: Mask): boolean => {
  for (let k = 0; k < WORDS; k++) if ((a[k]! & ~b[k]!) !== 0) return false;
  return true;
};

const popcount32 = (x: number): number => {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};

export const count = (a: Mask): number => {
  let c = 0;
  for (let k = 0; k < WORDS; k++) c += popcount32(a[k]!);
  return c;
};

/** Intersection over union, 1 when equal (and both empty). */
export const matchRatio = (a: Mask, b: Mask): number => {
  let inter = 0;
  let uni = 0;
  for (let k = 0; k < WORDS; k++) {
    inter += popcount32(a[k]! & b[k]!);
    uni += popcount32(a[k]! | b[k]!);
  }
  return uni === 0 ? 1 : inter / uni;
};

// --- compact text form, used to ship a target mask in JSON -----------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Run-length encoding of the cell sequence, alternating light/dark runs. */
export const encodeMask = (m: Mask): string => {
  const runs: number[] = [];
  let cur = false;
  let len = 0;
  for (let b = 0; b < CELLS; b++) {
    const v = ((m[b >>> 5]! >>> (b & 31)) & 1) === 1;
    if (v === cur) len++;
    else {
      runs.push(len);
      cur = v;
      len = 1;
    }
  }
  runs.push(len);
  // each run as base64 varint (5 bits per char, high bit = continue)
  let s = '';
  for (let r of runs) {
    do {
      let c = r & 31;
      r >>>= 5;
      if (r > 0) c |= 32;
      s += B64[c];
    } while (r > 0);
  }
  return s;
};

export const decodeMask = (s: string): Mask => {
  const m = emptyMask();
  let b = 0;
  let dark = false;
  let k = 0;
  while (k < s.length) {
    let r = 0;
    let shift = 0;
    for (;;) {
      const c = B64.indexOf(s[k++]!);
      if (c < 0) throw new Error('bad mask');
      r |= (c & 31) << shift;
      shift += 5;
      if ((c & 32) === 0) break;
    }
    if (dark)
      for (let t = 0; t < r; t++, b++)
        m[b >>> 5] = m[b >>> 5]! | (1 << (b & 31));
    else b += r;
    dark = !dark;
  }
  if (b !== CELLS) throw new Error('bad mask length');
  return m;
};
