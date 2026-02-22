import { join } from "path";

export const PROTO_PATHS = {
  AUTH: join(__dirname, "../../proto/auth.proto"),
  CALL: join(__dirname, "../../proto/call.proto"),
} as const;
