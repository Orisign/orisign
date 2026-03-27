from __future__ import annotations


class BotApiError(RuntimeError):
    """Raised when the Orisign Bot API returns an application-level error."""

    def __init__(self, code: str, message: str, details: object | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.details = details
