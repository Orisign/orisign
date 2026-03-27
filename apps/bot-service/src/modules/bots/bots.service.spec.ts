import { BotStatus, BotDeliveryMode, BotPrivacyMode, BotCreatedVia } from '@repo/contracts/gen/ts/bots';
import { BotsService } from './bots.service';

type BotsServiceDependencies = ConstructorParameters<typeof BotsService>;

describe('BotsService BotFather flow', () => {
  it('starts /newbot session and replies with next step prompt', async () => {
    const repository = {
      getBotEntityById: jest.fn().mockResolvedValue({
        id: 'botfather',
        ownerUserId: 'system',
        botUserId: 'bot_user_1',
        handleId: null,
        status: 'ACTIVE',
        deliveryMode: 'POLLING',
        privacyMode: 'PRIVACY_ENABLED',
        createdVia: 'SEED',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        version: 1,
        profile: {
          botId: 'botfather',
          displayName: 'BotFather',
          username: 'botfatherbot',
          description: null,
          about: null,
          shortDescription: null,
          avatarFileId: null,
          avatarUrl: null,
          localeDefault: null,
          allowedChatTypes: [],
          metadataJson: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        webhook: null,
      }),
      toProtoBot: jest.fn().mockReturnValue({
        id: 'botfather',
        ownerUserId: 'system',
        botUserId: 'bot_user_1',
        handleId: '',
        status: BotStatus.ACTIVE,
        deliveryMode: BotDeliveryMode.POLLING,
        privacyMode: BotPrivacyMode.PRIVACY_ENABLED,
        createdVia: BotCreatedVia.SEED,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: 0,
        version: 1,
        profile: {
          botId: 'botfather',
          displayName: 'BotFather',
          username: 'botfatherbot',
          description: '',
          about: '',
          shortDescription: '',
          avatarFileId: '',
          avatarUrl: '',
          localeDefault: '',
          allowedChatTypes: [],
          metadataJson: '',
        },
      }),
      createUpdate: jest.fn().mockResolvedValue({
        updateId: 1,
        payloadJson: '{}',
        eventType: 'message',
      }),
      getWebhook: jest.fn().mockResolvedValue(null),
      getSession: jest.fn().mockResolvedValue(null),
      upsertSession: jest.fn().mockResolvedValue({}),
      createCallbackQuery: jest.fn().mockResolvedValue(undefined),
    };

    const messagesClient = {
      sendMessage: jest.fn().mockResolvedValue({ ok: true }),
    };

    const updateWaitersService = {
      notify: jest.fn().mockResolvedValue(undefined),
    };

    const rmqService = {
      isConfigured: jest.fn().mockReturnValue(false),
    };

    const service = new BotsService(
      repository as unknown as BotsServiceDependencies[0],
      {} as unknown as BotsServiceDependencies[1],
      {} as unknown as BotsServiceDependencies[2],
      messagesClient as unknown as BotsServiceDependencies[3],
      {} as unknown as BotsServiceDependencies[4],
      updateWaitersService as unknown as BotsServiceDependencies[5],
      rmqService as unknown as BotsServiceDependencies[6],
    );

    await service.consumeExternalEvent({
      eventName: 'message.created',
      traceId: 'trace-1',
      payloadJson: JSON.stringify({
        botId: 'botfather',
        chatId: 'chat_1',
        userId: 'user_1',
        text: '/newbot',
      }),
    });

    expect(repository.upsertSession).toHaveBeenCalledWith(
      'botfather',
      'chat_1',
      'user_1',
      'BOT_FATHER',
      expect.objectContaining({
        scene: 'NEW_BOT',
        step: 'DISPLAY_NAME',
      }),
    );
    expect(messagesClient.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'chat_1',
        authorId: 'bot_user_1',
      }),
    );
  });
});
