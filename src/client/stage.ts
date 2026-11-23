import { ANGLES, ARMS, DEPTHS, SLOTS, type Pose } from '../shared/shadow.ts';

/** The eight taps that move a puppet (the game and the builder share them). */
export type Tool =
  'left' | 'right' | 'far' | 'near' | 'tiltL' | 'tiltR' | 'arm' | 'flip';

export const TOOLS: { tool: Tool; label: string }[] = [
  { tool: 'left', label: 'Left' },
  { tool: 'right', label: 'Right' },
  { tool: 'far', label: 'Farther' },
  { tool: 'near', label: 'Closer' },
  { tool: 'tiltL', label: 'Tilt' },
  { tool: 'tiltR', label: 'Tilt' },
  { tool: 'arm', label: 'Arm' },
  { tool: 'flip', label: 'Flip' },
];

export const applyTool = (p: Pose, t: Tool): Pose | null => {
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
    case 'arm':
      return { ...p, arm: (p.arm + 1) % ARMS };
    case 'flip':
      return { ...p, flip: !p.flip };
  }
};

/** how close a move came, for the share card's trail: 0..3 */
export const closeness = (match: number): number =>
  match >= 0.95 ? 3 : match >= 0.8 ? 2 : match >= 0.5 ? 1 : 0;

/** from Thursday the meter is gone; at the weekend so is the red overflow */
export const showsMeter = (weekday: number) => weekday < 3;
export const showsOverflow = (weekday: number) => weekday < 5;
