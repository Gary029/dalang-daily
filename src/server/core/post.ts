import { context, reddit, redis } from '@devvit/web/server';
import { BANK, puzzleForDay } from '../../shared/bank.ts';
import { dateLabel, dayNumber } from '../../shared/puzzle.ts';
import {
  loadPuzzle,
  postInfo,
  savePostInfo,
  ugcPostsOfWeek,
  type UgcPuzzle,
} from '../../shared/game.ts';

const subreddit = () => {
  const name = context.subredditName;
  if (!name) throw new Error('no subreddit in context');
  return name;
};

/**
 * Creates a Dalang post. With no index, it shows today's puzzle from the
 * calendar; with an index (the demo post), that bank entry.
 */
export const createDalangPost = async (opts: { index?: number } = {}) => {
  const day = dayNumber(Date.now());
  const def =
    opts.index !== undefined ? BANK.puzzles[opts.index]! : puzzleForDay(day);
  const index = BANK.puzzles.indexOf(def);
  const demo = opts.index !== undefined;
  const title = demo
    ? `Dalang · Start here: ${def.title}`
    : `Dalang · ${dateLabel(day)} · ${def.title}`;
  const post = await reddit.submitCustomPost({
    subredditName: subreddit(),
    title,
    entry: 'default',
    textFallback: {
      text: `Today's shadow puzzle: ${def.title}. Open this post on new Reddit or the app to play.`,
    },
  });
  await savePostInfo(redis, post.id, { day, index });
  return post;
};

/** A player-made shadow, posted as the player when Reddit allows it. */
export const createUgcPost = async (
  def: UgcPuzzle,
  opts: { pick?: boolean } = {}
) => {
  const day = dayNumber(Date.now());
  const title = opts.pick
    ? `Dalang · Community shadow of the week: ${def.title} (by u/${def.author})`
    : `Dalang · Player shadow: ${def.title}`;
  const args = {
    subredditName: subreddit(),
    title,
    entry: 'default',
    textFallback: {
      text: `A shadow puzzle made by u/${def.author}. Open this post on new Reddit or the app to play.`,
    },
  };
  let post;
  try {
    post = await reddit.submitCustomPost(
      opts.pick ? args : { ...args, runAs: 'USER' as const }
    );
  } catch (error) {
    console.warn('posting as the player failed, posting as the app', error);
    post = await reddit.submitCustomPost(args);
  }
  await savePostInfo(redis, post.id, { day, index: -2, ugc: def.id });
  return post;
};

/**
 * On Sunday, the most upvoted player shadow of the past week gets its own
 * post. Returns null when nobody made one.
 */
export const postCommunityPick = async () => {
  const day = dayNumber(Date.now());
  const ids = await ugcPostsOfWeek(redis, Math.floor(day / 7));
  let best: { id: string; score: number } | null = null;
  for (const id of ids) {
    try {
      const p = await reddit.getPostById(id as `t3_${string}`);
      if (!best || p.score > best.score) best = { id, score: p.score };
    } catch {
      /* removed or deleted */
    }
  }
  if (!best) return null;
  const def = await loadPuzzle(redis, await postInfo(redis, best.id, day));
  if (!('author' in def)) return null;
  return createUgcPost(def as UgcPuzzle, { pick: true });
};
