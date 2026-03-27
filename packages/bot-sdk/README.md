# @orisign/bot-sdk

TypeScript-first SDK for Photon bots.

## Install

```bash
bun add @orisign/bot-sdk
```

## Example

```ts
import { createBot, Markup } from '@orisign/bot-sdk';

const bot = createBot({
  token: process.env.BOT_TOKEN!,
  baseUrl: 'http://localhost:4000',
});

bot.command('/start', async (ctx) => {
  await ctx.reply(
    'Hello from Photon bot platform',
    Markup.inlineKeyboard([[Markup.button('Help', { callbackData: 'help' })]]),
  );
});

bot.onAction('help', async (ctx) => {
  await ctx.reply('Use /start or /weather');
});

await bot.startPolling();
```

## Features

- Typed Bot API client
- Command router
- Message and callback query handlers
- Action prefix router via `onAction(...)`
- Middleware chain
- Polling runner
- Webhook handler factory
- Telegram-like markup builders
- Supports `replyMarkupJson`/callback buttons and long polling against `/bot/getUpdates`
