-- 점주 계정(F-026): 로그인 주체를 stores에서 owners로 옮기고, 점주 1명이 매장 N개를 가진다.
-- 콜레이션: stores와 외래키로 이어지므로 20261006120000_add_store_staff와 같은 utf8mb4_unicode_ci.
CREATE TABLE `owners` (
  `id`                 VARCHAR(255) NOT NULL,
  `email`              VARCHAR(255) NOT NULL,
  `password_hash`      VARCHAR(255) NOT NULL,
  `login_count`        INT          NOT NULL DEFAULT 0,
  `login_locked_until` DATETIME     NULL,
  `last_login_at`      DATETIME     NULL,
  `withdrawn_at`       DATETIME     NULL,
  `created_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_owner_email` (`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 열린 매장마다 점주 1명. 같은 사람의 매장 합치기는 운영 SQL로 따로 한다.
INSERT INTO `owners` (`id`, `email`, `password_hash`, `login_count`, `login_locked_until`, `last_login_at`, `created_at`, `updated_at`)
SELECT CONCAT('owner_', `id`), LOWER(`email`), `password_hash`, `login_count`, `login_locked_until`, `last_login_at`,
       COALESCE(`created_at`, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
FROM `stores`
WHERE `closed_at` IS NULL;

ALTER TABLE `stores`
  ADD COLUMN `owner_id` VARCHAR(255) NULL AFTER `id`,
  ADD KEY `idx_stores_owner_id` (`owner_id`),
  ADD CONSTRAINT `stores_owner_fk` FOREIGN KEY (`owner_id`) REFERENCES `owners` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  -- 로그인에 더 쓰지 않는다. 앱에서 추가한 매장은 NULL. 기존 값은 롤백 대비로 남긴다.
  MODIFY COLUMN `email` VARCHAR(255) NULL,
  MODIFY COLUMN `password_hash` VARCHAR(255) NULL;

UPDATE `stores` SET `owner_id` = CONCAT('owner_', `id`) WHERE `closed_at` IS NULL;

-- 점주 기기는 점주의 모든 매장 푸시를 받는다(F-026). 직원 기기는 NULL.
ALTER TABLE `store_push_devices`
  ADD COLUMN `owner_id` VARCHAR(255) NULL AFTER `staff_id`,
  ADD KEY `idx_store_push_owner_id` (`owner_id`),
  ADD CONSTRAINT `store_push_devices_owner_fk` FOREIGN KEY (`owner_id`) REFERENCES `owners` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
