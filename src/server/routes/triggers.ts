import { Hono } from 'hono';
import type { TriggerResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createDalangPost } from '../core/post.ts';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  try {
    const post = await createDalangPost({ index: 0 });
    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `Demo post ${post.id} in r/${context.subredditName}`,
      },
      200
    );
  } catch (error) {
    console.error(`install post failed: ${error}`);
    return c.json<TriggerResponse>(
      { status: 'error', message: 'Failed to create post' },
      400
    );
  }
});
