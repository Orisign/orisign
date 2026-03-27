from __future__ import annotations

from collections.abc import Mapping
from typing import Protocol

from ..bot import Bot
from ..models.types import JsonValue, Update


class FastApiLike(Protocol):
    """Minimal FastAPI-compatible protocol used by the webhook adapter."""

    def post(self, path: str): ...


def mount_fastapi(bot: Bot, app: FastApiLike, path: str = "/webhook"):
    """Mounts a FastAPI-compatible webhook endpoint for the provided bot runtime."""

    async def handler(payload: Update | Mapping[str, JsonValue]):
        await bot.handle_update(payload)
        return {"ok": True}

    app.post(path)(handler)
    return handler
