import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { drawPuppet, type ArtStyle } from './art.ts';

/** the Blender-rendered card art (tools/blender/build_wayang.py) */
const artUrl = (id: string, arm: number) =>
  `${import.meta.env.BASE_URL}art/${id}-${arm}.webp`;

/** a faint warm edge so dark puppets read on the dark chest */
const EDGE: CSSProperties = {
  filter: 'drop-shadow(0 0 1px rgba(255, 228, 180, 0.85))',
};
const GOLD_LEAF: CSSProperties = {
  filter:
    'drop-shadow(0 0 5px rgba(255, 205, 90, 0.9)) saturate(1.15) brightness(1.08)',
};

/** a puppet: the 3D card art, or drawn on a canvas when locked or offline */
export const PuppetArt = (props: {
  id: string;
  style?: ArtStyle;
  arm?: number;
  className?: string;
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const { id, style = 'painted', arm = 0 } = props;
  const src = artUrl(id, Math.min(2, Math.max(0, arm)));
  const [failed, setFailed] = useState<string | null>(null);
  const useImage = style !== 'locked' && failed !== src;
  useEffect(() => {
    const c = ref.current;
    if (useImage || !c) return;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.max(8, Math.round(r.width * dpr));
    c.height = Math.max(8, Math.round(r.height * dpr));
    drawPuppet(c, id, style, arm);
  }, [id, style, arm, useImage]);
  if (useImage)
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={props.className ?? 'puppet-art'}
        style={{
          objectFit: 'contain',
          objectPosition: '50% 100%',
          minWidth: 0,
          ...(style === 'gold' ? GOLD_LEAF : EDGE),
        }}
        onError={() => setFailed(src)}
      />
    );
  return (
    <canvas
      ref={ref}
      className={props.className ?? 'puppet-art'}
      aria-hidden="true"
    />
  );
};

type IconName =
  | 'left'
  | 'right'
  | 'near'
  | 'far'
  | 'tiltL'
  | 'tiltR'
  | 'arm'
  | 'flip'
  | 'chest'
  | 'album'
  | 'hint'
  | 'sound'
  | 'mute'
  | 'back'
  | 'reset'
  | 'close';

const PATHS: Record<IconName, string> = {
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  near: 'M12 4v16M4 12h16',
  far: 'M4 12h16',
  tiltL: 'M8 7H4V3M4.6 7.4A8 8 0 1 1 4 13',
  tiltR: 'M16 7h4V3M19.4 7.4A8 8 0 1 0 20 13',
  arm: 'M6 20l4-8 3-6m0 0l4 2m-4-2l-1 4',
  flip: 'M12 3v18M9 7l-5 5 5 5M15 7l5 5-5 5',
  chest: 'M4 10h16v9H4zM4 10l2-5h12l2 5M10 14h4',
  album: 'M5 4h10v16H5zM15 6l4 1-3 13',
  hint: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
  sound: 'M4 9v6h4l5 4V5L8 9H4zM16 8a5 5 0 0 1 0 8',
  mute: 'M4 9v6h4l5 4V5L8 9H4zM16 9l5 6M21 9l-5 6',
  back: 'M15 5l-7 7 7 7',
  reset: 'M4 4v6h6M5.5 15a8 8 0 1 0 1.9-8.3L4 10',
  close: 'M6 6l12 12M18 6L6 18',
};

export const Icon = (props: { name: IconName; size?: number }) => (
  <svg
    width={props.size ?? 20}
    height={props.size ?? 20}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={PATHS[props.name]} />
  </svg>
);

export const Modal = (props: {
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}) => (
  <div className="modal-back" onClick={props.onClose}>
    <div
      className={`modal ${props.className ?? ''}`}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
    >
      {props.children}
    </div>
  </div>
);

/** kawung batik as a CSS background, drawn as SVG */
export const KAWUNG = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><g fill="none" stroke="#d8a84a" stroke-opacity="0.09" stroke-width="1.2"><ellipse cx="18" cy="9" rx="5" ry="8"/><ellipse cx="18" cy="27" rx="5" ry="8"/><ellipse cx="9" cy="18" rx="8" ry="5"/><ellipse cx="27" cy="18" rx="8" ry="5"/><circle cx="18" cy="18" r="1.5"/></g></svg>'
)}")`;
