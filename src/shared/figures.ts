import type { Poly } from './grid.ts';

/**
 * Wayang figures as flat silhouettes. Frame: y up, feet on y = 0, the figure
 * faces +x, 1 unit = a standard satria's height. Every figure has carved
 * holes (light shines through them) and one arm on a rod that can be posed.
 */

export type SetId = 'punakawan' | 'pandawa' | 'kurawa' | 'dewa' | 'raksasa';

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
  /** where the fixed back arm's hand is: its rod hangs from here */
  backHand: [number, number];
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
    // back arm hanging
    cap(-0.04, 0.63, -0.03, 0.46, 0.022, 0.018),
    cap(-0.03, 0.46, 0.0, 0.26, 0.018, 0.014),
    ell(0.01, 0.235, 0.018, 0.035, 10, 0.3),
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
  // back arm, heavy
  cap(-0.08, 0.7, -0.1, 0.52, 0.035, 0.03),
  cap(-0.1, 0.52, -0.06, 0.36, 0.03, 0.024),
  ell(-0.055, 0.33, 0.026, 0.04, 10),
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
  // back arm resting on the behind
  cap(-0.06, 0.48, -0.14, 0.38, 0.03, 0.025),
  ell(-0.16, 0.36, 0.03, 0.025),
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
  cap(-0.06, 0.45, -0.09, 0.33, 0.022, 0.018),
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
  cap(-0.04, 0.72, -0.05, 0.52, 0.018, 0.015),
  cap(-0.05, 0.52, -0.02, 0.36, 0.015, 0.012),
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
  cap(-0.07, 0.46, -0.13, 0.34, 0.03, 0.024),
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
  cap(-0.05, 0.65, -0.12, 0.52, 0.022, 0.018),
  cap(-0.12, 0.52, -0.08, 0.4, 0.018, 0.014),
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
  cap(-0.13, 0.8, -0.18, 0.6, 0.045, 0.04),
  cap(-0.18, 0.6, -0.12, 0.44, 0.04, 0.032),
  ell(-0.11, 0.41, 0.04, 0.045),
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
  const [bx, by] = f.backHand;
  return {
    ...f,
    height,
    // the gapit runs from the crown down past the feet, the tuding hangs from the back hand
    body: [
      ...f.body,
      rod(0.005, height * 0.9, -0.01, ROD_END),
      rod(bx, by, bx + 0.03, ROD_END),
    ],
  };
};

