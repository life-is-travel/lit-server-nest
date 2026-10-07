/** 점주(owner) 또는 점주가 초대한 직원(staff). 역할이 없는 이전 토큰은 owner로 본다. */
export type StoreTokenRole = 'owner' | 'staff';

export type StoreAccessTokenPayload = {
  storeId: string;
  email?: string;
  staffId?: string;
  role: StoreTokenRole;
  type: 'access';
};

export type StoreRefreshTokenPayload = {
  storeId: string;
  email?: string;
  staffId?: string;
  role?: StoreTokenRole;
  type: 'refresh';
};
