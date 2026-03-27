/**
 * Supported keyboard markup variants for Orisign bots.
 */
export type ReplyMarkup =
  | { type: 'inline_keyboard'; inlineKeyboard: Array<Array<InlineKeyboardButton>> }
  | { type: 'reply_keyboard'; keyboard: Array<Array<KeyboardButton>>; resizeKeyboard?: boolean; oneTimeKeyboard?: boolean }
  | { type: 'remove_keyboard' }
  | { type: 'force_reply' };

/**
 * Inline keyboard button definition.
 */
export type InlineKeyboardButton = {
  text: string;
  callbackData?: string;
  url?: string;
};

/**
 * Reply keyboard button definition.
 */
export type KeyboardButton = {
  text: string;
  requestContact?: boolean;
  requestLocation?: boolean;
};

/**
 * Messenger user projection exposed to bot developers.
 */
export type User = {
  id: string;
  username?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  isVerified?: boolean;
  isBot?: boolean;
  locale?: string;
  timezone?: string;
};

/**
 * Messenger chat projection exposed to bot developers.
 */
export type Chat = {
  id: string;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  avatarUrl?: string;
};

/**
 * Bot attachment payload.
 */
export type Attachment = {
  type: string;
  fileId?: string;
  mimeType?: string;
  size?: number;
};

export type MessageEntity = {
  type: string;
  offset: number;
  length: number;
  url?: string;
  userId?: string;
  language?: string;
};

/**
 * Message object delivered to a bot.
 */
export type Message = {
  id: string;
  chat: Chat;
  from?: User;
  date?: number;
  text?: string;
  caption?: string;
  entities?: MessageEntity[];
  attachments?: Attachment[];
  replyMarkup?: ReplyMarkup;
};

/**
 * Callback query object delivered to a bot.
 */
export type CallbackQuery = {
  id: string;
  from: User;
  message: Message;
  data?: string;
};

export type MessageUpdate = {
  updateId: number;
  eventType: 'message';
  payload: Message;
  eventTs?: number;
  deliveryAttempt?: number;
  traceId?: string;
};

export type CallbackQueryUpdate = {
  updateId: number;
  eventType: 'callback_query';
  payload: CallbackQuery;
  eventTs?: number;
  deliveryAttempt?: number;
  traceId?: string;
};

export type GenericUpdate = {
  updateId: number;
  eventType: string;
  payload: Record<string, unknown>;
  eventTs?: number;
  deliveryAttempt?: number;
  traceId?: string;
};

/**
 * Bot update envelope returned by polling/webhook delivery.
 */
export type Update = MessageUpdate | CallbackQueryUpdate | GenericUpdate;

export type MutationResponse = {
  ok: boolean;
};

export type BotProfile = {
  id: string;
  ownerUserId?: string;
  botUserId?: string;
  status?: string;
  profile?: {
    displayName?: string;
    username?: string;
    description?: string;
    about?: string;
    shortDescription?: string;
    avatarFileId?: string;
    avatarUrl?: string;
    localeDefault?: string;
  };
};

export type GetBotMeResponse = {
  bot?: BotProfile;
};

export type SendMessageResponse = {
  ok: boolean;
  messageId?: string;
  conversationId?: string;
};

export type GetUpdatesResponse = {
  updates: Update[];
};

export type SendMessagePayload = {
  chatId: string;
  text: string;
  replyMarkup?: ReplyMarkup;
  replyToMessageId?: string;
  mediaKeys?: string[];
};

export type AnswerCallbackQueryPayload = {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
  url?: string;
  cacheTime?: number;
};
