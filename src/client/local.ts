import type {
  HintResponse,
  ShareResponse,
  SolveRequest,
  SolveResponse,
  TodayResponse,
} from '../shared/api.ts';
import { WARMUP, BANK } from '../shared/bank.ts';
import {
  counts,
  loadProfile,
  markPlayer,
  puzzleOfPost,
  recordSolve,
  revealHint,
  savePostInfo,
  shareText,
  shownHints,
  solveOf,
  type PostInfo,
} from '../shared/game.ts';
import { memoryKV } from '../shared/memkv.ts';
import { dateLabel, dayNumber, toPublic } from '../shared/puzzle.ts';

/** The server's logic running in the page, for local play only. */
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
await savePostInfo(kv, POST, info);
// a few pretend players so the counts look alive
for (let k = 0; k < 9; k++) await markPlayer(kv, POST, `p${k}`);
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

export const local = {
  today: async (): Promise<TodayResponse> => {
    const def = puzzleOfPost(info);
    await markPlayer(kv, POST, USER);
    const n = await counts(kv, POST);
    return {
      type: 'today',
      username: USER,
      postId: POST,
      day: info.day,
      dateLabel: dateLabel(info.day),
      puzzle: toPublic(def),
      warmup: toPublic(WARMUP),
      profile: await loadProfile(kv, USER),
      solved: await solveOf(kv, POST, USER),
      sceneCards: (await solveOf(kv, POST, USER)) ? [...def.cards] : [],
      hints: await shownHints(kv, POST, USER, def),
      players: n.players,
      solvers: n.solvers,
      subredditName: 'dalang_daily',
    };
  },
  hint: async (): Promise<HintResponse> => ({
    type: 'hint',
    hints: await revealHint(kv, POST, USER, puzzleOfPost(info)),
  }),
  solve: async (req: SolveRequest): Promise<SolveResponse> => {
    const def = req.puzzleId === WARMUP.id ? WARMUP : puzzleOfPost(info);
    return recordSolve(kv, {
      postId: POST,
      user: USER,
      info,
      def,
      slots: req.slots,
      moves: req.moves,
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
      ok: true,
      message: 'Result posted in the comments',
      text: shareText(puzzleOfPost(info), info.day, s, p.streak),
    };
  },
};
