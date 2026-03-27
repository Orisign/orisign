import { BotClient } from '../client/bot-client';
import type { CallbackQuery, Message, ReplyMarkup, SendMessageResponse, Update } from '../types';

/**
 * High-level handler context passed to runtime callbacks.
 */
export class BotContext {
  public constructor(
    public readonly update: Update,
    public readonly client: BotClient,
  ) {}

  public get message(): Message | undefined {
    return this.update.eventType === 'message' ? (this.update.payload as Message) : undefined;
  }

  public get callbackQuery(): CallbackQuery | undefined {
    return this.update.eventType === 'callback_query' ? (this.update.payload as CallbackQuery) : undefined;
  }

  /**
   * Replies into the current chat derived from a message or callback query.
   */
  public async reply(text: string, replyMarkup?: ReplyMarkup): Promise<SendMessageResponse> {
    const chatId =
      this.message?.chat.id ??
      this.callbackQuery?.message.chat.id;
    if (!chatId) {
      throw new Error('No chat id in current update');
    }
    return await this.client.sendMessage({ chatId, text, replyMarkup });
  }
}
