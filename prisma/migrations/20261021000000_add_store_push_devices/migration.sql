-- 매장 앱 푸시 알림 기기(FCM 토큰). 점주·직원 기기 모두 저장한다.
-- 콜레이션: stores·store_staff와 외래키로 이어지므로 20261006120000_add_store_staff와 같은 utf8mb4_unicode_ci.
-- 토큰은 기기당 하나라 UNIQUE — 다른 매장·계정으로 다시 로그인하면 같은 행을 그 매장으로 옮긴다.
CREATE TABLE `store_push_devices` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `store_id`   VARCHAR(255) NOT NULL,
  `staff_id`   VARCHAR(255) NULL,
  `push_token` VARCHAR(500) NOT NULL,
  `platform`   ENUM('ios', 'android') NOT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_store_push_token` (`push_token`),
  KEY `idx_store_push_store_id` (`store_id`),
  KEY `idx_store_push_staff_id` (`staff_id`),
  CONSTRAINT `store_push_devices_store_fk` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `store_push_devices_staff_fk` FOREIGN KEY (`staff_id`) REFERENCES `store_staff` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
