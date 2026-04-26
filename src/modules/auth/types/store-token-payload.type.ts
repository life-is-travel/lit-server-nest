export type StoreAccessTokenPayload = {
  storeId: string;
  email: string;
  type: 'access';
};

export type StoreRefreshTokenPayload = {
  storeId: string;
  email?: string;
  type: 'refresh';
};
