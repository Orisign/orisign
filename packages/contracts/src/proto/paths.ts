import { join } from "path";

export const PROTO_PATHS = {
  AUTH: join(__dirname, "../../proto/auth.proto"),
  CALL: join(__dirname, "../../proto/call.proto"),
  MEDIA: join(__dirname, "../../proto/media.proto"),
  USERS: join(__dirname, "../../proto/users.proto"),
} as const;
