# bot-service

`bot-service` is Photon's internal bot control plane and developer API service.

## What is implemented now

- Global bot registry and credential lifecycle
- Bot token format `{botId}:{secretKey}`
- Handle reservation through `handle-service`
- Internal owner CRUD over gRPC
- Owner-facing stats and audit logs
- Developer API over gRPC for:
  - `getBotMe`
  - `sendMessage`
  - `sendPhoto` / `sendVideo` / `sendDocument` / `sendAudio` / `sendMediaGroup` via gateway aliases
  - `editMessageText`
  - `editMessageReplyMarkup`
  - `deleteMessage`
  - `answerCallbackQuery`
  - `getUpdates`
  - webhook management
- Polling update buffer with monotonic `updateId`
- Basic immediate webhook delivery with HMAC signature headers
- Message metadata passthrough for:
  - `entitiesJson`
  - `replyMarkupJson`
  - `attachmentsJson`
  - `sourceBotId`
- System `BotFather` bootstrap with:
  - `/start`
  - `/help`
  - `/newbot`
  - `/mybots`
  - `/token`
  - `/regenerate_token`
  - `/revoke`
  - `/enablebot`
  - `/disablebot`
  - `/deletebot`
  - `/setname`
  - `/setusername`
  - `/setdescription`
  - `/setabout`
  - `/setwebhook`
  - `/deletewebhook`
  - `/cancel`
- Unified case-insensitive usernames through `handle-service`
- Bot/system-bot suffix rules:
  - only bots may use names ending with `bot`
  - all bot usernames must end with `bot`

## Environment

Copy `.env.example` to `.env` and adjust gRPC URLs to your local stack.

## Local run

```powershell
docker compose -f apps/bot-service/docker-compose.yml up -d
bun run --filter @repo/contracts generate
bun run --filter handle-service prisma:generate
bun run --filter bot-service prisma:generate
bun run db:push
bun run --filter handle-service dev
bun run --filter bot-service dev
```

## Integration entrypoints

- Gateway internal routes: `/internal/bots/*`
- Gateway developer routes: `/bot/*`
- Global handle resolve: `/handles/resolve`
- Gateway handle availability: `/handles/check`
- Gateway handle lookup by target: `/handles/:kind/:targetId`

## Notes

- Redis/RabbitMQ are provisioned in compose for the next delivery/retry stage; current implementation persists updates in PostgreSQL and does immediate webhook attempts.
- BotFather runtime currently works through `ConsumeExternalEvent` and expects inbound event payloads with at least `botId`, `chatId`, `userId`, `text`.
- Current delivery semantics are `at-least-once` for both webhook and polling modes; client-side dedupe should use `updateId`.
