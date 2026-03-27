import { BotApiError } from '../errors/bot-error';
import type {
  AnswerCallbackQueryPayload,
  GetBotMeResponse,
  GetUpdatesResponse,
  MutationResponse,
  ReplyMarkup,
  SendMessageResponse,
} from '../types';

type RequestOptions = {
  method?: 'GET' | 'POST';
  query?: Record<string, string | number | undefined>;
  body?: Record<string, unknown>;
};

type ApiFailure = {
  ok?: false;
  error_code?: string;
  description?: string;
  error?: {
    code?: string;
    message?: string;
  };
};

/**
 * Typed client for the Orisign developer Bot API.
 */
export class BotClient {
  public constructor(private readonly baseUrl: string, private readonly token: string) {}

  /**
   * Returns metadata for the currently authenticated bot.
   */
  public async me(): Promise<GetBotMeResponse> {
    return await this.request<GetBotMeResponse>('/bot/me', { method: 'GET' });
  }

  /**
   * Sends a text or media message to a chat on behalf of the bot.
   */
  public async sendMessage(payload: {
    chatId: string;
    text: string;
    replyMarkup?: ReplyMarkup;
    replyToMessageId?: string;
    mediaKeys?: string[];
  }): Promise<SendMessageResponse> {
    return await this.request<SendMessageResponse>('/bot/sendMessage', {
      body: {
        ...payload,
        replyMarkupJson: payload.replyMarkup ? JSON.stringify(payload.replyMarkup) : '',
      },
    });
  }

  /**
   * Updates the text and optional reply markup of a previously sent bot message.
   */
  public async editMessageText(payload: { chatId: string; messageId: string; text: string; replyMarkup?: ReplyMarkup }): Promise<MutationResponse> {
    return await this.request<MutationResponse>('/bot/editMessageText', {
      body: {
        ...payload,
        replyMarkupJson: payload.replyMarkup ? JSON.stringify(payload.replyMarkup) : '',
      },
    });
  }

  /**
   * Deletes a bot-authored message from a chat.
   */
  public async deleteMessage(payload: { chatId: string; messageId: string }): Promise<MutationResponse> {
    return await this.request<MutationResponse>('/bot/deleteMessage', { body: payload });
  }

  /**
   * Acknowledges an incoming callback query.
   */
  public async answerCallbackQuery(payload: AnswerCallbackQueryPayload): Promise<MutationResponse> {
    return await this.request<MutationResponse>('/bot/answerCallbackQuery', { body: payload });
  }

  /**
   * Pulls updates using long polling.
   */
  public async getUpdates(params: { offset?: number; limit?: number; timeout?: number; allowedUpdates?: string[] } = {}): Promise<GetUpdatesResponse> {
    const query: Record<string, string | number | undefined> = {
      offset: params.offset,
      limit: params.limit,
      timeout: params.timeout,
    };
    if (params.allowedUpdates && params.allowedUpdates.length > 0) {
      query.allowedUpdates = params.allowedUpdates.join(',');
    }
    return await this.request<GetUpdatesResponse>('/bot/getUpdates', { method: 'GET', query });
  }

  /**
   * Enables webhook delivery for the current bot.
   */
  public async setWebhook(payload: { url: string; allowedUpdates?: string[]; maxConnections?: number }): Promise<MutationResponse> {
    return await this.request<MutationResponse>('/bot/setWebhook', { body: payload });
  }

  /**
   * Disables webhook delivery for the current bot.
   */
  public async deleteWebhook(): Promise<MutationResponse> {
    return await this.request<MutationResponse>('/bot/deleteWebhook', { body: {} });
  }

  private async request<Result extends object>(path: string, options: RequestOptions): Promise<Result> {
    const url = new URL(path, this.baseUrl);
    Object.entries(options.query ?? {}).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      method: options.method ?? 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${this.token}`,
      },
      body: options.method === 'GET' ? undefined : JSON.stringify(options.body ?? {}),
    });

    const payload = (await response.json()) as Result | ApiFailure;
    if (!response.ok || ('ok' in payload && payload.ok === false)) {
      const failure = payload as ApiFailure;
      throw new BotApiError(
        failure.error_code ?? failure.error?.code ?? 'BOT_API_ERROR',
        failure.description ?? failure.error?.message ?? 'Bot API request failed',
        failure,
      );
    }
    return payload as Result;
  }
}
