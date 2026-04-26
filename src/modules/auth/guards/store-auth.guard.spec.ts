import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { StoreAuthGuard } from './store-auth.guard';
import { TokenService } from '../services/token.service';

const createContext = (authorization?: string): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        headers: authorization ? { authorization } : {},
      }),
    }),
  }) as ExecutionContext;

describe('StoreAuthGuard', () => {
  it('attaches the verified store payload to the request', () => {
    const verifyAccessToken = jest.fn().mockReturnValue({
      storeId: 'store_1',
      email: 'store@example.com',
      type: 'access',
    });
    const tokenService = {
      verifyAccessToken,
    } as unknown as TokenService;
    const guard = new StoreAuthGuard(tokenService);
    const request = {
      headers: {
        authorization: 'Bearer access-token',
      },
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(verifyAccessToken).toHaveBeenCalledWith('access-token');
    expect(request).toMatchObject({
      store: {
        storeId: 'store_1',
        email: 'store@example.com',
        type: 'access',
      },
      storeId: 'store_1',
    });
  });

  it('rejects requests without an authorization header', () => {
    const guard = new StoreAuthGuard({} as TokenService);

    expect(() => guard.canActivate(createContext())).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects malformed authorization headers', () => {
    const guard = new StoreAuthGuard({} as TokenService);

    expect(() =>
      guard.canActivate(createContext('Token access-token')),
    ).toThrow(UnauthorizedException);
  });
});
