export type ExternalEventJob = {
  eventName: string;
  traceId?: string;
  payloadJson: string;
};

export type WebhookDeliveryJob = {
  botId: string;
  updateId: number;
  eventType: string;
  payloadJson: string;
  url: string;
  secret: string;
  traceId?: string;
  attemptNo: number;
};
