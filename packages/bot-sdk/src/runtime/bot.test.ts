import { expect, test } from 'bun:test';
import type { BotClient } from '../client/bot-client';
import type { Update } from '../types';
import { BotRuntime } from './bot';

test('command handler is called for matching update', async () => {
  let called = false;
  const runtime = new BotRuntime({} as BotClient);

  runtime.command('/start', async () => {
    called = true;
  });

  const update: Update = {
    updateId: 1,
    eventType: 'message',
    payload: {
      id: 'm1',
      chat: { id: 'c1', type: 'private' },
      text: '/start',
    },
  };

  await runtime.handleUpdate(update);

  expect(called).toBe(true);
});
