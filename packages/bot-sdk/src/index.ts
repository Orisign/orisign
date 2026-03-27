import { BotClient } from './client/bot-client';
import { BotRuntime } from './runtime/bot';

export * from './client/bot-client';
export * from './context/bot-context';
export * from './errors/bot-error';
export * from './markup/markup';
export * from './runtime/bot';
export * from './types';

/**
 * Creates a fully configured bot runtime with the provided developer token.
 */
export function createBot(options: { token: string; baseUrl: string }) {
  const client = new BotClient(options.baseUrl, options.token);
  return new BotRuntime(client);
}
