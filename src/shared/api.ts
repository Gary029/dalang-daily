import type { PuzzlePublic, Slot } from './puzzle.ts';

export type CardGrade = 'card' | 'gold';

export type Profile = {
  streak: number;
  bestStreak: number;
  lastDay: number | null;
  cards: Record<string, CardGrade>;
  warmupDone: boolean;
  solves: number;
  /** lamp oil: earned with gold, burned to keep a streak across missed days */
  oil: number;
  /** wayang met in a solved scene (for the book) */
  met: Record<string, true>;
  /** puzzle ids whose story chapter is unlocked (for the book) */
  read: string[];
};

export const MAX_OIL = 3;

/** one row of a post's leaderboard */
export type BoardRow = { name: string; moves: number; gold: boolean };

/** what the feed card and result card show about tomorrow, without spoiling it */
export type Tomorrow = { figure: string; lakon: string; level: string };

export type TodaySolve = {
  moves: number;
  par: number;
  gold: boolean;
  slots: Slot[];
  /** how close each move came (0..3), for the spoiler-free share card */
  trail?: number[];
  hints?: number;
};

export type TodayResponse = {
  type: 'today';
  username: string | null;
  postId: string;
  day: number;
  dateLabel: string;
  puzzle: PuzzlePublic;
  warmup: PuzzlePublic;
  profile: Profile;
  solved: TodaySolve | null;
  /** the scene's wayang, only once this player has solved it */
  sceneCards: string[];
  hints: string[];
  players: number;
  solvers: number;
  subredditName: string | null;
  /** the story chapter, once solved */
  tale: string | null;
  tomorrow: Tomorrow;
  board: BoardRow[];
  myRank: number | null;
  /** who made this shadow, on a player-made post */
  author: string | null;
};

export type HintResponse = { type: 'hint'; hints: string[] };

export type SolveRequest = {
  puzzleId: string;
  slots: Slot[];
  moves: number;
  trail?: number[];
};

export type SolveResponse = {
  type: 'solve';
  ok: boolean;
  message?: string;
  moves: number;
  par: number;
  gold: boolean;
  streak: number;
  newCards: string[];
  /** the wayang this scene gives (sent only after the shadow is matched) */
  sceneCards: string[];
  cards: Record<string, CardGrade>;
  players: number;
  solvers: number;
  rank: string;
  tale: string | null;
  oil: number;
  /** oil burned by this solve to save the streak */
  oilUsed: number;
  board: BoardRow[];
  myRank: number | null;
  /** the book after this solve */
  met: Record<string, true>;
  read: string[];
};

export type ShareResponse = {
  type: 'share';
  ok: boolean;
  message: string;
  text: string;
};

export type CreateResponse = {
  type: 'create';
  ok: boolean;
  message: string;
  /** the new post, to open it */
  url?: string;
};

export type ErrorResponse = { status: 'error'; message: string };

// --- ranks, shared so the post and the flair agree ------------------------------

export const RANKS = [
  { name: 'Penonton', min: 0, note: 'one who watches' },
  { name: 'Dalang Muda', min: 3, note: 'young puppeteer' },
  { name: 'Dalang Agung', min: 10, note: 'great puppeteer' },
] as const;

export const rankFor = (cards: number): string => {
  let r: string = RANKS[0].name;
  for (const k of RANKS) if (cards >= k.min) r = k.name;
  return r;
};

export const emptyProfile = (): Profile => ({
  streak: 0,
  bestStreak: 0,
  lastDay: null,
  cards: {},
  warmupDone: false,
  solves: 0,
  oil: 0,
  met: {},
  read: [],
});
