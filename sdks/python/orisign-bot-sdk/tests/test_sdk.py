from __future__ import annotations

from orisign_bot_sdk.markup import Markup
from orisign_bot_sdk.models import Update


def test_inline_keyboard_builder():
    markup = Markup.inline_keyboard(
        [[Markup.button("Open", callback_data="action:open")]]
    )

    assert markup.type == "inline_keyboard"
    assert markup.inline_keyboard[0][0].callback_data == "action:open"


def test_update_message_accessor():
    update = Update.model_validate(
        {
            "updateId": 1,
            "eventType": "message",
            "payload": {
                "id": "m1",
                "chat": {"id": "c1", "type": "private"},
                "text": "/start",
            },
        }
    )

    assert update.message is not None
    assert update.message.text == "/start"
