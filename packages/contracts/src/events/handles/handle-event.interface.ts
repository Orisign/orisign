export interface HandleEventEnvelope<TPayload = Record<string, unknown>> {
  eventId: string;
  eventName: string;
  version: number;
  traceId: string;
  occurredAt: number;
  producer: string;
  payload: TPayload;
}

export interface HandleReservedPayload {
  handleId: string;
  username: string;
  normalizedUsername: string;
  targetId: string;
  kind: 'USER' | 'CONVERSATION' | 'BOT' | 'SYSTEM_BOT';
}
