import {
  emptyProfile,
  rankFor,
  type CardGrade,
  type Profile,
  type SolveResponse,
  type TodaySolve,
} from './api.ts';
import { WARMUP, puzzleById, puzzleForDay, BANK } from './bank.ts';
import { figure, FIGURES, SETS } from './figures.ts';
import {
  dateLabel,
  hintsFor,
  isSolved,
  type PuzzleDef,
  type Slot,
} from './puzzle.ts';
import { ANGLES, ARMS, DEPTHS, SLOTS } from './shadow.ts';

/** The slice of Devvit's Redis client this game uses (an in-memory one backs the tests). */
export type KV = {
  get(key: string): Promise<string | undefined | null>;
  set(key: string, value: string): Promise<unknown>;
  hGet(key: string, field: string): Promise<string | undefined | null>;
  hSet(key: string, fields: Record<string, string>): Promise<unknown>;
  hLen(key: string): Promise<number>;
};

export type PostInfo = { day: number; index: number };

const k = {
  post: (postId: string) => `post:${postId}`,
  profile: (user: string) => `profile:${user}`,
  players: (postId: string) => `players:${postId}`,
  solvers: (postId: string) => `solvers:${postId}`,
  hints: (postId: string) => `hints:${postId}`,
};

export const savePostInfo = async (kv: KV, postId: string, info: PostInfo) => {
  await kv.set(k.post(postId), JSON.stringify(info));
};

export const postInfo = async (
  kv: KV,
  postId: string,
  today: number
): Promise<PostInfo> => {
  const raw = await kv.get(k.post(postId));
  if (raw) {
    try {
      const v = JSON.parse(raw) as Partial<PostInfo>;
      if (typeof v.day === 'number' && typeof v.index === 'number')
        return { day: v.day, index: v.index };
    } catch {
      /* fall through */
    }
  }
  return { day: today, index: BANK.puzzles.indexOf(puzzleForDay(today)) };
};

export const puzzleOfPost = (info: PostInfo): PuzzleDef =>
  BANK.puzzles[info.index] ?? puzzleForDay(info.day);

export const loadProfile = async (kv: KV, user: string): Promise<Profile> => {
  const raw = await kv.get(k.profile(user));
  if (!raw) return emptyProfile();
  try {
    return { ...emptyProfile(), ...(JSON.parse(raw) as Partial<Profile>) };
  } catch {
    return emptyProfile();
  }
};

const saveProfile = (kv: KV, user: string, p: Profile) =>
  kv.set(k.profile(user), JSON.stringify(p));

export const markPlayer = async (kv: KV, postId: string, user: string) => {
  if (!(await kv.hGet(k.players(postId), user)))
    await kv.hSet(k.players(postId), { [user]: '1' });
};

export const counts = async (kv: KV, postId: string) => ({
  players: await kv.hLen(k.players(postId)),
  solvers: await kv.hLen(k.solvers(postId)),
});

export const solveOf = async (
  kv: KV,
  postId: string,
  user: string
): Promise<TodaySolve | null> => {
  const raw = await kv.hGet(k.solvers(postId), user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TodaySolve;
  } catch {
    return null;
  }
};

export const hintsUsed = async (
  kv: KV,
  postId: string,
  user: string
): Promise<number> => Number((await kv.hGet(k.hints(postId), user)) ?? 0);

export const revealHint = async (
  kv: KV,
  postId: string,
  user: string,
  def: PuzzleDef
): Promise<string[]> => {
  const all = hintsFor(def);
  const used = Math.min(all.length, (await hintsUsed(kv, postId, user)) + 1);
  await kv.hSet(k.hints(postId), { [user]: String(used) });
  return all.slice(0, used);
};

export const shownHints = async (
  kv: KV,
  postId: string,
  user: string,
  def: PuzzleDef
) => hintsFor(def).slice(0, await hintsUsed(kv, postId, user));

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

/** Checks a claimed answer against the puzzle (never trusts the post). */
export const validSlots = (def: PuzzleDef, slots: unknown): slots is Slot[] =>
  Array.isArray(slots) &&
  slots.length === def.offered.length &&
  slots.every((s) => s === null || isPose(s));

export const completedSets = (cards: Record<string, CardGrade>): string[] =>
  SETS.filter((s) =>
    FIGURES.filter((f) => f.set === s.id).every((f) => cards[f.id])
  ).map((s) => s.id);

export const flairText = (cards: Record<string, CardGrade>): string => {
  const n = Object.keys(cards).length;
  const sets = completedSets(cards).length;
  return `${rankFor(n)} · ${n} wayang${sets > 0 ? ` · ${sets} gunungan` : ''}`;
};

/**
 * Records a solve: cards (gold at par with no hints), streak, counts.
 * A second solve of the same post changes nothing.
 */
export const recordSolve = async (
  kv: KV,
  args: {
    postId: string;
    user: string;
    info: PostInfo;
    def: PuzzleDef;
    slots: Slot[];
    moves: number;
  }
): Promise<SolveResponse> => {
  const { postId, user, info, def, slots } = args;
  const moves = Math.max(def.par, Math.floor(args.moves));
  const profile = await loadProfile(kv, user);
  const base = { type: 'solve' as const, par: def.par };
  if (!isSolved(def, slots)) {
    const c = await counts(kv, postId);
    return {
      ...base,
      ok: false,
      message: 'That shadow does not match yet.',
      moves,
      gold: false,
      streak: profile.streak,
      newCards: [],
      sceneCards: [],
      cards: profile.cards,
      rank: rankFor(Object.keys(profile.cards).length),
      ...c,
    };
  }
  const isWarmup = def.id === WARMUP.id;
  const prior = isWarmup ? null : await solveOf(kv, postId, user);
  const hints = isWarmup ? 0 : await hintsUsed(kv, postId, user);
  const gold = moves <= def.par && hints === 0;
  const newCards: string[] = [];
  if (!prior) {
    for (const id of def.cards) {
      const had = profile.cards[id];
      if (!had || (gold && had === 'card')) {
        profile.cards[id] = gold ? 'gold' : 'card';
        newCards.push(id);
      }
    }
    if (isWarmup) {
      profile.warmupDone = true;
    } else {
      if (profile.lastDay === info.day - 1) profile.streak += 1;
      else if (profile.lastDay !== info.day) profile.streak = 1;
      profile.lastDay = Math.max(profile.lastDay ?? info.day, info.day);
      profile.bestStreak = Math.max(profile.bestStreak, profile.streak);
      profile.solves += 1;
      const record: TodaySolve = { moves, par: def.par, gold, slots };
      await kv.hSet(k.solvers(postId), { [user]: JSON.stringify(record) });
    }
    await saveProfile(kv, user, profile);
  }
  const c = await counts(kv, postId);
  return {
    ...base,
    ok: true,
    moves: prior?.moves ?? moves,
    gold: prior?.gold ?? gold,
    streak: profile.streak,
    newCards,
    sceneCards: [...def.cards],
    cards: profile.cards,
    rank: rankFor(Object.keys(profile.cards).length),
    ...c,
  };
};

export const shareText = (
  def: PuzzleDef,
  day: number,
  s: TodaySolve,
  streak: number
): string => {
  const cards = def.cards.map((id) => figure(id).name).join(', ');
  const lines = [
    `**Dalang · ${dateLabel(day)} · ${def.title}**`,
    '',
    `Shadow matched 100% in ${s.moves} moves (par ${s.par})${s.gold ? ', gold card' : ''}.`,
    `Wayang kept: ${cards}${streak > 1 ? ` · ${streak}-day streak` : ''}`,
  ];
  return lines.join('\n');
};

export { puzzleById };
