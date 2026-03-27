import { createBot, Markup } from '..';

const bot = createBot({
  token: process.env.BOT_TOKEN ?? '',
  baseUrl: process.env.BOT_BASE_URL ?? 'http://localhost:4000',
});

bot.command('/start', async (ctx) => {
  await ctx.reply(
    'Use /weather <city>',
    Markup.inlineKeyboard([[Markup.button('Help', { callbackData: 'help' })]]),
  );
});

bot.command('/weather', async (ctx) => {
  await ctx.reply('Weather lookup example. Plug your provider here.');
});

bot.onAction('help', async (ctx) => {
  await ctx.reply('Send /weather Novosibirsk');
});

void bot.startPolling();
