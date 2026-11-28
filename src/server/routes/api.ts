import { Hono } from 'hono';
import { context, reddit, redis } from '@devvit/web/server';
import type {
  CreateResponse,
  ErrorResponse,
  HintResponse,
  ShareResponse,
  SolveRequest,
  SolveResponse,
  TodayResponse,
} from '../../shared/api.ts';
import { WARMUP } from '../../shared/bank.ts';
import { dayNumber } from '../../shared/puzzle.ts';
import {
  addUgcPost,
  flairText,
  loadProfile,
  loadPuzzle,
  postInfo,
  recordSolve,
  revealHint,
  saveUgc,
  shareText,
  solveOf,
  todayFor,
  validSlots,
  type KV,
} from '../../shared/game.ts';
import { memoryKV } from '../../shared/memkv.ts';
import {
  checkShadow,
  newUgcId,
  toUgc,
  type CreateRequest,
} from '../../shared/ugc.ts';
import { createUgcPost } from '../core/post.ts';

export const api = new Hono();

const kv: KV = redis;

const fail = (message: string): ErrorResponse => ({ status: 'error', message });

const today = () => dayNumber(Date.now());

api.get('/today', async (c) => {
  const { postId } = context;
  if (!postId) return c.json(fail('postId missing'), 400);
  try {
    const [username, info] = await Promise.all([
      reddit.getCurrentUsername(),
      postInfo(kv, postId, today()),
    ]);
    return c.json<TodayResponse>(
      await todayFor(kv, {
        postId,
        user: username ?? null,
        info,
        peek: !!c.req.query('peek'),
        subredditName: context.subredditName ?? null,
      })
    );
  } catch (error) {
    console.error('today failed', error);
    return c.json(fail("Could not load today's shadow"), 500);
  }
});

api.post('/hint', async (c) => {
  const { postId } = context;
  if (!postId) return c.json(fail('postId missing'), 400);
  const username = await reddit.getCurrentUsername();
  const def = await loadPuzzle(kv, await postInfo(kv, postId, today()));
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
  const info = await postInfo(kv, postId, today());
  const def = body.puzzleId === WARMUP.id ? WARMUP : await loadPuzzle(kv, info);
  if (body.puzzleId !== def.id)
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
    trail: body.trail,
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
  const info = await postInfo(kv, postId, today());
  const def = await loadPuzzle(kv, info);
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

/** One player-made shadow per player per day. */
api.post('/create', async (c) => {
  const username = await reddit.getCurrentUsername();
  if (!username)
    return c.json<CreateResponse>({
      type: 'create',
      ok: false,
      message: 'Log in to post a shadow.',
    });
  const body = await c.req.json<CreateRequest>();
  const profile = await loadProfile(kv, username);
  const check = checkShadow(body, Object.keys(profile.met));
  if (!check.ok)
    return c.json<CreateResponse>({
      type: 'create',
      ok: false,
      message: check.message,
    });
  const day = today();
  const madeKey = `made:${username}:${day}`;
  if (await kv.get(madeKey))
    return c.json<CreateResponse>({
      type: 'create',
      ok: false,
      message: 'You already posted a shadow today. Come back tomorrow.',
    });
  try {
    const def = toUgc(body, check, username, newUgcId());
    await saveUgc(kv, def);
    const post = await createUgcPost(def);
    await addUgcPost(kv, Math.floor(day / 7), post.id);
    await kv.set(madeKey, post.id);
    return c.json<CreateResponse>({
      type: 'create',
      ok: true,
      message: 'Your shadow is posted. The best one this week plays on Sunday.',
      url: post.url,
    });
  } catch (error) {
    console.error('create failed', error);
    return c.json<CreateResponse>({
      type: 'create',
      ok: false,
      message: 'Could not post your shadow.',
    });
  }
});
