# orisign-bot-sdk

Async-first Python SDK for Photon bots.

## Install

```bash
pip install orisign-bot-sdk
```

## Example

```python
from orisign_bot_sdk import Bot, Markup

bot = Bot(token="BOT_TOKEN", base_url="http://localhost:4000")

@bot.command("/start")
async def start(ctx):
    await ctx.reply(
        "Hello from Photon bot platform",
        Markup.inline_keyboard([[Markup.button("Help", callbackData="help")]]),
    )
```

## Features

- Async Bot API client
- Decorator router
- Callback query handlers
- Polling runner
- FastAPI webhook adapter
- Keyboard builders
