import { Hono } from 'hono';
import { context, reddit, redis } from '@devvit/web/server';
import type {
  ErrorResponse,
  HintResponse,
  ShareResponse,
  SolveRequest,
  SolveResponse,
  TodayResponse,
} from '../../shared/api.ts';
import { emptyProfile } from '../../shared/api.ts';
import { WARMUP } from '../../shared/bank.ts';
import { dateLabel, dayNumber, toPublic } from '../../shared/puzzle.ts';
import {
  counts,
  flairText,
  loadProfile,
  markPlayer,
  postInfo,
  puzzleById,
  puzzleOfPost,
  recordSolve,
  revealHint,
  shareText,
  shownHints,
  solveOf,
  validSlots,
  type KV,
} from '../../shared/game.ts';
import { memoryKV } from '../../shared/memkv.ts';

export const api = new Hono();

const kv: KV = redis;

const fail = (message: string): ErrorResponse => ({ status: 'error', message });

api.get('/today', async (c) => {
  const { postId } = context;
  if (!postId) return c.json(fail('postId missing'), 400);
  try {
    const [username, info] = await Promise.all([
      reddit.getCurrentUsername(),
      postInfo(kv, postId, dayNumber(Date.now())),
    ]);
    const def = puzzleOfPost(info);
    if (username && !c.req.query('peek'))
      await markPlayer(kv, postId, username);
    const [profile, solved, hints, n] = await Promise.all([
      username ? loadProfile(kv, username) : Promise.resolve(emptyProfile()),
      username ? solveOf(kv, postId, username) : Promise.resolve(null),
      username ? shownHints(kv, postId, username, def) : Promise.resolve([]),
      counts(kv, postId),
    ]);
    return c.json<TodayResponse>({
      type: 'today',
      username: username ?? null,
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
      subredditName: context.subredditName ?? null,
    });
  } catch (error) {
    console.error('today failed', error);
    return c.json(fail("Could not load today's shadow"), 500);
  }
});

api.post('/hint', async (c) => {
  const { postId } = context;
  if (!postId) return c.json(fail('postId missing'), 400);
  const username = await reddit.getCurrentUsername();
  const info = await postInfo(kv, postId, dayNumber(Date.now()));
  const def = puzzleOfPost(info);
  if (!username) return c.json<HintResponse>({ type: 'hint', hints: [] });
  return c.json<HintResponse>({
    type: 'hint',
    hints: await revealHint(kv, postId, username, def),
  });
});

api.post('/solve', async (c) => {
  const { postId, subredditName } = context;
  if (!postId) return c.json(fail('postId missing'), 400);
  const body = await c.req.json<SolveRequest>();
  const info = await postInfo(kv, postId, dayNumber(Date.now()));
  const def = body.puzzleId === WARMUP.id ? WARMUP : puzzleOfPost(info);
  if (puzzleById(body.puzzleId)?.id !== def.id)
    return c.json(fail('This post shows a different puzzle'), 400);
  if (!validSlots(def, body.slots))
    return c.json(fail('Bad answer format'), 400);
  const username = await reddit.getCurrentUsername();
  // logged-out players still see their result, nothing is kept
  const store = username ? kv : memoryKV();
  const res = await recordSolve(store, {
    postId,
    user: username ?? 'guest',
    info,
    def,
    slots: body.slots,
    moves: body.moves,
  });
  if (res.ok && username && subredditName && res.newCards.length > 0) {
    try {
      await reddit.setUserFlair({
        subredditName,
        username,
        text: flairText(res.cards),
        backgroundColor: '#7a1f1f',
        textColor: 'light',
      });
    } catch (error) {
      console.warn('flair not set', error);
    }
  }
  return c.json<SolveResponse>(res);
});

api.post('/share', async (c) => {
  const { postId } = context;
  if (!postId) return c.json(fail('postId missing'), 400);
  const username = await reddit.getCurrentUsername();
  const info = await postInfo(kv, postId, dayNumber(Date.now()));
  const def = puzzleOfPost(info);
  const solved = username ? await solveOf(kv, postId, username) : null;
  if (!username || !solved) {
    return c.json<ShareResponse>({
      type: 'share',
      ok: false,
      message: 'Solve the shadow first.',
      text: '',
    });
  }
  const profile = await loadProfile(kv, username);
  const text = shareText(def, info.day, solved, profile.streak);
  try {
    await reddit.submitComment({ id: postId, text, runAs: 'USER' });
    return c.json<ShareResponse>({
      type: 'share',
      ok: true,
      message: 'Result posted in the comments',
      text,
    });
  } catch (error) {
    console.error('comment failed', error);
    return c.json<ShareResponse>({
      type: 'share',
      ok: false,
      message: 'Could not comment. Result copied instead.',
      text,
    });
  }
});
