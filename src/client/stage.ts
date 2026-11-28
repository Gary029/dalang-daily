import { ANGLES, ARMS, DEPTHS, SLOTS, type Pose } from '../shared/shadow.ts';

/** The taps that move a puppet (the game and the builder share them). */
export type Tool =
  | 'left'
  | 'right'
  | 'far'
  | 'near'
  | 'tiltL'
  | 'tiltR'
  | 'flip'
  | 'shoulder'
  | 'elbow'
  | 'head';

/** which arm the Shoulder and Elbow taps work */
export type Side = 'front' | 'back';

export type ToolButton = { tool: Tool; label: string; icon: string };

/**
 * The pad for a puzzle's joint level: 0 front shoulder, 1 + elbow,
 * 2 + back arm (the side switch appears), 3 + head.
 */
export const toolsFor = (level: number): ToolButton[] => [
  { tool: 'left', label: 'Left', icon: 'left' },
  { tool: 'right', label: 'Right', icon: 'right' },
  { tool: 'far', label: 'Farther', icon: 'far' },
  { tool: 'near', label: 'Closer', icon: 'near' },
  { tool: 'tiltL', label: 'Tilt', icon: 'tiltL' },
  { tool: 'tiltR', label: 'Tilt', icon: 'tiltR' },
  { tool: 'flip', label: 'Flip', icon: 'flip' },
  ...(level >= 3
    ? [{ tool: 'head' as const, label: 'Head', icon: 'head' }]
    : []),
  { tool: 'shoulder', label: level >= 1 ? 'Shoulder' : 'Arm', icon: 'arm' },
  ...(level >= 1
    ? [{ tool: 'elbow' as const, label: 'Elbow', icon: 'elbow' }]
    : []),
];

export const applyTool = (
  p: Pose,
  t: Tool,
  side: Side = 'front'
): Pose | null => {
  const next = (v: number) => (v + 1) % ARMS;
  switch (t) {
    case 'left':
      return p.x > 0 ? { ...p, x: p.x - 1 } : null;
    case 'right':
      return p.x < SLOTS - 1 ? { ...p, x: p.x + 1 } : null;
    case 'far':
      return p.d > 0 ? { ...p, d: p.d - 1 } : null;
    case 'near':
      return p.d < DEPTHS - 1 ? { ...p, d: p.d + 1 } : null;
    case 'tiltL':
      return { ...p, a: (p.a + 1) % ANGLES };
    case 'tiltR':
      return { ...p, a: (p.a + ANGLES - 1) % ANGLES };
    case 'flip':
      return { ...p, flip: !p.flip };
    case 'shoulder':
      return side === 'front'
        ? { ...p, arm: next(p.arm) }
        : { ...p, back: next(p.back) };
    case 'elbow':
      return side === 'front'
        ? { ...p, elbow: next(p.elbow) }
        : { ...p, backElbow: next(p.backElbow) };
    case 'head':
      return { ...p, head: next(p.head) };
  }
};

/** how close a move came, for the share card's trail: 0..3 */
export const closeness = (match: number): number =>
  match >= 0.95 ? 3 : match >= 0.8 ? 2 : match >= 0.5 ? 1 : 0;

/** from Thursday the meter is gone; at the weekend so is the red overflow */
export const showsMeter = (weekday: number) => weekday < 3;
export const showsOverflow = (weekday: number) => weekday < 5;
