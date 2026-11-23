import { Hono } from 'hono';
import { dayNumber } from '../../shared/puzzle.ts';
import { createDalangPost, postCommunityPick } from '../core/post.ts';

export const scheduler = new Hono();

/**
 * Runs at 00:00 UTC (07:00 WIB) from devvit.json: one new shadow a day, and
 * on Sunday the week's most upvoted player-made shadow as well.
 */
scheduler.post('/daily-post', async (c) => {
  try {
    const post = await createDalangPost();
    console.log(`daily post ${post.id}`);
    // day 0 is a Monday, so day % 7 === 6 is Sunday
    if (dayNumber(Date.now()) % 7 === 6) {
      try {
        const pick = await postCommunityPick();
        console.log(`community pick ${pick?.id ?? 'none'}`);
      } catch (error) {
        console.error(`community pick failed: ${error}`);
      }
    }
    return c.json({ status: 'ok', postId: post.id }, 200);
  } catch (error) {
    console.error(`daily post failed: ${error}`);
    return c.json({ status: 'error' }, 500);
  }
});
