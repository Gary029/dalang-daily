import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createDalangPost } from '../core/post.ts';

export const menu = new Hono();

const open = (id: string): UiResponse => ({
  navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${id}`,
});

menu.post('/post-today', async (c) => {
  try {
    return c.json<UiResponse>(open((await createDalangPost()).id), 200);
  } catch (error) {
    console.error(`post-today failed: ${error}`);
    return c.json<UiResponse>({ showToast: 'Could not create the post' }, 400);
  }
});

menu.post('/post-demo', async (c) => {
  try {
    return c.json<UiResponse>(
      open((await createDalangPost({ index: 0 })).id),
      200
    );
  } catch (error) {
    console.error(`post-demo failed: ${error}`);
    return c.json<UiResponse>({ showToast: 'Could not create the post' }, 400);
  }
});
