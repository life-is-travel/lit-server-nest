-- 테스트 매장(F-027): 내부 테스트·앱 심사용 매장 표시.
-- 1이면 고객 매장 목록·검색에서 제외된다. id로 직접 조회·예약은 그대로 된다.
ALTER TABLE `stores`
  ADD COLUMN `is_test` TINYINT(1) NOT NULL DEFAULT 0 AFTER `closed_at`;
