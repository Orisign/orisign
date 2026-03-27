from orisign_bot_sdk import Bot, Markup


bot = Bot(token="BOT_TOKEN", base_url="http://localhost:4000")


@bot.command("/start")
async def start(ctx):
    await ctx.reply(
        "Use /weather <city>",
        Markup.inline_keyboard([[Markup.button("Help", callbackData="help")]]),
    )


@bot.command("/weather")
async def weather(ctx):
    await ctx.reply("Plug your weather provider here.")
