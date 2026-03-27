from __future__ import annotations

from typing import Literal, TypeAlias

from pydantic import BaseModel, ConfigDict, Field

JsonValue: TypeAlias = object
JsonObject: TypeAlias = dict[str, JsonValue]


class BaseSchema(BaseModel):
    """Base schema with permissive alias handling for bot API payloads."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class InlineKeyboardButton(BaseSchema):
    """Interactive inline button attached to a bot message."""

    text: str
    callback_data: str | None = Field(default=None, alias="callbackData")
    url: str | None = None


class KeyboardButton(BaseSchema):
    """Reply keyboard button displayed in the chat composer."""

    text: str
    request_contact: bool | None = Field(default=None, alias="requestContact")
    request_location: bool | None = Field(default=None, alias="requestLocation")


class InlineKeyboardMarkup(BaseSchema):
    """Inline keyboard markup compatible with the Orisign Bot API."""

    type: Literal["inline_keyboard"] = "inline_keyboard"
    inline_keyboard: list[list[InlineKeyboardButton]] = Field(alias="inlineKeyboard")


class ReplyKeyboardMarkup(BaseSchema):
    """Reply keyboard markup compatible with the Orisign Bot API."""

    type: Literal["reply_keyboard"] = "reply_keyboard"
    keyboard: list[list[KeyboardButton]]
    resize_keyboard: bool | None = Field(default=None, alias="resizeKeyboard")
    one_time_keyboard: bool | None = Field(default=None, alias="oneTimeKeyboard")


class ReplyKeyboardRemove(BaseSchema):
    """Instruction to remove the current reply keyboard."""

    type: Literal["remove_keyboard"] = "remove_keyboard"


class ForceReply(BaseSchema):
    """Instruction forcing the client to open the reply composer."""

    type: Literal["force_reply"] = "force_reply"


ReplyMarkup: TypeAlias = (
    InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
)


class MessageEntity(BaseSchema):
    """Structured message entity such as a mention, URL or bot command."""

    type: str
    offset: int
    length: int
    url: str | None = None
    user_id: str | None = Field(default=None, alias="userId")
    language: str | None = None


class Attachment(BaseSchema):
    """Attachment projection delivered to bot handlers."""

    type: str
    file_id: str | None = Field(default=None, alias="fileId")
    mime_type: str | None = Field(default=None, alias="mimeType")
    size: int | None = None
    width: int | None = None
    height: int | None = None
    duration: int | None = None


class User(BaseSchema):
    """Public user projection visible to bots."""

    id: str
    username: str | None = None
    display_name: str | None = Field(default=None, alias="displayName")
    first_name: str | None = Field(default=None, alias="firstName")
    last_name: str | None = Field(default=None, alias="lastName")
    avatar_url: str | None = Field(default=None, alias="avatarUrl")
    is_verified: bool | None = Field(default=None, alias="isVerified")
    is_bot: bool | None = Field(default=None, alias="isBot")
    locale: str | None = None
    timezone: str | None = None


class Chat(BaseSchema):
    """Public chat projection visible to bots."""

    id: str
    type: Literal["private", "group", "supergroup", "channel"]
    title: str | None = None
    username: str | None = None
    avatar_url: str | None = Field(default=None, alias="avatarUrl")
    member_count: int | None = Field(default=None, alias="memberCount")
    permissions: JsonObject | None = None


class Message(BaseSchema):
    """Canonical bot message payload."""

    id: str
    chat: Chat
    from_user: User | None = Field(default=None, alias="from")
    sender_chat: Chat | None = Field(default=None, alias="senderChat")
    date: int | None = None
    text: str | None = None
    caption: str | None = None
    entities: list[MessageEntity] = Field(default_factory=list)
    attachments: list[Attachment] = Field(default_factory=list)
    reply_markup: ReplyMarkup | None = Field(default=None, alias="replyMarkup")


class CallbackQuery(BaseSchema):
    """Callback query triggered by an inline keyboard button."""

    id: str
    from_user: User = Field(alias="from")
    message: Message
    data: str | None = None
    chat_instance: str | None = Field(default=None, alias="chatInstance")


class GenericPayload(BaseSchema):
    """Fallback payload for non-message, non-callback updates."""

    root: JsonObject = Field(default_factory=dict)


class Update(BaseSchema):
    """Delivery envelope used by polling and webhook handlers."""

    update_id: int = Field(alias="updateId")
    event_type: str = Field(alias="eventType")
    payload: Message | CallbackQuery | JsonObject
    event_ts: int | None = Field(default=None, alias="eventTs")
    delivery_attempt: int | None = Field(default=None, alias="deliveryAttempt")
    trace_id: str | None = Field(default=None, alias="traceId")

    @property
    def message(self) -> Message | None:
        """Returns the message payload when the update is a message event."""

        return self.payload if isinstance(self.payload, Message) else None

    @property
    def callback_query(self) -> CallbackQuery | None:
        """Returns the callback query payload when applicable."""

        return self.payload if isinstance(self.payload, CallbackQuery) else None


class BotProfileInfo(BaseSchema):
    """Minimal bot profile returned by the developer API."""

    display_name: str | None = Field(default=None, alias="displayName")
    username: str | None = None
    description: str | None = None
    about: str | None = None
    short_description: str | None = Field(default=None, alias="shortDescription")
    avatar_file_id: str | None = Field(default=None, alias="avatarFileId")
    avatar_url: str | None = Field(default=None, alias="avatarUrl")
    locale_default: str | None = Field(default=None, alias="localeDefault")


class BotInfo(BaseSchema):
    """Developer-facing bot descriptor."""

    id: str
    owner_user_id: str | None = Field(default=None, alias="ownerUserId")
    bot_user_id: str | None = Field(default=None, alias="botUserId")
    status: str | None = None
    profile: BotProfileInfo | None = None


class MutationResponse(BaseSchema):
    """Generic success response for mutation endpoints."""

    ok: bool


class SendMessageResponse(BaseSchema):
    """Response returned by sendMessage-like developer API methods."""

    ok: bool
    message_id: str | None = Field(default=None, alias="messageId")
    conversation_id: str | None = Field(default=None, alias="conversationId")


class GetBotMeResponse(BaseSchema):
    """Response returned by `/bot/me`."""

    bot: BotInfo | None = None


class GetUpdatesResponse(BaseSchema):
    """Response returned by `/bot/getUpdates`."""

    updates: list[Update] = Field(default_factory=list)
