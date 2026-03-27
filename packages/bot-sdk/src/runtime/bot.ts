import { BotClient } from '../client/bot-client';
import { BotContext } from '../context/bot-context';
import type { CallbackQueryUpdate, MessageUpdate, Update } from '../types';

export type Middleware = (ctx: BotContext, next: () => Promise<void>) => Promise<void> | void;
export type Handler = (ctx: BotContext) => Promise<void> | void;

function isMessageUpdate(update: Update): update is MessageUpdate {
  return update.eventType === 'message';
}

function isCallbackQueryUpdate(update: Update): update is CallbackQueryUpdate {
  return update.eventType === 'callback_query';
}

/**
 * Telegram-like runtime for Orisign bots.
 */
export class BotRuntime {
  private readonly middlewares: Middleware[] = [];
  private readonly messageHandlers: Handler[] = [];
  private readonly callbackHandlers: Array<{ predicate: (ctx: BotContext) => boolean; handler: Handler }> = [];
  private readonly commandHandlers = new Map<string, Handler>();
  private polling = false;
  private updateOffset = 0;

  public constructor(public readonly client: BotClient) {}

  /**
   * Registers a middleware that wraps every handled update.
   */
  public use(middleware: Middleware) {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Registers a slash-command handler, for example `/start`.
   */
  public command(command: string, handler: Handler) {
    this.commandHandlers.set(command.replace(/^\//, ''), handler);
    return this;
  }

  /**
   * Registers a broad update handler by event kind.
   */
  public on(event: 'message' | 'callback_query', handler: Handler) {
    if (event === 'message') {
      this.messageHandlers.push(handler);
    }
    if (event === 'callback_query') {
      this.callbackHandlers.push({ predicate: () => true, handler });
    }
    return this;
  }

  /**
   * Registers a callback handler for a specific callback-data prefix.
   */
  public onAction(action: string, handler: Handler) {
    this.callbackHandlers.push({
      predicate: (ctx) => ctx.callbackQuery?.data?.startsWith(action) ?? false,
      handler,
    });
    return this;
  }

  /**
   * Handles a single update from polling or webhook delivery.
   */
  public async handleUpdate(update: Update) {
    const ctx = new BotContext(update, this.client);
    const chain = [...this.middlewares];
    let index = -1;

    const run = async (cursor: number): Promise<void> => {
      if (cursor <= index) {
        return;
      }
      index = cursor;

      const middleware = chain[cursor];
      if (middleware) {
        await middleware(ctx, () => run(cursor + 1));
        return;
      }

      if (isMessageUpdate(update)) {
        const text = ctx.message?.text?.trim() ?? '';
        if (text.startsWith('/')) {
          const command = text.slice(1).split(/\s+/)[0];
          const commandHandler = this.commandHandlers.get(command);
          if (commandHandler) {
            await commandHandler(ctx);
            return;
          }
        }
        for (const handler of this.messageHandlers) {
          await handler(ctx);
        }
      }

      if (isCallbackQueryUpdate(update)) {
        for (const candidate of this.callbackHandlers) {
          if (candidate.predicate(ctx)) {
            await candidate.handler(ctx);
          }
        }
      }
    };

    await run(0);
  }

  /**
   * Starts a long-polling loop and dispatches updates sequentially.
   */
  public async startPolling(options: { offset?: number; limit?: number; timeout?: number } = {}) {
    this.polling = true;
    this.updateOffset = options.offset ?? 0;
    while (this.polling) {
      const response = await this.client.getUpdates({
        offset: this.updateOffset,
        limit: options.limit ?? 30,
        timeout: options.timeout ?? 20,
      });
      for (const update of response.updates ?? []) {
        await this.handleUpdate(update);
        this.updateOffset = update.updateId + 1;
      }
    }
  }

  /**
   * Stops the active polling loop.
   */
  public stopPolling() {
    this.polling = false;
  }

  /**
   * Returns a framework-agnostic async webhook handler.
   */
  public createWebhookHandler() {
    return async (rawUpdate: Update) => {
      await this.handleUpdate(rawUpdate);
      return { ok: true };
    };
  }
}
