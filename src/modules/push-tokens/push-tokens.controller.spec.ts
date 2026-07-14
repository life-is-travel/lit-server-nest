import { PushTokensController } from './push-tokens.controller';
import { PushTokensService } from './push-tokens.service';

describe('PushTokensController', () => {
  const createController = () => {
    const register = jest.fn().mockResolvedValue({ id: 'push_token_1' });
    const remove = jest.fn().mockResolvedValue({ deleted: 1 });
    const service = { register, remove } as unknown as PushTokensService;
    return {
      controller: new PushTokensController(service),
      register,
      remove,
    };
  };

  it('registers a token for the authenticated store', async () => {
    const { controller, register } = createController();

    const result = await controller.register('store_1', {
      token: 'fcm-abc',
      platform: 'ios',
    });

    expect(register).toHaveBeenCalledWith('store_1', {
      token: 'fcm-abc',
      platform: 'ios',
    });
    expect(result).toEqual({ id: 'push_token_1' });
  });

  it('removes a token by value (logout cleanup)', async () => {
    const { controller, remove } = createController();

    const result = await controller.remove({ token: 'fcm-abc' });

    expect(remove).toHaveBeenCalledWith({ token: 'fcm-abc' });
    expect(result).toEqual({ deleted: 1 });
  });
});
