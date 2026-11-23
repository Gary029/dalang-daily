import { FIGURES } from './figures.ts';
import { count, encodeMask } from './grid.ts';
import { parOf, shadowOf, solve, type Slot } from './puzzle.ts';
import { ANGLES, ARMS, DEPTHS, SLOTS } from './shadow.ts';
import type { UgcPuzzle } from './game.ts';

/**
 * Player-made shadows. A player poses puppets from their own album, keeps at
 * least one as a decoy, and the solver must find exactly one answer before
 * the shadow can be posted. The server runs the same check again.
 */

export type CreateRequest = { title: string; offered: string[]; slots: Slot[] };

export type CreateCheck =
  { ok: true; par: number; level: number } | { ok: false; message: string };

export const MAX_OFFERED = 4;
export const MAX_CAST = 3;

const isPose = (v: unknown): boolean => {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  const int = (x: unknown, n: number) =>
    Number.isInteger(x) && (x as number) >= 0 && (x as number) < n;
  return (
    int(p.x, SLOTS) &&
    int(p.d, DEPTHS) &&
    int(p.a, ANGLES) &&
    int(p.arm, ARMS) &&
    typeof p.flip === 'boolean'
  );
};

export const cleanTitle = (t: unknown): string =>
  typeof t === 'string'
    ? t
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60)
    : '';

/** difficulty label from par, on the same Monday..Sunday scale */
export const levelForPar = (par: number): number =>
  par <= 4
    ? 0
    : par <= 6
      ? 1
      : par <= 8
        ? 2
        : par <= 10
          ? 3
          : par <= 12
            ? 4
            : par <= 14
              ? 5
              : 6;

/** Checks a shadow a player wants to post. `owned` is their album. */
export const checkShadow = (
  req: CreateRequest,
  owned: readonly string[]
): CreateCheck => {
  const title = cleanTitle(req.title);
  if (title.length < 3)
    return { ok: false, message: 'Give your scene a name.' };
  const ids = req.offered;
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > MAX_OFFERED)
    return {
      ok: false,
      message: `Put 2 to ${MAX_OFFERED} puppets in the chest.`,
    };
  if (new Set(ids).size !== ids.length)
    return { ok: false, message: 'Each puppet can be in the chest once.' };
  if (!ids.every((id) => FIGURES.some((f) => f.id === id)))
    return { ok: false, message: 'Unknown puppet.' };
  if (!ids.every((id) => owned.includes(id)))
    return { ok: false, message: 'You can only use wayang from your album.' };
  const slots = req.slots;
  if (
    !Array.isArray(slots) ||
    slots.length !== ids.length ||
    !slots.every((s) => s === null || isPose(s))
  )
    return { ok: false, message: 'Bad puppet positions.' };
  const cast = slots.filter((s) => s !== null).length;
  if (cast < 1 || cast > MAX_CAST)
    return {
      ok: false,
      message: `Stand 1 to ${MAX_CAST} puppets on the screen.`,
    };
  if (cast === ids.length)
    return {
      ok: false,
      message: 'Leave at least one puppet in the chest as a decoy.',
    };
  const target = shadowOf(ids, slots);
  if (count(target) === 0)
    return { ok: false, message: 'The screen is empty.' };
  const { solutions } = solve(ids, target, 2);
  if (solutions.length !== 1)
    return {
      ok: false,
      message:
        'Two different answers cast this shadow. Move a puppet or change the decoy so only one works.',
    };
  const par = parOf(
    ids.map(() => null),
    slots
  );
  return { ok: true, par, level: levelForPar(par) };
};

/** A checked shadow as a playable puzzle. Every puppet starts in the chest. */
export const toUgc = (
  req: CreateRequest,
  check: { par: number; level: number },
  author: string,
  id: string
): UgcPuzzle => ({
  id,
  index: -2,
  lakon: 'Player shadow',
  title: cleanTitle(req.title),
  scene: `A shadow made by u/${author}. Every puppet starts in the chest.`,
  weekday: check.level,
  offered: [...req.offered],
  start: req.offered.map(() => null),
  par: check.par,
  lamps: 1,
  target: encodeMask(shadowOf(req.offered, req.slots)),
  solution: [...req.slots],
  cards: [],
  tale: '',
  author,
  created: Date.now(),
});

export const newUgcId = (): string =>
  `u-${Date.now().toString(36)}${Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .padStart(4, '0')}`;
