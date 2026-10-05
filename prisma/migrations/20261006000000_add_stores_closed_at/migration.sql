-- 점주 회원탈퇴(F-001): 탈퇴 시각. NULL이 아니면 고객 노출·예약 대상에서 제외된다.
ALTER TABLE `stores`
  ADD COLUMN `closed_at` DATETIME NULL AFTER `login_locked_until`;
