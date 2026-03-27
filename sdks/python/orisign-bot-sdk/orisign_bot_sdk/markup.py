from __future__ import annotations

from .models.types import (
    ForceReply,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
)


class Markup:
    """Telegram-like reply markup builders for the Python SDK."""

    @staticmethod
    def inline_keyboard(rows: list[list[InlineKeyboardButton]]) -> InlineKeyboardMarkup:
        """Builds an inline keyboard markup object."""

        return InlineKeyboardMarkup(inlineKeyboard=rows)

    @staticmethod
    def button(
        text: str,
        *,
        callback_data: str | None = None,
        url: str | None = None,
    ) -> InlineKeyboardButton:
        """Builds an inline keyboard button."""

        return InlineKeyboardButton(text=text, callbackData=callback_data, url=url)

    @staticmethod
    def reply_keyboard(
        rows: list[list[KeyboardButton]],
        *,
        resize_keyboard: bool = True,
        one_time_keyboard: bool = False,
    ) -> ReplyKeyboardMarkup:
        """Builds a reply keyboard."""

        return ReplyKeyboardMarkup(
            keyboard=rows,
            resizeKeyboard=resize_keyboard,
            oneTimeKeyboard=one_time_keyboard,
        )

    @staticmethod
    def text_button(
        text: str,
        *,
        request_contact: bool = False,
        request_location: bool = False,
    ) -> KeyboardButton:
        """Builds a reply-keyboard text button."""

        return KeyboardButton(
            text=text,
            requestContact=request_contact,
            requestLocation=request_location,
        )

    @staticmethod
    def remove_keyboard() -> ReplyKeyboardRemove:
        """Builds a keyboard removal directive."""

        return ReplyKeyboardRemove()

    @staticmethod
    def force_reply() -> ForceReply:
        """Builds a force-reply directive."""

        return ForceReply()
