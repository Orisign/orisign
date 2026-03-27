import { RpcException } from '@nestjs/microservices';
import { HandleKind } from '@repo/contracts/gen/ts/handles';
import { HandlesService } from './handles.service';

type HandlesServiceDependencies = ConstructorParameters<typeof HandlesService>;

describe('HandlesService', () => {
  it('rejects non-bot usernames for bot handles', async () => {
    const service = new HandlesService({} as unknown as HandlesServiceDependencies[0]);

    await expect(
      service.reserveHandle({
        username: 'weather',
        kind: HandleKind.BOT,
        targetId: 'bot_1',
        actorId: 'user_1',
        traceId: '',
        allowReplaceSameTarget: false,
      }),
    ).rejects.toBeInstanceOf(RpcException);
  });

  it('rejects bot suffix for user handles', async () => {
    const service = new HandlesService({} as unknown as HandlesServiceDependencies[0]);

    await expect(
      service.checkHandleAvailability({
        username: 'weatherbot',
        kind: HandleKind.USER,
      }),
    ).resolves.toMatchObject({
      available: false,
    });
  });

  it('returns normalized username when available', async () => {
    const service = new HandlesService({
      findByNormalizedUsername: jest.fn().mockResolvedValue(null),
    } as unknown as HandlesServiceDependencies[0]);

    await expect(
      service.checkHandleAvailability({
        username: '@WeatherBot',
        kind: HandleKind.BOT,
      }),
    ).resolves.toMatchObject({
      available: true,
      normalizedUsername: 'weatherbot',
    });
  });
});
