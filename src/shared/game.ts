import {
  MAX_OIL,
  emptyProfile,
  rankFor,
  type BoardRow,
  type Tomorrow,
  type CardGrade,
  type Profile,
  type SolveResponse,
  type TodayResponse,
  type TodaySolve,
} from './api.ts';
import { WARMUP, puzzleById, puzzleForDay, BANK } from './bank.ts';
import {
  LEVELS,
  dateLabel,
  hintsFor,
  isSolved,
  toPublic,
  type PuzzleDef,
  type Slot,
} from './puzzle.ts';
import { isPose } from './shadow.ts';

/** The slice of Devvit's Redis client this game uses (an in-memory one backs the tests). */
export type KV = {
  get(key: string): Promise<string | undefined | null>;
  set(key: string, value: string): Promise<unknown>;
  hGet(key: string, field: string): Promise<string | undefined | null>;
  hSet(key: string, fields: Record<string, string>): Promise<unknown>;
  hLen(key: string): Promise<number>;
  zAdd(
    key: string,
    ...members: { member: string; score: number }[]
  ): Promise<unknown>;
  zRange(
    key: string,
    start: number,
    stop: number,
    options: { by: 'rank' }
  ): Promise<{ member: string; score: number }[]>;
  zRank(key: string, member: string): Promise<number | undefined>;
};

/** which puzzle a post shows: a bank day, or a player-made shadow (`ugc`) */
export type PostInfo = { day: number; index: number; ugc?: string };

const k = {
  ugc: (id: string) => `ugc:${id}`,
  ugcWeek: (week: number) => `ugcweek:${week}`,
  post: (postId: string) => `post:${postId}`,
  profile: (user: string) => `profile:${user}`,
  players: (postId: string) => `players:${postId}`,
  solvers: (postId: string) => `solvers:${postId}`,
  hints: (postId: string) => `hints:${postId}`,
  board: (postId: string) => `board:${postId}`,
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
        return typeof v.ugc === 'string'
          ? { day: v.day, index: v.index, ugc: v.ugc }
          : { day: v.day, index: v.index };
    } catch {
      /* fall through */
    }
  }
  return { day: today, index: BANK.puzzles.indexOf(puzzleForDay(today)) };
};

export const puzzleOfPost = (info: PostInfo): PuzzleDef =>
  BANK.puzzles[info.index] ?? puzzleForDay(info.day);

/** a player-made shadow, kept by its id */
export type UgcPuzzle = PuzzleDef & { author: string; created: number };

export const isUgc = (def: PuzzleDef): boolean => def.id.startsWith('u-');

export const saveUgc = (kv: KV, p: UgcPuzzle) =>
  kv.set(k.ugc(p.id), JSON.stringify(p));

