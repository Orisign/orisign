export const CALL_LOG_MESSAGE_PREFIX = "__call_log_v1__:";

export type CallLogStatus = "completed" | "declined" | "canceled" | "failed";

export interface CallLogMessagePayload {
  status: CallLogStatus;
  durationSeconds: number;
  endedAt: number;
}

function isCallLogStatus(value: unknown): value is CallLogStatus {
  return (
    value === "completed" ||
    value === "declined" ||
    value === "canceled" ||
    value === "failed"
  );
}

export function createCallLogMessageText(payload: CallLogMessagePayload) {
  const normalizedPayload = {
    type: "call-log",
    version: 1,
    status: payload.status,
    durationSeconds: Math.max(0, Math.trunc(payload.durationSeconds)),
    endedAt: Math.max(0, Math.trunc(payload.endedAt)),
  };

  return `${CALL_LOG_MESSAGE_PREFIX}${JSON.stringify(normalizedPayload)}`;
}

export function parseCallLogMessageText(value: string | null | undefined) {
  if (!value || !value.startsWith(CALL_LOG_MESSAGE_PREFIX)) {
    return null;
  }

  const rawPayload = value.slice(CALL_LOG_MESSAGE_PREFIX.length).trim();
  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as {
      type?: unknown;
      version?: unknown;
      status?: unknown;
      durationSeconds?: unknown;
      endedAt?: unknown;
    };

    if (parsed.type !== "call-log" || parsed.version !== 1) {
      return null;
    }

    if (!isCallLogStatus(parsed.status)) {
      return null;
    }

    const durationSeconds = Number(parsed.durationSeconds);
    const endedAt = Number(parsed.endedAt);

    if (!Number.isFinite(durationSeconds) || !Number.isFinite(endedAt)) {
      return null;
    }

    return {
      status: parsed.status,
      durationSeconds: Math.max(0, Math.trunc(durationSeconds)),
      endedAt: Math.max(0, Math.trunc(endedAt)),
    } as CallLogMessagePayload;
  } catch {
    return null;
  }
}

export function formatCallDurationLabel(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.trunc(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
