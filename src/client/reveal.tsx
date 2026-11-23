import { useEffect, useMemo, useRef, useState } from 'react';
import { figure } from '../shared/figures.ts';
import { GH, GW } from '../shared/grid.ts';
import type { Pose } from '../shared/shadow.ts';
import { paintScene, type PaintedPuppet } from './paint.ts';

/**
 * After a solve: turn the screen around and show the painted puppets that
 * cast the shadow. three.js is loaded only now, so the first load stays
 * small. Without WebGL (or with reduced motion) the kelir flips flat instead.
 */

type Props = {
  /** 2 on a two-lamp night */
  lamps?: number;
  offered: readonly string[];
  slots: readonly (Pose | null)[];
  onDone: () => void;
};

const canWebGL = () => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
};

const reducedMotion = () =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

const names = (puppets: PaintedPuppet[]) => {
  const n = puppets.map((p) => figure(p.id).name);
  return n.length <= 1
    ? (n[0] ?? '')
    : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
};

/** the painted side drawn flat at the shadows' places, for the fallback */
const drawFlat = (canvas: HTMLCanvasElement, puppets: PaintedPuppet[]) => {
  const w = canvas.width;
  const h = canvas.height;
  const g = canvas.getContext('2d')!;
  const bg = g.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h / 2, w * 0.6);
  bg.addColorStop(0, '#3a2216');
  bg.addColorStop(1, '#150c0b');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const k = w / GW;
  for (const p of puppets)
    g.drawImage(
      p.color,
      p.box.x0 * k,
      (GH - p.box.y1) * k,
      (p.box.x1 - p.box.x0) * k,
      (p.box.y1 - p.box.y0) * k
    );
};

export const Reveal = ({ offered, slots, onDone, lamps = 1 }: Props) => {
  const puppets = useMemo(() => paintScene(offered, slots), [offered, slots]);
  const [flat, setFlat] = useState(() => !canWebGL() || reducedMotion());
  const host = useRef<HTMLDivElement>(null);
  const flatCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (flat || !host.current) return;
    const el = host.current;
    let handle: { dispose: () => void } | null = null;
    let gone = false;
    import('./reveal3d.ts')
      .then((m) => {
        if (gone) return;
        handle = m.startReveal(el, puppets, lamps);
      })
      .catch(() => {
        if (!gone) setFlat(true);
      });
    return () => {
      gone = true;
      handle?.dispose();
    };
  }, [flat, puppets, lamps]);

  useEffect(() => {
    if (!flat || !flatCanvas.current) return;
    const c = flatCanvas.current;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(1, Math.round(r.width * dpr));
    c.height = Math.round((c.width * GH) / GW);
    drawFlat(c, puppets);
  }, [flat, puppets]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  return (
    <div
      className={`reveal ${flat ? 'flat' : 'deep'}`}
      role="dialog"
      aria-label="Behind the screen: the puppets that cast your shadow"
      onClick={onDone}
    >
      {flat ? (
        <div className="reveal-flat">
          <canvas ref={flatCanvas} />
        </div>
      ) : (
        <div className="reveal-stage" ref={host} />
      )}
      <div className="reveal-caption">
        <p className="eyebrow">Behind the kelir</p>
        <h2 className="display">The dalang's side</h2>
        <p>
          {names(puppets)}, lit by the blencong. Every shadow you matched came
          from here.
        </p>
        <button
          className="btn"
          onClick={(e) => {
            e.stopPropagation();
            onDone();
          }}
          autoFocus
        >
          Continue
        </button>
      </div>
    </div>
  );
};
