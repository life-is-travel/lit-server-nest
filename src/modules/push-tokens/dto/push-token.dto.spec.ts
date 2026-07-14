import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DeletePushTokenDto, RegisterPushTokenDto } from './push-token.dto';

const buildRegister = (payload: Record<string, unknown>) =>
  plainToInstance(RegisterPushTokenDto, {
    token: 'fcm-token-abc',
    platform: 'ios',
    ...payload,
  });

describe('RegisterPushTokenDto', () => {
  it('accepts a valid ios token', async () => {
    expect(await validate(buildRegister({}))).toHaveLength(0);
  });

  it('accepts a valid android token', async () => {
    expect(await validate(buildRegister({ platform: 'android' }))).toHaveLength(
      0,
    );
  });

  it('rejects an empty token', async () => {
    const errors = await validate(buildRegister({ token: '' }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a token over 500 characters', async () => {
    const errors = await validate(buildRegister({ token: 'a'.repeat(501) }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an unknown platform', async () => {
    const errors = await validate(buildRegister({ platform: 'web' }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a missing platform', async () => {
    const errors = await validate(buildRegister({ platform: undefined }));
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('DeletePushTokenDto', () => {
  it('accepts a valid token', async () => {
    const dto = plainToInstance(DeletePushTokenDto, { token: 'fcm-token-abc' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an empty token', async () => {
    const dto = plainToInstance(DeletePushTokenDto, { token: '' });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