export const loadUgc = async (
  kv: KV,
  id: string
): Promise<UgcPuzzle | null> => {
  const raw = await kv.get(k.ugc(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UgcPuzzle;
  } catch {
    return null;
  }
};

/** the puzzle a post shows (bank or player-made) */
export const loadPuzzle = async (kv: KV, info: PostInfo): Promise<PuzzleDef> =>
  (info.ugc ? await loadUgc(kv, info.ugc) : null) ?? puzzleOfPost(info);

/** player-made shadows posted in a week, by post id, for Sunday's pick */
export const addUgcPost = (kv: KV, week: number, postId: string) =>
  kv.zAdd(k.ugcWeek(week), { member: postId, score: Date.now() });

export const ugcPostsOfWeek = async (kv: KV, week: number) =>
  (await kv.zRange(k.ugcWeek(week), 0, -1, { by: 'rank' })).map(
    (m) => m.member
  );

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

/** Checks a claimed answer against the puzzle (never trusts the post). */
export const validSlots = (def: PuzzleDef, slots: unknown): slots is Slot[] =>
  Array.isArray(slots) &&
  slots.length === def.offered.length &&
  slots.every((s) => s === null || isPose(s));

/** a lakon is complete when every pusaka of its week is in the book */
export const completedSets = (cards: Record<string, CardGrade>): string[] => {
  const lakons = [...new Set(BANK.puzzles.map((p) => p.lakon))];
  return lakons.filter((l) =>
    BANK.puzzles
      .filter((p) => p.lakon === l)
      .every((p) => p.cards.every((c) => cards[c]))
  );
};

export const flairText = (cards: Record<string, CardGrade>): string => {
  const n = Object.keys(cards).length;
  const sets = completedSets(cards).length;
  return `${rankFor(n)} · ${n} pusaka${sets > 0 ? ` · ${sets} gunungan` : ''}`;
};

/** fewest moves first, then whoever solved first */
const boardScore = (moves: number, order: number) => moves * 100_000 + order;

export const board = async (
  kv: KV,
  postId: string,
  user: string | null
): Promise<{ board: BoardRow[]; myRank: number | null }> => {
  const top = await kv.zRange(k.board(postId), 0, 4, { by: 'rank' });
  const rows: BoardRow[] = [];
  for (const t of top) {
    const s = await solveOf(kv, postId, t.member);
    rows.push({
      name: t.member,
      moves: Math.floor(t.score / 100_000),
      gold: !!s?.gold,
    });
  }
  const r = user ? await kv.zRank(k.board(postId), user) : undefined;
  return {
    board: rows,
    myRank: r === undefined || r === null ? null : r + 1,
  };
};

const recordOnBoard = async (
  kv: KV,
  postId: string,
  user: string,
  record: TodaySolve
) => {
  await kv.hSet(k.solvers(postId), { [user]: JSON.stringify(record) });
  const order = await kv.hLen(k.solvers(postId));
  await kv.zAdd(k.board(postId), {
    member: user,
    score: boardScore(record.moves, order),
  });
};

/** tomorrow's newcomer, as a silhouette to wonder about */
export const tomorrowOf = (info: PostInfo): Tomorrow => {
  const today = info.ugc ? puzzleForDay(info.day) : puzzleOfPost(info);
  const at = Math.max(0, BANK.puzzles.indexOf(today));
  const next = BANK.puzzles[(at + 1) % BANK.puzzles.length]!;
  return {
    figure: next.cast.find((c) => !today.cast.includes(c)) ?? next.cast[0]!,
    lakon: next.lakon,
    level: LEVELS[next.weekday]!,
  };
};

/** a share-card trail: one value 0..3 per move, at most 60 */
export const cleanTrail = (t: unknown): number[] =>
  Array.isArray(t)
    ? t
        .slice(0, 60)
        .filter((v): v is number => Number.isInteger(v) && v >= 0 && v <= 3)
    : [];

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
    trail?: number[] | undefined;
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
      tale: null,
      oil: profile.oil,
      oilUsed: 0,
      board: [],
      myRank: null,
      met: profile.met,
      read: profile.read,
      ...c,
    };
  }
  const isWarmup = def.id === WARMUP.id;
  const prior = isWarmup ? null : await solveOf(kv, postId, user);
  const hints = isWarmup ? 0 : await hintsUsed(kv, postId, user);
  const gold = moves <= def.par && hints === 0;
  const newCards: string[] = [];
  let oilUsed = 0;
  if (!prior) {
    for (const id of def.cards) {
      const had = profile.cards[id];
      if (!had || (gold && had === 'card')) {
        profile.cards[id] = gold ? 'gold' : 'card';
        newCards.push(id);
      }
    }
    // the book: who you met, which chapters you can read
    for (const id of def.cast) profile.met[id] = true;
    if (def.tale && !profile.read.includes(def.id)) profile.read.push(def.id);
    if (isWarmup) {
      profile.warmupDone = true;
    } else if (isUgc(def)) {
      // a player-made shadow: on its board, but no cards, streak or oil
      await recordOnBoard(kv, postId, user, {
        moves,
        par: def.par,
        gold,
        slots,
        trail: cleanTrail(args.trail),
        hints,
      });
    } else {
      const last = profile.lastDay;
      const missed = last === null ? 0 : info.day - last - 1;
      if (last === null) profile.streak = 1;
      else if (missed === 0) profile.streak += 1;
      else if (missed > 0 && missed <= MAX_OIL && profile.oil >= missed) {
        // the lamp burned through the nights you missed
        profile.oil -= missed;
        oilUsed = missed;
        profile.streak += 1;
      } else if (missed > 0) profile.streak = 1;
      // missed < 0: an older post, or today's again; the streak stands
      if (gold) profile.oil = Math.min(MAX_OIL, profile.oil + 1);
      profile.lastDay = Math.max(last ?? info.day, info.day);
      profile.bestStreak = Math.max(profile.bestStreak, profile.streak);
      profile.solves += 1;
      await recordOnBoard(kv, postId, user, {
        moves,
        par: def.par,
        gold,
        slots,
        trail: cleanTrail(args.trail),
        hints,
      });
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
    tale: def.tale || null,
    oil: profile.oil,
    oilUsed,
    met: profile.met,
    read: profile.read,
    ...(isWarmup ? { board: [], myRank: null } : await board(kv, postId, user)),
    ...c,
  };
};

export { shareText } from './share.ts';

/** Everything the post needs when it opens (the server and local play share this). */
export const todayFor = async (
  kv: KV,
  a: {
    postId: string;
    user: string | null;
    info: PostInfo;
    peek: boolean;
    subredditName: string | null;
  }
): Promise<TodayResponse> => {
  const { postId, user, info } = a;
  const def = await loadPuzzle(kv, info);
  if (user && !a.peek) await markPlayer(kv, postId, user);
  const [profile, solved, hints, n, b] = await Promise.all([
    user ? loadProfile(kv, user) : Promise.resolve(emptyProfile()),
    user ? solveOf(kv, postId, user) : Promise.resolve(null),
    user ? shownHints(kv, postId, user, def) : Promise.resolve([]),
    counts(kv, postId),
    board(kv, postId, user),
  ]);
  const ugc = info.ugc ? await loadUgc(kv, info.ugc) : null;
  return {
    type: 'today',
    username: user,
    postId,
    day: info.day,
    dateLabel: dateLabel(info.day),
    puzzle: toPublic(def),
    warmup: toPublic(WARMUP),
    profile,
    solved,
    sceneCards: solved ? [...def.cards] : [],
    hints,
    players: n.players,
    solvers: n.solvers,
    subredditName: a.subredditName,
    tale: solved ? def.tale || null : null,
    tomorrow: tomorrowOf(info),
    board: b.board,
    myRank: b.myRank,
    author: ugc?.author ?? null,
  };
};

export { puzzleById };
