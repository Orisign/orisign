/**
 * Telegram-like reply markup primitives used by Photon bots in web UI.
 * The parser is intentionally tolerant to both camelCase and snake_case keys
 * because bot-service stores JSON payloads produced by multiple runtimes/SDKs.
 */

export interface ChatWebAppInfo {
  url: string;
  title?: string;
}

export interface ChatInlineKeyboardButton {
  text: string;
  callbackData?: string;
  url?: string;
  switchInlineQuery?: string;
  webApp?: ChatWebAppInfo;
}

export interface ChatKeyboardButton {
  text: string;
  requestContact?: boolean;
  requestLocation?: boolean;
}

export interface ChatInlineKeyboardMarkup {
  type: "inline_keyboard";
  inlineKeyboard: ChatInlineKeyboardButton[][];
}

export interface ChatReplyKeyboardMarkup {
  type: "reply_keyboard";
  keyboard: ChatKeyboardButton[][];
  resizeKeyboard: boolean;
  oneTimeKeyboard: boolean;
  selective: boolean;
  inputFieldPlaceholder?: string;
}

export interface ChatReplyKeyboardRemove {
  type: "remove_keyboard";
  selective: boolean;
}

export interface ChatForceReplyMarkup {
  type: "force_reply";
  selective: boolean;
  inputFieldPlaceholder?: string;
}

export type ChatReplyMarkup =
  | ChatInlineKeyboardMarkup
  | ChatReplyKeyboardMarkup
  | ChatReplyKeyboardRemove
  | ChatForceReplyMarkup;

export interface ChatReplyMarkupCarrier {
  id: string;
  text?: string;
  replyMarkup: ChatReplyMarkup | null;
}

export interface ActiveConversationInputMarkup<TMessage extends ChatReplyMarkupCarrier> {
  message: TMessage;
  markup: Exclude<ChatReplyMarkup, ChatInlineKeyboardMarkup>;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(record: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function getBoolean(record: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return false;
}

function getArray(record: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function parseWebApp(value: unknown): ChatWebAppInfo | undefined {
  if (typeof value === "string" && value.trim()) {
    return { url: value.trim() };
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const url = getString(value, "url");
  if (!url) {
    return undefined;
  }

  const title = getString(value, "title", "name");
  return title ? { url, title } : { url };
}

function parseInlineKeyboardButton(value: unknown): ChatInlineKeyboardButton | null {
  if (!isRecord(value)) {
    return null;
  }

  const text = getString(value, "text");
  if (!text) {
    return null;
  }

  const callbackData = getString(value, "callbackData", "callback_data");
  const url = getString(value, "url");
  const switchInlineQuery = getString(
    value,
    "switchInlineQuery",
    "switch_inline_query",
  );
  const webApp = parseWebApp(value.webApp ?? value.web_app);

  if (!callbackData && !url && !switchInlineQuery && !webApp) {
    return null;
  }

  return {
    text,
    callbackData: callbackData || undefined,
    url: url || undefined,
    switchInlineQuery: switchInlineQuery || undefined,
    webApp,
  };
}

function parseReplyKeyboardButton(value: unknown): ChatKeyboardButton | null {
  if (!isRecord(value)) {
    return null;
  }

  const text = getString(value, "text");
  if (!text) {
    return null;
  }

  return {
    text,
    requestContact: getBoolean(value, "requestContact", "request_contact") || undefined,
    requestLocation: getBoolean(value, "requestLocation", "request_location") || undefined,
  };
}

function parseRows<T>(
  value: unknown,
  parseButton: (candidate: unknown) => T | null,
): T[][] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) => {
      if (!Array.isArray(row)) {
        return [];
      }

      return row
        .map(parseButton)
        .filter((button): button is T => button !== null);
    })
    .filter((row) => row.length > 0);
}

function inferMarkupType(record: JsonRecord) {
  const explicitType = getString(record, "type");
  if (explicitType) {
    return explicitType;
  }

  if (getArray(record, "inlineKeyboard", "inline_keyboard").length > 0) {
    return "inline_keyboard";
  }

  if (getArray(record, "keyboard").length > 0) {
    return "reply_keyboard";
  }

  if (getBoolean(record, "removeKeyboard", "remove_keyboard")) {
    return "remove_keyboard";
  }

  if (getBoolean(record, "forceReply", "force_reply")) {
    return "force_reply";
  }

  return "";
}

function parseReplyMarkupRecord(record: JsonRecord): ChatReplyMarkup | null {
  const type = inferMarkupType(record);

  if (type === "inline_keyboard") {
    const inlineKeyboard = parseRows(
      getArray(record, "inlineKeyboard", "inline_keyboard"),
      parseInlineKeyboardButton,
    );
    return inlineKeyboard.length > 0
      ? { type: "inline_keyboard", inlineKeyboard }
      : null;
  }

  if (type === "reply_keyboard") {
    const keyboard = parseRows(getArray(record, "keyboard"), parseReplyKeyboardButton);
    return keyboard.length > 0
      ? {
          type: "reply_keyboard",
          keyboard,
          resizeKeyboard: getBoolean(record, "resizeKeyboard", "resize_keyboard"),
          oneTimeKeyboard: getBoolean(record, "oneTimeKeyboard", "one_time_keyboard"),
          selective: getBoolean(record, "selective"),
          inputFieldPlaceholder:
            getString(record, "inputFieldPlaceholder", "input_field_placeholder") || undefined,
        }
      : null;
  }

  if (type === "remove_keyboard") {
    return {
      type: "remove_keyboard",
      selective: getBoolean(record, "selective"),
    };
  }

  if (type === "force_reply") {
    return {
      type: "force_reply",
      selective: getBoolean(record, "selective"),
      inputFieldPlaceholder:
        getString(record, "inputFieldPlaceholder", "input_field_placeholder") || undefined,
    };
  }

  return null;
}

/**
 * Parses reply markup sent by bot-service and normalizes it for the web UI.
 */
export function parseChatReplyMarkup(value: unknown): ChatReplyMarkup | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return parseChatReplyMarkup(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (!isRecord(value)) {
    return null;
  }

  return parseReplyMarkupRecord(value);
}

/**
 * Returns the last input-affecting markup in a conversation.
 * Inline keyboards are rendered per-message and are ignored here.
 */
export function resolveActiveConversationInputMarkup<TMessage extends ChatReplyMarkupCarrier>(
  messages: readonly TMessage[],
): ActiveConversationInputMarkup<TMessage> | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const markup = message.replyMarkup;
    if (!markup || markup.type === "inline_keyboard") {
      continue;
    }

    return { message, markup };
  }

  return null;
}
