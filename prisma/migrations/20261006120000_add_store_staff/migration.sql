-- 직원 계정·초대코드(F-024)
CREATE TABLE `store_staff` (
  `id`             VARCHAR(255) NOT NULL,
  `store_id`       VARCHAR(255) NOT NULL,
  `name`           VARCHAR(30)  NOT NULL,
  `status`         ENUM('active', 'revoked') NOT NULL DEFAULT 'active',
  `joined_at`      DATETIME     NULL,
  `last_active_at` DATETIME     NULL,
  `revoked_at`     DATETIME     NULL,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_store_staff_store_status` (`store_id`, `status`),
  CONSTRAINT `store_staff_store_fk` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- 초대코드: 평문 대신 SHA-256 해시만 저장한다.
CREATE TABLE `store_staff_invite_codes` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `staff_id`   VARCHAR(255) NOT NULL,
  `store_id`   VARCHAR(255) NOT NULL,
  `code_hash`  CHAR(64)     NOT NULL,
  `expires_at` DATETIME     NOT NULL,
  `used_at`    DATETIME     NULL,
  `revoked_at` DATETIME     NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_staff_invite_code_hash` (`code_hash`),
  KEY `idx_staff_invite_staff_id` (`staff_id`),
  KEY `idx_staff_invite_store_id` (`store_id`),
  CONSTRAINT `store_staff_invite_codes_staff_fk` FOREIGN KEY (`staff_id`) REFERENCES `store_staff` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- refresh 토큰: NULL이면 점주 세션, 값이 있으면 직원 세션
ALTER TABLE `refresh_tokens`
  ADD COLUMN `staff_id` VARCHAR(255) NULL AFTER `store_id`,
  ADD KEY `idx_refresh_staff_id` (`staff_id`),
  ADD CONSTRAINT `refresh_tokens_staff_fk` FOREIGN KEY (`staff_id`) REFERENCES `store_staff` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
