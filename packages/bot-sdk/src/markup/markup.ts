import type { InlineKeyboardButton, KeyboardButton, ReplyMarkup } from '../types';

/**
 * Helper builders for Telegram-like reply markup.
 */
export const Markup = {
  inlineKeyboard(rows: Array<Array<InlineKeyboardButton>>): ReplyMarkup {
    return { type: 'inline_keyboard', inlineKeyboard: rows };
  },
  button(text: string, options: Omit<InlineKeyboardButton, 'text'> = {}): InlineKeyboardButton {
    return { text, ...options };
  },
  replyKeyboard(rows: Array<Array<KeyboardButton>>, options?: { resizeKeyboard?: boolean; oneTimeKeyboard?: boolean }): ReplyMarkup {
    return { type: 'reply_keyboard', keyboard: rows, resizeKeyboard: options?.resizeKeyboard, oneTimeKeyboard: options?.oneTimeKeyboard };
  },
  textButton(text: string, options: Omit<KeyboardButton, 'text'> = {}): KeyboardButton {
    return { text, ...options };
  },
  removeKeyboard(): ReplyMarkup {
    return { type: 'remove_keyboard' };
  },
  forceReply(): ReplyMarkup {
    return { type: 'force_reply' };
  },
};
