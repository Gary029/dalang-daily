/**
 * The gamelan, ported from Dalang VR's GamelanSynth: the same pelog-flavoured
 * tuning, metallophone partials, gong "ombak" beating, kendang and the
 * dalang's cempala knock. Each sound is rendered once into a buffer, the way
 * the Quest game builds its clips, then replayed. Nothing is downloaded.
 */

/** degrees 0-9, in Hz (GamelanSynth.Pelog) */
const PELOG = [
  293.7, 311.1, 349.2, 415.3, 440.0, 466.2, 523.3, 587.3, 622.3, 698.5,
];

let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = localStorage.getItem('dalang-muted') === '1';
} catch {
  /* storage blocked */
}

export const isMuted = () => muted;

export const setMuted = (m: boolean) => {
  muted = m;
  try {
    localStorage.setItem('dalang-muted', m ? '1' : '0');
  } catch {
    /* storage blocked */
  }
};

const ac = (): AudioContext | null => {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
};

// --- clip rendering ------------------------------------------------------------

const cache = new Map<string, AudioBuffer>();

/** render `seconds` of sound, normalise to 0.95 peak, fade the last `fade` s */
const render = (
  a: AudioContext,
  key: string,
  seconds: number,
  fade: number,
  sample: (t: number) => number
): AudioBuffer => {
  const hit = cache.get(key);
  if (hit) return hit;
  const rate = a.sampleRate;
  const n = Math.max(1, Math.floor(seconds * rate));
  const buf = a.createBuffer(1, n, rate);
  const d = buf.getChannelData(0);
  let peak = 0;
  for (let k = 0; k < n; k++) {
    const v = sample(k / rate);
    d[k] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  const norm = peak > 0 ? 0.95 / peak : 1;
  const f = Math.floor(fade * rate);
  for (let k = 0; k < n; k++) {
    const tail = n - k;
    d[k] = d[k]! * norm * (tail < f ? tail / f : 1);
  }
  cache.set(key, buf);
  return buf;
};

const TAU = Math.PI * 2;

/** GamelanSynth.Metallophone: four inharmonic partials, each decaying faster */
const metallophone = (
  a: AudioContext,
  f0: number,
  seconds: number,
  detune: number
) =>
  render(a, `m${f0}:${seconds}:${detune}`, seconds, 0.02, (t) => {
    const f = f0 * (1 + detune * 0.002);
    const ratios = [1, 2.71, 5.15, 8.4];
    const amps = [1, 0.38, 0.16, 0.06];
    const decays = [1.0, 2.3, 4.0, 6.0];
    let s = 0;
    for (let p = 0; p < 4; p++)
      s +=
        amps[p]! *
        Math.exp((-t * decays[p]! * 1.6) / seconds) *
        Math.sin(TAU * f * ratios[p]! * t);
    const attack = Math.min(1, t / 0.004);
    const trem = 1 + 0.5 * detune * Math.sin(TAU * 3.1 * t);
    return s * attack * trem * 0.6;
  });

/** GamelanSynth.Gong: wobbling fundamental and the slow ombak beat */
const gongClip = (a: AudioContext, f0: number, seconds: number) =>
  render(a, `g${f0}:${seconds}`, seconds, 0.05, (t) => {
    const parts: [number, number, number][] = [
      [1, 1, 1.1],
      [1.98, 0.45, 1.7],
      [3.07, 0.25, 2.6],
      [4.5, 0.12, 4.0],
    ];
    let s = 0;
    for (const [r, amp, dec] of parts) {
      const wobble = r === 1 ? 1 + 0.004 * Math.sin(TAU * 2.3 * t) : 1;
      s += amp * Math.exp(-dec * t) * Math.sin(TAU * f0 * r * wobble * t);
    }
    const ombak = 1 + 0.35 * Math.sin(TAU * 1.6 * t) * Math.exp(-0.6 * t);
    return s * ombak * Math.min(1, t / 0.02) * 0.5;
  });

/** GamelanSynth.Drum: a kendang stroke, pitch sweep plus a noisy skin */
const kendangClip = (a: AudioContext, f0: number, seconds: number) => {
  let y = 0;
  let phase = 0;
  let last = 0;
  return render(a, `k${f0}:${seconds}`, seconds, 0.01, (t) => {
    const f = f0 * (1 + 1.8 * Math.exp(-40 * t));
    phase += TAU * f * (t - last);
    last = t;
    y += (Math.random() * 2 - 1 - y) * 0.25;
    return Math.sin(phase) * Math.exp(-18 * t) + y * Math.exp(-45 * t) * 0.8;
  });
};

/** GamelanSynth.Click: the cempala, wood knocked on the puppet chest */
const cempalaClip = (a: AudioContext) => {
  let y = 0;
  let prev = 0;
  return render(a, 'cempala', 0.06, 0.005, (t) => {
    y += (Math.random() * 2 - 1 - y) * 0.6;
    const hp = y - prev;
    prev = y;
    return (
      hp * 1.5 * Math.exp(-90 * t) +
      Math.sin(TAU * 1800 * t) * Math.exp(-120 * t) * 0.6
    );
  });
};

const play = (buf: AudioBuffer, at: number, gain: number) => {
  const a = ac();
  if (!a) return;
  const src = a.createBufferSource();
  src.buffer = buf;
  const g = a.createGain();
  g.gain.value = gain * 0.7; // GamelanPlayer master volume
  src.connect(g).connect(a.destination);
  src.start(a.currentTime + at);
};

// --- instruments -----------------------------------------------------------------

const degree = (d: number) => PELOG[((d % 10) + 10) % 10]!;

export const saron = (d: number, at = 0, gain = 0.55) => {
  const a = ac();
  if (a) play(metallophone(a, degree(d), 1.6, 0.012), at, gain * 0.5);
};

export const bonang = (d: number, at = 0, gain = 0.3) => {
  const a = ac();
  if (a) play(metallophone(a, degree(d) * 2, 1.1, 0.03), at, gain * 0.5);
};

export const kempul = (at = 0) => {
  const a = ac();
  if (a) play(gongClip(a, 146.8, 2.4), at, 0.3);
};

export const gong = (at = 0) => {
  const a = ac();
  if (a) play(gongClip(a, 73.4, 4.5), at, 0.5);
};

export const kendang = (high: boolean, at = 0) => {
  const a = ac();
  if (a)
    play(
      high ? kendangClip(a, 240, 0.14) : kendangClip(a, 95, 0.28),
      at,
      high ? 0.3 : 0.4
    );
};

let warmed = false;
/** render the solve's clips early, so the solve itself never stutters */
const prewarm = (a: AudioContext) => {
  if (warmed) return;
  warmed = true;
  const jobs = [
    () => gongClip(a, 73.4, 4.5),
    () => gongClip(a, 146.8, 2.4),
    () => kendangClip(a, 95, 0.28),
    () => kendangClip(a, 240, 0.14),
    ...[0, 1, 2, 3, 5].map((d) => () => metallophone(a, degree(d), 1.6, 0.012)),
    ...[0, 1, 3].map((d) => () => metallophone(a, degree(d) * 2, 1.1, 0.03)),
  ];
  // one clip per pause, so no single frame does all the work
  const next = () => {
    const job = jobs.shift();
    if (!job) return;
    job();
    setTimeout(next, 60);
  };
  setTimeout(next, 200);
};

/** every move: the dalang's cempala knock */
export const tick = () => {
  const a = ac();
  if (!a) return;
  play(cempalaClip(a), 0, 0.25);
  prewarm(a);
};

/**
 * The solved shadow: one gongan of the Quest game's scene balungan, quick,
 * with bonang on the off-beats, kempul on 4, kendang on 3 and 7, gong at the end.
 */
export const solvedPhrase = () => {
  const step = 0.2;
  [2, 3, 5, 3, 2, 1, 2, 0].forEach((d, k) => {
    saron(d, k * step);
    if (k % 2 === 1) bonang(d, k * step);
    if (k === 2 || k === 6) kendang(false, k * step);
  });
  kempul(3 * step);
  gong(7 * step);
};

export const wrongPhrase = () => {
  kendang(false);
  saron(1, 0.05, 0.45);
  saron(0, 0.22, 0.45);
};
