import { Hono } from 'hono';
import { createDalangPost } from '../core/post.ts';

export const scheduler = new Hono();

/** Runs at 00:00 UTC (07:00 WIB) from devvit.json: one new shadow a day. */
scheduler.post('/daily-post', async (c) => {
  try {
    const post = await createDalangPost();
    console.log(`daily post ${post.id}`);
    return c.json({ status: 'ok', postId: post.id }, 200);
  } catch (error) {
    console.error(`daily post failed: ${error}`);
    return c.json({ status: 'error' }, 500);
  }
});
