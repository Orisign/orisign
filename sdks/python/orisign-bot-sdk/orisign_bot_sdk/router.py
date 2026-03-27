from __future__ import annotations

from collections.abc import Awaitable, Callable

from .context import BotContext

Handler = Callable[[BotContext], Awaitable[None]]


class Router:
    """Registers command, message and callback-query handlers."""

    def __init__(self) -> None:
        self.commands: dict[str, Handler] = {}
        self.message_handlers: list[Handler] = []
        self.callback_handlers: list[tuple[str, Handler]] = []

    def command(self, command: str) -> Callable[[Handler], Handler]:
        """Registers a slash-command handler such as `/start`."""

        def decorator(handler: Handler) -> Handler:
            self.commands[command.lstrip("/")] = handler
            return handler

        return decorator

    def on_message(self) -> Callable[[Handler], Handler]:
        """Registers a broad message handler."""

        def decorator(handler: Handler) -> Handler:
            self.message_handlers.append(handler)
            return handler

        return decorator

    def on_callback_query(self, action: str | None = None) -> Callable[[Handler], Handler]:
        """Registers a callback handler, optionally filtered by prefix."""

        def decorator(handler: Handler) -> Handler:
            self.callback_handlers.append((action or "", handler))
            return handler

        return decorator

    async def dispatch(self, ctx: BotContext) -> None:
        """Routes the current update to matching handlers."""

        if ctx.message is not None:
            text = ctx.message.text or ""
            if text.startswith("/"):
                command = text.split()[0].lstrip("/")
                handler = self.commands.get(command)
                if handler is not None:
                    await handler(ctx)
                    return
            for handler in self.message_handlers:
                await handler(ctx)

        if ctx.callback_query is not None:
            data = ctx.callback_query.data or ""
            for prefix, handler in self.callback_handlers:
                if not prefix or data.startswith(prefix):
                    await handler(ctx)
