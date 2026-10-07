import { SetMetadata } from '@nestjs/common';

export const STAFF_ALLOWED_KEY = 'storeStaffAllowed';

/**
 * 직원(F-024) 토큰으로도 호출할 수 있는 점주 API에 붙인다.
 * 표시가 없는 점주 API는 직원에게 403 OWNER_ONLY다(기본 거부).
 */
export const StaffAllowed = () => SetMetadata(STAFF_ALLOWED_KEY, true);
