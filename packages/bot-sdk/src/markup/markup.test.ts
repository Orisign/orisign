import { expect, test } from 'bun:test';
import { Markup } from './markup';

test('inline keyboard builder produces telegram-like shape', () => {
  const markup = Markup.inlineKeyboard([[Markup.button('Open', { callbackData: 'open' })]]);

  expect(markup.type).toBe('inline_keyboard');
  if (markup.type !== 'inline_keyboard') {
    throw new Error('Expected inline keyboard markup');
  }

  expect(markup.inlineKeyboard[0]?.[0]?.callbackData).toBe('open');
});