export const FIGURES: Figure[] = [
  fig({
    id: 'semar',
    name: 'Semar',
    set: 'punakawan',
    role: 'Clown-servant and hidden god',
    story:
      'A round, wise servant who is secretly an elder god. He guides the Pandawa with jokes and plain truth.',
    body: semarBody(),
    holes: [
      hole(0.03, 0.38, 0.035),
      hole(-0.06, 0.24, 0.03),
      diamond(0.06, 0.55, 0.022),
    ],
    backHand: [-0.16, 0.36],
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
      'Cross-eyed, limping and crooked-armed: every flaw is a lesson, so he never grabs what is not his.',
    body: garengBody(),
    holes: [diamond(-0.01, 0.4, 0.03), hole(-0.04, 0.27, 0.025)],
    backHand: [-0.09, 0.33],
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
    role: 'The long-nosed son',
    story:
      'Tall and quick-tongued, he teases kings, and once crowned himself king for a day.',
    body: petrukBody(),
    holes: [
      hole(0.0, 0.62, 0.03),
      hole(0.0, 0.45, 0.028),
      diamond(-0.03, 0.39, 0.02),
    ],
    backHand: [-0.02, 0.36],
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
      "Born from Semar's own shadow, he says out loud what everyone else only thinks.",
    body: bagongBody(),
    holes: [hole(0.0, 0.36, 0.04), diamond(0.0, 0.56, 0.025)],
    backHand: [-0.13, 0.34],
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
      'The eldest brother and a just king, said never once to have told a lie.',
    body: yudhis.body,
    holes: [
      diamond(0.0, 0.4, 0.025),
      diamond(-0.02, 0.32, 0.022),
      hole(0.0, 0.56, 0.024),
    ].map((p) => p.map((v) => v * 0.97)),
    backHand: [0.0097, 0.228],
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
      'He speaks plainly to everyone, even the gods, and fights with the great thumbnail Pancanaka.',
    body: bimaBody(),
    holes: [
      P(-0.06, 0.48, -0.02, 0.48, -0.02, 0.44, -0.06, 0.44),
      P(0.02, 0.44, 0.06, 0.44, 0.06, 0.4, 0.02, 0.4),
      hole(0.0, 0.62, 0.035),
    ],
    backHand: [-0.055, 0.33],
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
      'The finest archer and the most refined of the brothers: calm outside, fierce in battle.',
    body: arjuna.body,
    holes: [
      hole(0.0, 0.4, 0.028),
      hole(-0.03, 0.31, 0.024),
      diamond(0.0, 0.56, 0.02),
    ],
    backHand: [0.01, 0.235],
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
    role: 'Twin son of Madri',
    story:
      'One of the twins: a healer, a horseman, and the most handsome of the brothers.',
    body: nakula.body,
    holes: [hole(0.0, 0.38, 0.03), hole(0.0, 0.53, 0.026)].map((p) =>
      p.map((v) => v * 0.93)
    ),
    backHand: [0.0093, 0.219],
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
      "Nakula's twin and the youngest brother, wise in the reading of stars and fate.",
    body: sadewa.body,
    holes: [
      diamond(-0.02, 0.33, 0.026),
      diamond(0.02, 0.4, 0.026),
      diamond(0.0, 0.53, 0.02),
    ].map((p) => p.map((v) => v * 0.93)),
    backHand: [0.0093, 0.219],
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
      'Eldest of the hundred Kurawa, a king who would rather go to war than share his kingdom.',
    body: duryu.body,
    holes: [hole(0.0, 0.42, 0.03), P(-0.04, 0.32, 0.03, 0.32, 0.0, 0.27)].map(
      (p) => p.map((v) => v * 1.06)
    ),
    backHand: [0.0106, 0.249],
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
    role: "The Kurawa's uncle",
    story:
      'The schemer of the Mahabharata: behind nearly every trap for the Pandawa stands Sengkuni.',
    body: sengkuniBody(),
    holes: [hole(-0.05, 0.57, 0.025), diamond(0.0, 0.36, 0.022)],
    backHand: [0.009, 0.212],
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
      'Ruler of the heaven Suralaya in Javanese wayang, shown with four arms.',
    body: guruBody(),
    holes: [
      hole(0.0, 0.4, 0.026),
      diamond(0.02, 0.88, 0.02),
      hole(-0.12, 0.76, 0.015),
    ],
    backHand: [0.01, 0.235],
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
    name: 'Dewa Ruci',
    set: 'dewa',
    role: 'The thumb-sized god',
    story:
      'A god no bigger than a thumb. Bima walks inside his tiny body and finds himself there.',
    body: dewaruciBody(),
    holes: [hole(0.0, 0.31, 0.022)],
    backHand: [-0.0275, 0.165],
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
      'Quick and restless, he always challenges the knight in the flower battle, and always loses.',
    body: cakilBody(),
    holes: [
      hole(0.0, 0.57, 0.026),
      diamond(-0.02, 0.41, 0.024),
      hole(-0.06, 0.35, 0.02),
    ],
    backHand: [-0.08, 0.4],
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
      'A great stock giant with a nose like an eggplant; the gamelan roars whenever he stomps in.',
    body: butaBody(),
    holes: [
      hole(0.03, 0.55, 0.045),
      diamond(-0.06, 0.72, 0.03),
      hole(0.0, 0.38, 0.03),
    ],
    backHand: [-0.11, 0.41],
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
];

export const figure = (id: string): Figure => {
  const f = FIGURES.find((x) => x.id === id);
  if (!f) throw new Error(`unknown figure ${id}`);
  return f;
};

/** arm positions: shoulder angle and elbow bend, degrees, facing +x */
export const ARM_POSES: [number, number][] = [
  [-95, 12], // down
  [-15, 25], // forward
  [65, 40], // up
];

export const ARM_NAMES = ['down', 'forward', 'up'] as const;

/** the front arm as polygons for an arm pose */
export const armPolys = (f: Figure, armPose: number): Poly[] => {
  const [sx, sy] = f.arm.shoulder;
  const [a0, bend] = ARM_POSES[armPose] ?? ARM_POSES[0]!;
  const r1 = (a0 * Math.PI) / 180;
  const ex = sx + Math.cos(r1) * f.arm.upper;
  const ey = sy + Math.sin(r1) * f.arm.upper;
  const r2 = ((a0 + bend) * Math.PI) / 180;
  const wx = ex + Math.cos(r2) * f.arm.fore;
  const wy = ey + Math.sin(r2) * f.arm.fore;
  const w = f.arm.width;
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
  return out;
};
