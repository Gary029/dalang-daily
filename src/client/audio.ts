/**
 * A tiny gamelan made with WebAudio: saron keys, a kecrek tick for moves and
 * a gong for the solved shadow. Nothing is downloaded.
 */

// slendro, roughly: five near-equal steps to the octave
const SLENDRO = [1, 1.149, 1.32, 1.516, 1.741, 2];
const BASE = 392;

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

const metal = (freq: number, at: number, dur: number, gain: number) => {
  const a = ac();
  if (!a) return;
  const out = a.createGain();
  out.gain.setValueAtTime(0, a.currentTime + at);
  out.gain.linearRampToValueAtTime(gain, a.currentTime + at + 0.005);
  out.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + dur);
  out.connect(a.destination);
  // a metal bar: the fundamental and an inharmonic overtone
  for (const [mul, g] of [
    [1, 1],
    [2.76, 0.35],
    [5.4, 0.12],
  ] as const) {
    const o = a.createOscillator();
    const og = a.createGain();
    o.type = 'sine';
    o.frequency.value = freq * mul;
    og.gain.value = g;
    o.connect(og).connect(out);
    o.start(a.currentTime + at);
    o.stop(a.currentTime + at + dur + 0.05);
  }
};

export const saron = (degree: number, at = 0) => {
  const oct = Math.floor(degree / 5);
  const step = ((degree % 5) + 5) % 5;
  metal(BASE * SLENDRO[step]! * 2 ** oct, at, 1.1, 0.16);
};

export const gong = (at = 0) => {
  const a = ac();
  if (!a) return;
  const out = a.createGain();
  out.gain.setValueAtTime(0, a.currentTime + at);
  out.gain.linearRampToValueAtTime(0.35, a.currentTime + at + 0.02);
  out.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + 4.5);
  out.connect(a.destination);
  // two close partials beat slowly, the gong's "ombak"
  for (const f of [68, 69.6, 137, 205]) {
    const o = a.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = a.createGain();
    g.gain.value = f < 100 ? 0.5 : 0.12;
    o.connect(g).connect(out);
    o.start(a.currentTime + at);
    o.stop(a.currentTime + at + 4.6);
  }
};

/** short bright tick, like the kecrek plates the dalang knocks */
export const tick = () => {
  const a = ac();
  if (!a) return;
  const len = Math.floor(a.sampleRate * 0.05);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let k = 0; k < len; k++)
    data[k] = (Math.random() * 2 - 1) * (1 - k / len) ** 3;
  const src = a.createBufferSource();
  src.buffer = buf;
  const hp = a.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3500;
  const g = a.createGain();
  g.gain.value = 0.12;
  src.connect(hp).connect(g).connect(a.destination);
  src.start();
};

export const solvedPhrase = () => {
  [2, 3, 5, 3, 2, 1, 2].forEach((d, k) => saron(d, k * 0.18));
  gong(7 * 0.18);
};

export const wrongPhrase = () => {
  saron(1);
  saron(0, 0.16);
};
