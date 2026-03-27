export const BOT_PLATFORM_EXCHANGE = 'bot.platform';
export const DISPATCH_QUEUE = 'bot.dispatch.incoming';
export const WEBHOOK_DELIVERY_QUEUE = 'bot.delivery.webhook';
export const WEBHOOK_RETRY_5S_QUEUE = 'bot.delivery.webhook.retry.5s';
export const WEBHOOK_RETRY_30S_QUEUE = 'bot.delivery.webhook.retry.30s';
export const WEBHOOK_RETRY_120S_QUEUE = 'bot.delivery.webhook.retry.120s';
export const WEBHOOK_RETRY_600S_QUEUE = 'bot.delivery.webhook.retry.600s';
export const WEBHOOK_DLQ_QUEUE = 'bot.delivery.webhook.dlq';

export const DISPATCH_ROUTING_KEY = 'dispatch.incoming';
export const WEBHOOK_ROUTING_KEY = 'delivery.webhook';
export const WEBHOOK_RETRY_5S_ROUTING_KEY = 'delivery.webhook.retry.5s';
export const WEBHOOK_RETRY_30S_ROUTING_KEY = 'delivery.webhook.retry.30s';
export const WEBHOOK_RETRY_120S_ROUTING_KEY = 'delivery.webhook.retry.120s';
export const WEBHOOK_RETRY_600S_ROUTING_KEY = 'delivery.webhook.retry.600s';
export const WEBHOOK_DLQ_ROUTING_KEY = 'delivery.webhook.dlq';

export const WEBHOOK_RETRY_SCHEDULE = [
  { attemptNo: 1, routingKey: WEBHOOK_RETRY_5S_ROUTING_KEY, delayMs: 5_000 },
  { attemptNo: 2, routingKey: WEBHOOK_RETRY_30S_ROUTING_KEY, delayMs: 30_000 },
  { attemptNo: 3, routingKey: WEBHOOK_RETRY_120S_ROUTING_KEY, delayMs: 120_000 },
  { attemptNo: 4, routingKey: WEBHOOK_RETRY_600S_ROUTING_KEY, delayMs: 600_000 },
] as const;
