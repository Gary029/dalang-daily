import type {
  CreateResponse,
  HintResponse,
  ShareResponse,
  SolveRequest,
  SolveResponse,
  TodayResponse,
} from '../shared/api.ts';
import { WARMUP, BANK } from '../shared/bank.ts';
import {
  loadProfile,
  loadPuzzle,
  markPlayer,
  recordSolve,
  revealHint,
  savePostInfo,
  saveUgc,
  shareText,
  solveOf,
  todayFor,
  type PostInfo,
  type UgcPuzzle,
} from '../shared/game.ts';
import { memoryKV } from '../shared/memkv.ts';
import { dayNumber } from '../shared/puzzle.ts';
import {
  checkShadow,
  newUgcId,
  toUgc,
  type CreateRequest,
} from '../shared/ugc.ts';

/**
 * The server's logic running in the page, for local play only.
 * ?day=N picks a day, ?warm=done skips the warm-up, ?user= names you,
 * ?ugc=<id> plays a shadow you made in this browser, ?album=all gives you
 * every card (to try the builder).
 */
const kv = memoryKV();
const params = new URLSearchParams(location.search);
const USER = params.get('user') ?? 'local_player';
const POST = 't3_local';
const day = params.has('day')
  ? Number(params.get('day'))
  : dayNumber(Date.now());
const info: PostInfo = {
  day,
  index:
    ((day % BANK.puzzles.length) + BANK.puzzles.length) % BANK.puzzles.length,
};
const UGC_KEY = 'dalang:ugc:';
const ugcId = params.get('ugc');
if (ugcId) {
  try {
    const raw = localStorage.getItem(UGC_KEY + ugcId);
    if (raw) {
      await saveUgc(kv, JSON.parse(raw) as UgcPuzzle);
      info.ugc = ugcId;
    }
  } catch {
    /* storage blocked: play the day's puzzle */
  }
}
await savePostInfo(kv, POST, info);

// a few pretend players so the counts and the board look alive
const def0 = await loadPuzzle(kv, info);
const PRETEND = ['wayang_fan', 'blencong', 'kelir_kid', 'gamelan_gran'];
for (let k = 0; k < 9; k++) await markPlayer(kv, POST, `p${k}`);
for (const [k, name] of PRETEND.entries()) {
  await markPlayer(kv, POST, name);
  if (k === 3 || ugcId) continue;
  await recordSolve(kv, {
    postId: POST,
    user: name,
    info,
    def: def0,
    slots: def0.solution,
    moves: def0.par + [0, 2, 5][k]!,
    trail: [0, 1, 1, 2, 2, 3],
  });
}
if (params.get('warm') === 'done') {
  await recordSolve(kv, {
    postId: 't3_w',
    user: USER,
    info,
    def: WARMUP,
    slots: WARMUP.solution,
    moves: WARMUP.par,
  });
}
if (params.get('album') === 'all') {
  const p = await loadProfile(kv, USER);
  for (const q of BANK.puzzles) {
    for (const c of q.cards) p.cards[c] = 'card';
    for (const id of q.cast) p.met[id] = true;
    if (!p.read.includes(q.id)) p.read.push(q.id);
  }
  p.warmupDone = true;
  await kv.set(`profile:${USER}`, JSON.stringify(p));
}

export const local = {
  today: async (): Promise<TodayResponse> =>
    todayFor(kv, {
      postId: POST,
      user: USER,
      info,
      peek: false,
      subredditName: 'dalang_daily',
    }),
  hint: async (): Promise<HintResponse> => ({
    type: 'hint',
    hints: await revealHint(kv, POST, USER, await loadPuzzle(kv, info)),
  }),
  solve: async (req: SolveRequest): Promise<SolveResponse> => {
    const def =
      req.puzzleId === WARMUP.id ? WARMUP : await loadPuzzle(kv, info);
    return recordSolve(kv, {
      postId: POST,
      user: USER,
      info,
      def,
      slots: req.slots,
      moves: req.moves,
      trail: req.trail,
    });
  },
  share: async (): Promise<ShareResponse> => {
    const s = await solveOf(kv, POST, USER);
    if (!s)
      return {
        type: 'share',
        ok: false,
        message: 'Solve the shadow first.',
        text: '',
      };
    const p = await loadProfile(kv, USER);
    return {
      type: 'share',
      ok: false,
      message: 'Local play: result copied',
      text: shareText(await loadPuzzle(kv, info), info.day, s, p.streak),
    };
  },
  create: async (req: CreateRequest): Promise<CreateResponse> => {
    const p = await loadProfile(kv, USER);
    const check = checkShadow(req, Object.keys(p.met));
    if (!check.ok) return { type: 'create', ok: false, message: check.message };
    const def = toUgc(req, check, USER, newUgcId());
    try {
      localStorage.setItem(UGC_KEY + def.id, JSON.stringify(def));
    } catch {
      return {
        type: 'create',
        ok: false,
        message: 'Local play needs browser storage to keep your shadow.',
      };
    }
    const url = new URL(location.href);
    url.searchParams.set('ugc', def.id);
    url.searchParams.set('user', 'friend');
    url.searchParams.set('warm', 'done');
    return {
      type: 'create',
      ok: true,
      message: 'Shadow saved. Opening it as a friend would see it.',
      url: url.toString(),
    };
  },
};
