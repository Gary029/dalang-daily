import { context, reddit, redis } from '@devvit/web/server';
import { BANK, puzzleForDay } from '../../shared/bank.ts';
import { dateLabel, dayNumber } from '../../shared/puzzle.ts';
import { savePostInfo } from '../../shared/game.ts';

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
  const subredditName = context.subredditName;
  if (!subredditName) throw new Error('no subreddit in context');
  const post = await reddit.submitCustomPost({
    subredditName,
    title,
    entry: 'default',
    textFallback: {
      text: `Today's shadow puzzle: ${def.title}. Open this post on new Reddit or the app to play.`,
    },
  });
  await savePostInfo(redis, post.id, { day, index });
  return post;
};
