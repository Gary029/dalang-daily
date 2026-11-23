import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { GH, GW, getBit, type Mask } from '../shared/grid.ts';
import type { PlacedPolys } from '../shared/shadow.ts';
import { cellAt, drawKelir } from './kelir.ts';

type Props = {
  shadow: PlacedPolys[];
  target: PlacedPolys[] | null;
  selected: PlacedPolys | null;
  glow?: number;
  overflow?: boolean;
  /** puppet masks in stage order, for tapping a shadow to pick it */
  pickable?: { index: number; mask: Mask }[];
  onPick?: (index: number | null) => void;
  label?: string;
  maxWidth?: number;
};

/** The kelir framed in carved wood, sized to fit its box at 5:3. */
export const Kelir = (props: Props) => {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const frame = 14; // wood frame on each side
      const maxW = Math.min(r.width, props.maxWidth ?? 9999) - frame * 2;
      const maxH = r.height - frame * 2;
      let w = maxW;
      let h = (w * GH) / GW;
      if (h > maxH) {
        h = maxH;
        w = (h * GW) / GH;
      }
      setSize({ w: Math.max(0, Math.floor(w)), h: Math.max(0, Math.floor(h)) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [props.maxWidth]);

  const { shadow, target, selected, glow, overflow } = props;
  useEffect(() => {
    const c = canvas.current;
    if (!c || size.w === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pw = Math.min(1400, Math.round(size.w * dpr));
    c.width = pw;
    c.height = Math.round((pw * GH) / GW);
    drawKelir(c, {
      shadow,
      target,
      selected,
      glow: glow ?? 0,
      overflow: overflow ?? true,
    });
  }, [shadow, target, selected, glow, overflow, size]);

  const onPointer = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!props.onPick || !canvas.current) return;
    const cell = cellAt(canvas.current, e.clientX, e.clientY);
    if (!cell) return;
    const [i, j] = cell;
    const list = props.pickable ?? [];
    for (let k = list.length - 1; k >= 0; k--) {
      if (getBit(list[k]!.mask, i, j)) return props.onPick(list[k]!.index);
    }
    // forgiving: the nearest shadow within a few cells
    let best: number | null = null;
    let bestD = 12 * 12;
    for (const p of list) {
      for (let dj = -11; dj <= 11; dj++)
        for (let di = -11; di <= 11; di++) {
          const x = i + di;
          const y = j + dj;
          if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
          if (getBit(p.mask, x, y) && di * di + dj * dj < bestD) {
            bestD = di * di + dj * dj;
            best = p.index;
          }
        }
    }
    props.onPick(best);
  };

  return (
    <div className="kelir-box" ref={box}>
      <div
        className="kelir-frame"
        style={{ width: size.w + 28, height: size.h + 28 }}
      >
        <canvas
          ref={canvas}
          className="kelir"
          style={{ width: size.w, height: size.h }}
          onPointerDown={onPointer}
          role="img"
          aria-label={props.label ?? 'The shadow screen'}
        />
        <div className="lamp" aria-hidden="true" />
      </div>
    </div>
  );
};
