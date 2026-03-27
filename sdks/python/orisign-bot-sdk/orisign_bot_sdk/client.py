from __future__ import annotations

import json
from types import TracebackType
from typing import TypeVar

import httpx
from pydantic import BaseModel

from .errors import BotApiError
from .models.types import (
    GetBotMeResponse,
    GetUpdatesResponse,
    MutationResponse,
    ReplyMarkup,
    SendMessageResponse,
)

ResponseT = TypeVar("ResponseT", bound=BaseModel)


class BotClient:
    """Async typed client for the Orisign developer Bot API."""

    def __init__(self, token: str, base_url: str) -> None:
        self.token = token
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={"Authorization": f"Bot {self.token}"},
            timeout=30.0,
        )

    async def __aenter__(self) -> "BotClient":
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        """Closes the underlying HTTP client."""

        await self._client.aclose()

    async def me(self) -> GetBotMeResponse:
        """Returns metadata for the authenticated bot."""

        return await self._request("GET", "/bot/me", GetBotMeResponse)

    async def send_message(
        self,
        chat_id: str,
        text: str,
        reply_markup: ReplyMarkup | None = None,
    ) -> SendMessageResponse:
        """Sends a text message into the target chat."""

        payload = {
            "chatId": chat_id,
            "text": text,
            "replyMarkupJson": (
                json.dumps(reply_markup.model_dump(by_alias=True, exclude_none=True))
                if reply_markup is not None
                else ""
            ),
        }
        return await self._request(
            "POST",
            "/bot/sendMessage",
            SendMessageResponse,
            json_payload=payload,
        )

    async def get_updates(
        self,
        offset: int = 0,
        limit: int = 30,
        timeout: int = 20,
    ) -> GetUpdatesResponse:
        """Pulls updates using long polling."""

        return await self._request(
            "GET",
            "/bot/getUpdates",
            GetUpdatesResponse,
            params={"offset": offset, "limit": limit, "timeout": timeout},
        )

    async def set_webhook(
        self,
        url: str,
        allowed_updates: list[str] | None = None,
        max_connections: int | None = None,
    ) -> MutationResponse:
        """Enables webhook delivery for the current bot."""

        return await self._request(
            "POST",
            "/bot/setWebhook",
            MutationResponse,
            json_payload={
                "url": url,
                "allowedUpdates": allowed_updates or [],
                "maxConnections": max_connections or 1,
            },
        )

    async def delete_webhook(self) -> MutationResponse:
        """Disables webhook delivery for the current bot."""

        return await self._request(
            "POST",
            "/bot/deleteWebhook",
            MutationResponse,
            json_payload={},
        )

    async def answer_callback_query(
        self,
        callback_query_id: str,
        text: str | None = None,
        show_alert: bool | None = None,
    ) -> MutationResponse:
        """Acknowledges a callback query."""

        return await self._request(
            "POST",
            "/bot/answerCallbackQuery",
            MutationResponse,
            json_payload={
                "callbackQueryId": callback_query_id,
                "text": text or "",
                "showAlert": show_alert or False,
            },
        )

    async def _request(
        self,
        method: str,
        path: str,
        response_model: type[ResponseT],
        *,
        params: dict[str, int | str] | None = None,
        json_payload: dict[str, object] | None = None,
    ) -> ResponseT:
        response = await self._client.request(
            method,
            path,
            params=params,
            json=json_payload,
        )
        response.raise_for_status()
        raw_payload = response.json()

        if isinstance(raw_payload, dict) and raw_payload.get("ok") is False:
            raise BotApiError(
                str(raw_payload.get("error_code") or "BOT_API_ERROR"),
                str(raw_payload.get("description") or "Bot API request failed"),
                raw_payload,
            )

        return response_model.model_validate(raw_payload)
