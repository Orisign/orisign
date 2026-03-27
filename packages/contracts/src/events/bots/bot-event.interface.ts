export interface BotEventEnvelope<TPayload = Record<string, unknown>> {
  eventId: string;
  eventName: string;
  version: number;
  traceId: string;
  occurredAt: number;
  producer: string;
  payload: TPayload;
}

export interface BotCreatedPayload {
  botId: string;
  ownerUserId: string;
  username: string;
  displayName: string;
}

export interface BotDeliveryFailedPayload {
  botId: string;
  updateId: number;
  mode: 'webhook' | 'polling';
  attemptNo: number;
  errorCode?: string;
  errorMessage?: string;
}
