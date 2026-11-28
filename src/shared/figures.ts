import type { Poly } from './grid.ts';

/**
 * Wayang figures as flat silhouettes. Frame: y up, feet on y = 0, the figure
 * faces +x, 1 unit = a standard satria's height. Every figure has carved
 * holes (light shines through them), two arms on rods that bend at the
 * shoulder and the elbow, and a head that can bow or rise.
 */

export type SetId =
  'punakawan' | 'pandawa' | 'kurawa' | 'dewa' | 'raksasa' | 'ramayana';

export type Hand = 'open' | 'claw' | 'fist';

export type Figure = {
  id: string;
  name: string;
  set: SetId;
  role: string;
  story: string;
  /** top of the figure in frame units */
  height: number;
  body: Poly[];
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

/** a foot in profile pointing +x */
const foot = (ax: number, len = 0.09, h = 0.045): Poly =>
  P(ax - 0.035, 0, ax + len, 0, ax + len * 0.55, h * 0.6, ax + 0.01, h);

// --- body kits ---------------------------------------------------------------

type AlusOpts = {
  s?: number; // overall scale
  crown?: 'gelung' | 'makuta' | 'topong' | 'jamang';
  bow?: number; // how far the head bows forward
  hemFront?: number; // how low the front flap falls
};

/** a refined (alus) knight: narrow stance, long dodot, bowed head */
const alus = (o: AlusOpts = {}) => {
  const s = o.s ?? 1;
  const bow = o.bow ?? 0.01;
  const S = (p: Poly) => p.map((v) => v * s);
  const body: Poly[] = [
    foot(-0.07),
    foot(0.06),
    cap(-0.02, 0.36, -0.07, 0.04, 0.03, 0.022),
    cap(0.01, 0.36, 0.06, 0.04, 0.03, 0.022),
    // dodot with the pointed front flap
    P(
      -0.085,
      0.48,
      0.07,
      0.48,
      0.085,
      0.34,
      0.11,
      0.1 + (o.hemFront ?? 0),
      0.06,
      0.2,
      -0.05,
      0.22,
      -0.12,
      0.26,
      -0.115,
      0.36
    ),
    // torso
    P(
      -0.06,
      0.47,
      0.055,
      0.47,
      0.075,
      0.57,
      0.07,
      0.655,
      -0.07,
      0.66,
      -0.065,
      0.56
    ),
    cap(0.0, 0.64, 0.03 + bow, 0.72, 0.026, 0.022),
    // head and pointed nose
    ell(0.04 + bow, 0.765, 0.048, 0.056),
    P(0.075 + bow, 0.79, 0.13 + bow, 0.748, 0.08 + bow, 0.742),
    P(0.06 + bow, 0.725, 0.09 + bow, 0.718, 0.07 + bow, 0.71),
  ];
  const c = o.crown ?? 'gelung';
  if (c === 'gelung') {
    body.push(
      ell(0.0 + bow, 0.83, 0.05, 0.035),
      ell(-0.055 + bow, 0.85, 0.032, 0.03),
      ell(-0.085 + bow, 0.83, 0.02, 0.022)
    );
  } else if (c === 'makuta') {
    body.push(
      P(
        -0.03 + bow,
        0.8,
        0.08 + bow,
        0.8,
        0.06 + bow,
        0.92,
        0.02 + bow,
        0.97,
        -0.02 + bow,
        0.92
      ),
      ell(-0.06 + bow, 0.82, 0.04, 0.03)
    );
  } else if (c === 'topong') {
    body.push(
      P(-0.03 + bow, 0.8, 0.075 + bow, 0.8, 0.05 + bow, 0.88, 0.0 + bow, 0.9),
      ell(-0.06 + bow, 0.8, 0.035, 0.045)
    );
  } else {
    body.push(
      ell(0.02 + bow, 0.82, 0.05, 0.03),
      P(-0.03 + bow, 0.83, -0.12 + bow, 0.86, -0.04 + bow, 0.8)
    );
  }
  return { body: body.map(S), scale: s };
};

const scaled = (polys: Poly[], s: number, dx = 0, dy = 0): Poly[] =>
  polys.map((p) => p.map((v, k) => v * s + (k % 2 === 0 ? dx : dy)));

// --- the cast -----------------------------------------------------------------

const arjuna = alus({ crown: 'gelung', bow: 0.015 });
const yudhis = alus({ s: 0.97, crown: 'jamang', bow: 0.03, hemFront: 0.04 });
const nakula = alus({ s: 0.93, crown: 'topong', bow: 0.0 });
const sadewa = alus({ s: 0.93, crown: 'topong', bow: 0.0 });
const duryu = alus({ s: 1.06, crown: 'makuta', bow: -0.015, hemFront: -0.02 });

const bimaBody = (): Poly[] => [
  foot(-0.14, 0.1, 0.05),
  foot(0.12, 0.1, 0.05),
  cap(-0.05, 0.42, -0.14, 0.05, 0.05, 0.034),
  cap(0.04, 0.42, 0.12, 0.05, 0.05, 0.034),
  // poleng kain, short and wide
  P(-0.12, 0.52, 0.11, 0.52, 0.16, 0.33, 0.04, 0.37, -0.03, 0.3, -0.17, 0.34),
  // broad torso
  P(-0.1, 0.51, 0.1, 0.51, 0.13, 0.62, 0.11, 0.73, -0.12, 0.74, -0.13, 0.62),
  cap(0.0, 0.72, 0.03, 0.79, 0.04, 0.034),
  ell(0.05, 0.835, 0.066, 0.07),
  P(0.1, 0.85, 0.16, 0.82, 0.1, 0.8),
  // gelung supit urang: a crab-claw knot
  ell(-0.01, 0.92, 0.07, 0.045),
  P(-0.07, 0.94, -0.15, 1.0, -0.12, 0.92, -0.06, 0.9),
  P(0.04, 0.95, 0.1, 1.02, 0.02, 0.99),
];

const semarBody = (): Poly[] => [
  foot(-0.08, 0.08, 0.04),
  foot(0.07, 0.08, 0.04),
  cap(-0.04, 0.2, -0.08, 0.04, 0.04, 0.028),
  cap(0.03, 0.2, 0.07, 0.04, 0.04, 0.028),
  // the great round belly and behind
  ell(0.03, 0.36, 0.13, 0.15, 22),
  ell(-0.1, 0.3, 0.09, 0.1, 16),
  // check-cloth kain
  P(-0.18, 0.3, 0.12, 0.28, 0.1, 0.16, -0.16, 0.18),
  // upturned head with a crown tuft (kuncung)
  ell(0.04, 0.55, 0.075, 0.07, 18),
  P(0.09, 0.58, 0.14, 0.62, 0.11, 0.55),
  ell(0.05, 0.495, 0.04, 0.025),
  cap(-0.0, 0.62, -0.03, 0.7, 0.025, 0.012),
  ell(-0.04, 0.705, 0.02, 0.016),
];

const garengBody = (): Poly[] => [
  foot(-0.07, 0.07, 0.035),
  foot(0.06, 0.07, 0.035),
  cap(-0.02, 0.24, -0.07, 0.04, 0.03, 0.022),
  cap(0.02, 0.24, 0.06, 0.04, 0.03, 0.022),
  P(-0.1, 0.34, 0.08, 0.34, 0.1, 0.22, -0.11, 0.2),
  ell(-0.01, 0.4, 0.085, 0.085, 16),
  // round head, small nose, a sideways tuft
  ell(0.03, 0.55, 0.06, 0.065, 16),
  ell(0.09, 0.54, 0.025, 0.02, 8),
  P(-0.01, 0.6, -0.09, 0.66, -0.05, 0.58),
];

const petrukBody = (): Poly[] => [
  foot(-0.07, 0.09, 0.04),
  foot(0.07, 0.09, 0.04),
  cap(-0.02, 0.4, -0.07, 0.04, 0.026, 0.02),
  cap(0.02, 0.4, 0.07, 0.04, 0.026, 0.02),
  P(-0.09, 0.52, 0.08, 0.52, 0.11, 0.36, -0.1, 0.34),
  P(-0.05, 0.51, 0.06, 0.51, 0.06, 0.74, -0.05, 0.74),
  cap(0.0, 0.73, 0.02, 0.85, 0.022, 0.018),
  ell(0.03, 0.89, 0.045, 0.05, 14),
  // the very long nose
  P(0.06, 0.91, 0.2, 0.92, 0.07, 0.875),
  P(0.0, 0.93, -0.08, 0.99, -0.03, 0.91),
];

const bagongBody = (): Poly[] => [
  foot(-0.08, 0.08, 0.04),
  foot(0.08, 0.08, 0.04),
  cap(-0.03, 0.22, -0.08, 0.04, 0.04, 0.028),
  cap(0.03, 0.22, 0.08, 0.04, 0.04, 0.028),
  ell(0.0, 0.36, 0.12, 0.14, 20),
  P(-0.13, 0.3, 0.13, 0.3, 0.12, 0.18, -0.13, 0.17),
  // big bald head, thick lips
  ell(0.02, 0.56, 0.08, 0.075, 18),
  ell(0.1, 0.52, 0.035, 0.025, 10),
  ell(0.095, 0.575, 0.025, 0.018, 8),
];

const sengkuniBody = (): Poly[] => {
  const b = alus({ s: 0.9, crown: 'jamang', bow: 0.04 }).body;
  // hunched back, a pointed cap, a long thin nose
  b.push(
    ell(-0.05, 0.57, 0.05, 0.05),
    P(0.0, 0.76, 0.06, 0.86, -0.03, 0.8),
    P(0.1, 0.71, 0.17, 0.665, 0.1, 0.66)
  );
  return b;
};

const guruBody = (): Poly[] => {
  const b = alus({ s: 1.0, crown: 'makuta', bow: 0.0 }).body;
  // extra pair of arms raised behind, a tall crown and a halo
  b.push(
    cap(-0.05, 0.63, -0.15, 0.72, 0.018, 0.015),
    cap(-0.15, 0.72, -0.17, 0.85, 0.015, 0.012),
    ell(-0.17, 0.87, 0.02, 0.02, 8),
    P(0.0, 0.92, 0.05, 0.92, 0.03, 1.04),
    ell(-0.02, 0.8, 0.12, 0.025, 18, 0.5)
  );
  return b;
};

const dewaruciBody = (): Poly[] => scaled(bimaBody(), 0.5, 0, 0);

const rama = alus({ s: 1.0, crown: 'makuta', bow: 0.02 });

/** a refined lady (putri): a long kain to the ground, a sanggul bun */
const sintaBody = (): Poly[] => [
  foot(0.02, 0.07, 0.03),
  // the long wrapped kain, a little flared at the hem
  P(-0.08, 0.42, 0.06, 0.42, 0.1, 0.03, 0.06, 0.0, -0.09, 0.0, -0.11, 0.03),
  // the waist sash falling behind
  cap(-0.06, 0.4, -0.13, 0.12, 0.014, 0.009),
  // torso
  P(
    -0.05,
    0.42,
    0.05,
    0.42,
    0.06,
    0.52,
    0.05,
    0.585,
    -0.055,
    0.585,
    -0.06,
    0.5
  ),
  cap(0.0, 0.575, 0.025, 0.64, 0.02, 0.017),
  // head, bowed a little, with a fine nose
  ell(0.035, 0.68, 0.042, 0.05),
  P(0.068, 0.705, 0.115, 0.668, 0.072, 0.662),
  // the sanggul and a flower in it
  ell(-0.035, 0.705, 0.042, 0.036),
  ell(-0.08, 0.69, 0.03, 0.03),
  ell(-0.025, 0.75, 0.016, 0.016),
];

/** the white monkey: a wide stance, a poleng kain and a curling tail */
const hanomanBody = (): Poly[] => [
  foot(-0.12, 0.1, 0.05),
  foot(0.1, 0.1, 0.05),
  cap(-0.04, 0.42, -0.12, 0.05, 0.045, 0.03),
  cap(0.04, 0.42, 0.1, 0.05, 0.045, 0.03),
  P(-0.11, 0.5, 0.1, 0.5, 0.14, 0.33, 0.02, 0.36, -0.15, 0.33),
  P(-0.09, 0.5, 0.09, 0.5, 0.11, 0.62, 0.09, 0.71, -0.1, 0.72, -0.11, 0.6),
  // the tail curling up behind
  cap(-0.12, 0.36, -0.23, 0.5, 0.026, 0.02),
  cap(-0.23, 0.5, -0.21, 0.66, 0.02, 0.016),
  ell(-0.175, 0.69, 0.032, 0.03),
  cap(0.0, 0.7, 0.03, 0.775, 0.035, 0.03),
  // head and muzzle, a gelung knot
  ell(0.05, 0.815, 0.06, 0.062),
  ell(0.115, 0.79, 0.042, 0.03),
  ell(-0.01, 0.885, 0.058, 0.038),
  P(-0.06, 0.9, -0.13, 0.95, -0.1, 0.88),
];

/** the ten-headed giant king: a giant's body under a towering crown */
const rahwanaBody = (): Poly[] => [
  ...scaled(butaBody(), 1.04),
  P(-0.07, 1.16, -0.02, 1.33, 0.03, 1.18),
  P(0.03, 1.19, 0.1, 1.32, 0.12, 1.16),
  P(-0.12, 1.1, -0.16, 1.22, -0.06, 1.14),
];

const cakilBody = (): Poly[] => [
  // wide dancing stance, back leg far out
  foot(-0.2, 0.09, 0.04),
  foot(0.14, 0.09, 0.04),
  cap(-0.03, 0.38, -0.2, 0.04, 0.034, 0.022),
  cap(0.03, 0.38, 0.14, 0.04, 0.034, 0.022),
  P(-0.11, 0.48, 0.08, 0.48, 0.12, 0.32, 0.0, 0.36, -0.14, 0.3),
  P(-0.07, 0.47, 0.07, 0.47, 0.09, 0.6, 0.06, 0.68, -0.08, 0.68, -0.09, 0.58),
  cap(0.0, 0.66, 0.04, 0.73, 0.026, 0.022),
  ell(0.05, 0.775, 0.055, 0.055),
  // the jutting lower jaw and a fang
  P(0.06, 0.74, 0.18, 0.72, 0.17, 0.75, 0.08, 0.77),
  P(0.15, 0.75, 0.16, 0.79, 0.14, 0.76),
  P(0.09, 0.8, 0.14, 0.79, 0.09, 0.78),
  // a bun at the back of the head
  ell(-0.02, 0.83, 0.045, 0.04),
  ell(-0.07, 0.82, 0.03, 0.03),
];

const butaBody = (): Poly[] => [
  foot(-0.15, 0.12, 0.06),
  foot(0.12, 0.12, 0.06),
  cap(-0.06, 0.4, -0.15, 0.05, 0.06, 0.045),
  cap(0.05, 0.4, 0.12, 0.05, 0.06, 0.045),
  ell(0.03, 0.55, 0.17, 0.17, 22),
  P(-0.17, 0.48, 0.17, 0.46, 0.2, 0.3, -0.2, 0.32),
  P(-0.14, 0.62, 0.13, 0.62, 0.12, 0.84, -0.15, 0.84),
  cap(0.0, 0.83, 0.03, 0.9, 0.05, 0.045),
  ell(0.06, 0.95, 0.09, 0.09, 18),
  // eggplant nose, tusks, a tall crown
  ell(0.16, 0.95, 0.05, 0.035, 12),
  P(0.1, 0.89, 0.15, 0.84, 0.13, 0.9),
  P(-0.04, 1.0, 0.12, 1.0, 0.09, 1.1, 0.03, 1.14, -0.02, 1.08),
  ell(-0.08, 1.0, 0.05, 0.04),
];

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

const fig = (f: Omit<Figure, 'height'>): Figure => {
  const height = Math.max(top(f.body), 0.2);
  return {
    ...f,
    height,
    // the gapit runs from the crown down past the feet
    body: [...f.body, rod(0.005, height * 0.9, -0.01, ROD_END)],
  };
};

export const FIGURES: Figure[] = [
  fig({
    id: 'semar',
    name: 'Semar',
    set: 'punakawan',
    role: 'Clown-servant and hidden god',
    story:
      'The round old servant of the Pandawa, who in Javanese tradition is really the god Batara Ismaya, brother of Batara Guru, living as a commoner. He guides his masters with jokes and plain truth, and even the gods listen to him.',
    body: semarBody(),
    holes: [
      hole(0.03, 0.38, 0.035),
      hole(-0.06, 0.24, 0.03),
      diamond(0.06, 0.55, 0.022),
    ],
    back: [-0.06, 0.48],
    neck: [0.03, 0.46],
    arm: {
      shoulder: [0.06, 0.47],
      upper: 0.15,
      fore: 0.14,
      width: 0.03,
      hand: 'open',
    },
    skin: '#2b2522',
    cloth: '#c9b37a',
  }),
  fig({
    id: 'gareng',
    name: 'Gareng',
    set: 'punakawan',
    role: "Semar's eldest son",
    story:
      "Once the proud knight Bambang Sukodadi, he became Semar's adopted eldest son. His crossed eyes, crooked arm and limp are read as lessons: look carefully, act carefully, and never take what is not yours.",
    body: garengBody(),
    holes: [diamond(-0.01, 0.4, 0.03), hole(-0.04, 0.27, 0.025)],
    back: [-0.06, 0.45],
    neck: [0.02, 0.48],
    arm: {
      shoulder: [0.04, 0.45],
      upper: 0.13,
      fore: 0.12,
      width: 0.022,
      hand: 'fist',
    },
    skin: '#1f1b1a',
    cloth: '#8c2d2d',
  }),
  fig({
    id: 'petruk',
    name: 'Petruk',
    set: 'punakawan',
    role: "Semar's tall son",
    story:
      'Tall, long-nosed and long-armed, Petruk is the quick-tongued joker of the punakawan. In the lakon Petruk Dadi Ratu he hides the sacred Kalimasada and crowns himself king, until Bagong unmasks him.',
    body: petrukBody(),
    holes: [
      hole(0.0, 0.62, 0.03),
      hole(0.0, 0.45, 0.028),
      diamond(-0.03, 0.39, 0.02),
    ],
    back: [-0.04, 0.72],
    neck: [0.02, 0.83],
    arm: {
      shoulder: [0.04, 0.72],
      upper: 0.21,
      fore: 0.22,
      width: 0.018,
      hand: 'open',
    },
    skin: '#d6a648',
    cloth: '#9b2a24',
  }),
  fig({
    id: 'bagong',
    name: 'Bagong',
    set: 'punakawan',
    role: "Made from Semar's shadow",
    story:
      'Semar asked for a companion and was told his truest friend was his own shadow; the shadow became Bagong. The youngest and least polite punakawan, he says out loud what everyone else only thinks.',
    body: bagongBody(),
    holes: [hole(0.0, 0.36, 0.04), diamond(0.0, 0.56, 0.025)],
    back: [-0.07, 0.46],
    neck: [0.01, 0.48],
    arm: {
      shoulder: [0.06, 0.46],
      upper: 0.14,
      fore: 0.13,
      width: 0.03,
      hand: 'open',
    },
    skin: '#2a2421',
    cloth: '#5b7b3a',
  }),
  fig({
    id: 'yudhistira',
    name: 'Yudhistira',
    set: 'pandawa',
    role: 'Eldest of the Pandawa',
    story:
      'Also called Puntadewa, the patient, honest king of Amarta and eldest of the five brothers. His only weapon is the sacred book Jamus Kalimasada.',
    body: yudhis.body,
    holes: [
      diamond(0.0, 0.4, 0.025),
      diamond(-0.02, 0.32, 0.022),
      hole(0.0, 0.56, 0.024),
    ].map((p) => p.map((v) => v * 0.97)),
    back: [-0.039, 0.611],
    neck: [0.039, 0.679],
    arm: {
      shoulder: [0.034, 0.61],
      upper: 0.2,
      fore: 0.21,
      width: 0.02,
      hand: 'open',
    },
    skin: '#1d1a19',
    cloth: '#e6d6a8',
  }),
  fig({
    id: 'bima',
    name: 'Bima',
    set: 'pandawa',
    role: 'The strongest Pandawa',
    story:
      'The second Pandawa, also called Werkudara, son of the wind god Bayu. He speaks plainly to everyone, even the gods, and fights with his club Rujakpolo and the thumbnail Pancanaka.',
    body: bimaBody(),
    holes: [
      P(-0.06, 0.48, -0.02, 0.48, -0.02, 0.44, -0.06, 0.44),
      P(0.02, 0.44, 0.06, 0.44, 0.06, 0.4, 0.02, 0.4),
      hole(0.0, 0.62, 0.035),
    ],
    back: [-0.08, 0.7],
    neck: [0.03, 0.75],
    arm: {
      shoulder: [0.08, 0.7],
      upper: 0.21,
      fore: 0.21,
      width: 0.035,
      hand: 'claw',
    },
    skin: '#1c1918',
    cloth: '#d9b84e',
  }),
  fig({
    id: 'arjuna',
    name: 'Arjuna',
    set: 'pandawa',
    role: 'The archer knight',
    story:
      'The third Pandawa, the finest archer and the most refined of the brothers: calm outside, fierce in battle. As the hermit Begawan Ciptoning on Mount Indrakila he won the arrow Pasopati from the gods.',
    body: arjuna.body,
    holes: [
      hole(0.0, 0.4, 0.028),
      hole(-0.03, 0.31, 0.024),
      diamond(0.0, 0.56, 0.02),
    ],
    back: [-0.04, 0.63],
    neck: [0.04, 0.7],
    arm: {
      shoulder: [0.035, 0.63],
      upper: 0.21,
      fore: 0.22,
      width: 0.02,
      hand: 'open',
    },
    skin: '#1d1a19',
    cloth: '#c79a3e',
  }),
  fig({
    id: 'nakula',
    name: 'Nakula',
    set: 'pandawa',
    role: 'Twin son of Madrim',
    story:
      'One of the twin sons of Pandu and Madrim. In the Mahabharata he is the handsomest of the brothers and a master of horses.',
    body: nakula.body,
    holes: [hole(0.0, 0.38, 0.03), hole(0.0, 0.53, 0.026)].map((p) =>
      p.map((v) => v * 0.93)
    ),
    back: [-0.037, 0.586],
    neck: [0.037, 0.651],
    arm: {
      shoulder: [0.033, 0.59],
      upper: 0.2,
      fore: 0.2,
      width: 0.02,
      hand: 'open',
    },
    skin: '#1d1a19',
    cloth: '#3f6b74',
  }),
  fig({
    id: 'sadewa',
    name: 'Sadewa',
    set: 'pandawa',
    role: 'The youngest Pandawa',
    story:
      "Nakula's twin and the youngest brother, wise in the reading of stars and fate. In the old Javanese tale Sudamala, with Semar beside him, he frees the goddess Durga from a curse.",
    body: sadewa.body,
    holes: [
      diamond(-0.02, 0.33, 0.026),
      diamond(0.02, 0.4, 0.026),
      diamond(0.0, 0.53, 0.02),
    ].map((p) => p.map((v) => v * 0.93)),
    back: [-0.037, 0.586],
    neck: [0.037, 0.651],
    arm: {
      shoulder: [0.033, 0.59],
      upper: 0.2,
      fore: 0.2,
      width: 0.02,
      hand: 'open',
    },
    skin: '#1d1a19',
    cloth: '#6a4a86',
  }),
  fig({
    id: 'duryudana',
    name: 'Duryudana',
    set: 'kurawa',
    role: 'King of Astina',
    story:
      "Eldest of the hundred Kurawa and king of Astina, who would rather go to war than share the kingdom with his Pandawa cousins. He falls to Bima's club at the end of the Baratayuda.",
    body: duryu.body,
    holes: [hole(0.0, 0.42, 0.03), P(-0.04, 0.32, 0.03, 0.32, 0.0, 0.27)].map(
      (p) => p.map((v) => v * 1.06)
    ),
    back: [-0.042, 0.668],
    neck: [0.042, 0.742],
    arm: {
      shoulder: [0.04, 0.67],
      upper: 0.21,
      fore: 0.21,
      width: 0.024,
      hand: 'fist',
    },
    skin: '#7a2420',
    cloth: '#d4a23a',
  }),
  fig({
    id: 'sengkuni',
    name: 'Sengkuni',
    set: 'kurawa',
    role: "Patih of Astina, the Kurawa's uncle",
    story:
      'Patih of Astina and uncle of the Kurawa, also called Harya Suman. Behind nearly every trap for the Pandawa, from the dice game onward, stands Sengkuni.',
    body: sengkuniBody(),
    holes: [hole(-0.05, 0.57, 0.025), diamond(0.0, 0.36, 0.022)],
    back: [-0.036, 0.567],
    neck: [0.036, 0.63],
    arm: {
      shoulder: [0.03, 0.57],
      upper: 0.19,
      fore: 0.19,
      width: 0.017,
      hand: 'open',
    },
    skin: '#c9b08a',
    cloth: '#4f5a2e',
  }),
  fig({
    id: 'guru',
    name: 'Batara Guru',
    set: 'dewa',
    role: 'King of the gods',
    story:
      'Batara Guru, also called Manikmaya, rules the gods from his heaven. The Javanese wayang shows him with four arms, riding the bull Nandini. Disguised as a hunter, he tests Arjuna on Mount Indrakila.',
    body: guruBody(),
    holes: [
      hole(0.0, 0.4, 0.026),
      diamond(0.02, 0.88, 0.02),
      hole(-0.12, 0.76, 0.015),
    ],
    back: [-0.04, 0.63],
    neck: [0.04, 0.7],
    arm: {
      shoulder: [0.035, 0.63],
      upper: 0.21,
      fore: 0.21,
      width: 0.02,
      hand: 'open',
    },
    skin: '#d9b452',
    cloth: '#7d2a3a',
  }),
  fig({
    id: 'dewaruci',
    name: 'Dewaruci',
    set: 'dewa',
    role: 'The tiny god in the sea',
    story:
      "A god small enough to stand on Bima's palm, but with Bima's own face, waiting at the bottom of the sea. Bima enters his left ear, finds a whole world inside, and learns that the water of life was within him.",
    body: dewaruciBody(),
    holes: [hole(0.0, 0.31, 0.022)],
    back: [-0.04, 0.35],
    neck: [0.015, 0.375],
    arm: {
      shoulder: [0.04, 0.35],
      upper: 0.105,
      fore: 0.105,
      width: 0.018,
      hand: 'open',
    },
    skin: '#d9b452',
    cloth: '#2f4f6f',
  }),
  fig({
    id: 'cakil',
    name: 'Cakil',
    set: 'raksasa',
    role: 'The jutting-jawed giant',
    story:
      'A giant with a jutting lower jaw, a Javanese invention not found in the Indian epics. Restless and loyal, he challenges the knight in the perang kembang (flower battle), and always loses, often to his own keris.',
    body: cakilBody(),
    holes: [
      hole(0.0, 0.57, 0.026),
      diamond(-0.02, 0.41, 0.024),
      hole(-0.06, 0.35, 0.02),
    ],
    back: [-0.05, 0.65],
    neck: [0.04, 0.715],
    arm: {
      shoulder: [0.05, 0.66],
      upper: 0.2,
      fore: 0.2,
      width: 0.02,
      hand: 'claw',
    },
    skin: '#c8706a',
    cloth: '#efe3c4',
  }),
  fig({
    id: 'buta',
    name: 'Buta Terong',
    set: 'raksasa',
    role: 'The eggplant-nosed giant',
    story:
      'A stock giant named for his nose, shaped like a terong (eggplant). Giants like him storm in as soldiers and guards whenever a lakon needs a fight.',
    body: butaBody(),
    holes: [
      hole(0.03, 0.55, 0.045),
      diamond(-0.06, 0.72, 0.03),
      hole(0.0, 0.38, 0.03),
    ],
    back: [-0.13, 0.8],
    neck: [0.03, 0.835],
    arm: {
      shoulder: [0.1, 0.8],
      upper: 0.22,
      fore: 0.22,
      width: 0.042,
      hand: 'claw',
    },
    skin: '#9c2a22',
    cloth: '#2d2a4a',
  }),
  fig({
    id: 'rama',
    name: 'Rama',
    set: 'ramayana',
    role: 'The exiled prince of Ayodya',
    story:
      'Prince of Ayodya, also called Ramawijaya or Regawa. Exiled to the forest, he loses his wife Sinta to Rahwana and wins her back with the monkey army of Sugriwa and Hanoman.',
    body: rama.body,
    holes: [
      diamond(0.0, 0.53, 0.024),
      hole(-0.02, 0.36, 0.02),
      hole(0.02, 0.22, 0.018),
    ],
    back: [-0.04, 0.63],
    neck: [0.04, 0.7],
    arm: {
      shoulder: [0.035, 0.63],
      upper: 0.21,
      fore: 0.21,
      width: 0.02,
      hand: 'open',
    },
    skin: '#1d1a19',
    cloth: '#2f6b4f',
  }),
  fig({
    id: 'sinta',
    name: 'Sinta',
    set: 'ramayana',
    role: "Rama's wife",
    story:
      "Held in the Argasoka garden of Alengka, she will not bow to Rahwana. When a white monkey shows her Rama's ring, she sends back a jewel from her hair.",
    body: sintaBody(),
    holes: [
      diamond(0.0, 0.5, 0.02),
      hole(-0.02, 0.3, 0.02),
      hole(-0.01, 0.16, 0.018),
    ],
    back: [-0.035, 0.555],
    neck: [0.035, 0.625],
    arm: {
      shoulder: [0.03, 0.555],
      upper: 0.17,
      fore: 0.17,
      width: 0.016,
      hand: 'open',
    },
    skin: '#d9b452',
    cloth: '#6a2a5a',
  }),
  fig({
    id: 'hanoman',
    name: 'Hanoman',
    set: 'ramayana',
    role: 'The white monkey',
    story:
      "Son of the wind god Bayu and Anjani, white as cotton, with the same Pancanaka thumbnail as Bima. As Rama's envoy he leaps the sea, finds Sinta and sets Alengka on fire.",
    body: hanomanBody(),
    holes: [
      hole(0.0, 0.6, 0.03),
      diamond(-0.03, 0.42, 0.025),
      hole(-0.175, 0.69, 0.012),
    ],
    back: [-0.07, 0.68],
    neck: [0.03, 0.755],
    arm: {
      shoulder: [0.07, 0.68],
      upper: 0.2,
      fore: 0.2,
      width: 0.032,
      hand: 'claw',
    },
    skin: '#efe9dc',
    cloth: '#2a2a2a',
  }),
  fig({
    id: 'rahwana',
    name: 'Rahwana',
    set: 'raksasa',
    role: 'The giant king of Alengka',
    story:
      'Also called Dasamuka, "the ten-faced". In the Javanese tellings his magic arts keep him from dying; he carried off Sinta and will not give her back.',
    body: rahwanaBody(),
    holes: [
      hole(0.03, 0.58, 0.045),
      diamond(-0.06, 0.75, 0.03),
      hole(0.0, 0.4, 0.03),
    ],
    back: [-0.135, 0.832],
    neck: [0.031, 0.868],
    arm: {
      shoulder: [0.104, 0.832],
      upper: 0.23,
      fore: 0.23,
      width: 0.044,
      hand: 'claw',
    },
    skin: '#5a1a2a',
    cloth: '#d4a23a',
  }),
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
  if (f.arm.hand === 'claw') {
    // Pancanaka-style long nail
    const nx = hx + Math.cos(r2 + 0.5) * w * 3;
    const ny = hy + Math.sin(r2 + 0.5) * w * 3;
    out.push(
      ell(hx, hy, w * 1.4, w * 1.1, 10, r2),
      cap(hx, hy, nx, ny, w * 0.55, w * 0.15)
    );
  } else if (f.arm.hand === 'fist') {
    out.push(ell(hx, hy, w * 1.3, w * 1.3, 10));
  } else {
    out.push(
      ell(
        hx + Math.cos(r2) * w,
        hy + Math.sin(r2) * w,
        w * 2.2,
        w * 0.9,
        10,
        r2
      )
    );
  }
  // the tuding: the dalang works the arm with a rod hanging from the hand
  out.push(rod(hx, hy, hx + 0.04, ROD_END));
  return out.map((q) => q.map((v, k) => (k % 2 === 0 ? ox + mx * v : v)));
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
