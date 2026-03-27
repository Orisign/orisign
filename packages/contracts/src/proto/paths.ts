import { join } from "path";

export const PROTO_PATHS = {
  ACCOUNT: join(__dirname, "../../proto/account.proto"),
  AUTH: join(__dirname, "../../proto/auth.proto"),
  BOTS: join(__dirname, "../../proto/bots.proto"),
  CALL: join(__dirname, "../../proto/call.proto"),
  CONVERSATIONS: join(__dirname, "../../proto/conversations.proto"),
  HANDLES: join(__dirname, "../../proto/handles.proto"),
  MEDIA: join(__dirname, "../../proto/media.proto"),
  MESSAGES: join(__dirname, "../../proto/messages.proto"),
  USERS: join(__dirname, "../../proto/users.proto"),
} as const;
