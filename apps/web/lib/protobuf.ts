export interface ProtobufLongLike {
  low: number;
  high: number;
  unsigned?: boolean;
}

export type ProtobufNumberInput =
  | number
  | string
  | ProtobufLongLike
  | null
  | undefined;

const LONG_LIKE_KEYS = new Set(["low", "high", "unsigned"]);
const UINT32_BASE = 4_294_967_296;

export function isProtobufLongLike(value: unknown): value is ProtobufLongLike {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate);

  return (
    keys.length >= 2 &&
    keys.every((key) => LONG_LIKE_KEYS.has(key)) &&
    typeof candidate.low === "number" &&
    typeof candidate.high === "number" &&
    (candidate.unsigned === undefined || typeof candidate.unsigned === "boolean")
  );
}

export function protobufLongToNumber(value: ProtobufLongLike) {
  const low = value.low >>> 0;

  if (value.unsigned) {
    return (value.high >>> 0) * UINT32_BASE + low;
  }

  return value.high * UINT32_BASE + low;
}

export function coerceProtobufNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (isProtobufLongLike(value)) {
    const parsed = protobufLongToNumber(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function parseJsonWithProtobufSupport<T>(text: string) {
  return JSON.parse(text, (_key, value) =>
    isProtobufLongLike(value) ? protobufLongToNumber(value) : value,
  ) as T;
}
