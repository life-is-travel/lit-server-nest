import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
  AuthenticatedStoreRequest,
  AuthenticatedStore,
} from '../guards/store-auth.guard';

export const CurrentStore = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): AuthenticatedStore | undefined => {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedStoreRequest>();

    return request.store;
  },
);

export const CurrentStoreId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedStoreRequest>();

    return request.storeId;
  },
);
