from __future__ import annotations

import asyncio
from collections.abc import Mapping

from .client import BotClient
from .context import BotContext
from .models.types import JsonValue, Update
from .router import Router


class Bot:
    """High-level Telegram-like runtime for Orisign bots."""

    def __init__(self, token: str, base_url: str) -> None:
        self.client = BotClient(token=token, base_url=base_url)
        self.router = Router()
        self._running = False

    def command(self, command: str):
        """Registers a slash-command handler such as `/start`."""

        return self.router.command(command)

    def on_message(self):
        """Registers a handler for every incoming message update."""

        return self.router.on_message()

    def on_callback_query(self, action: str | None = None):
        """Registers a callback handler, optionally filtered by prefix."""

        return self.router.on_callback_query(action)

    async def handle_update(self, raw_update: Update | Mapping[str, JsonValue]) -> None:
        """Validates and dispatches a single webhook or polling update."""

        update = (
            raw_update
            if isinstance(raw_update, Update)
            else Update.model_validate(dict(raw_update))
        )
        ctx = BotContext(self.client, update)
        await self.router.dispatch(ctx)

    async def run_polling(self, offset: int = 0, timeout: int = 20) -> None:
        """Starts a long-polling loop and dispatches updates sequentially."""

        self._running = True
        current_offset = offset
        while self._running:
            response = await self.client.get_updates(
                offset=current_offset,
                timeout=timeout,
            )
            for update in response.updates:
                await self.handle_update(update)
                current_offset = update.update_id + 1
            await asyncio.sleep(0.1)

    def stop(self) -> None:
        """Stops the active polling loop."""

        self._running = False
