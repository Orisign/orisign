from __future__ import annotations

from .client import BotClient
from .models.types import CallbackQuery, Message, ReplyMarkup, SendMessageResponse, Update


class BotContext:
    """Handler context carrying the typed update and API client."""

    def __init__(self, client: BotClient, update: Update) -> None:
        self.client = client
        self.update = update

    @property
    def message(self) -> Message | None:
        """Returns the message payload when the current update is a message event."""

        return self.update.message

    @property
    def callback_query(self) -> CallbackQuery | None:
        """Returns the callback query payload when the current update is a callback event."""

        return self.update.callback_query

    async def reply(
        self,
        text: str,
        reply_markup: ReplyMarkup | None = None,
    ) -> SendMessageResponse:
        """Replies into the current chat inferred from the incoming update."""

        chat = self.message.chat if self.message else self.callback_query.message.chat if self.callback_query else None
        if chat is None:
            raise RuntimeError("No chat payload found in the current update")
        return await self.client.send_message(chat.id, text, reply_markup)
