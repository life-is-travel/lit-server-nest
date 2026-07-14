-- 점주(lit-store 앱) FCM 푸시 토큰 저장 테이블 (2026-07-14)
-- 실행: mysql -h <host> -u <user> -p <db> < prisma/scripts/migrate-owner-push-tokens.sql
--
-- ⚠️ 코드 배포 **전에** 실행할 것
--    (푸시 토큰 등록 API `POST /api/store/push-tokens`와 리뷰 푸시 발송이
--     owner_push_tokens 테이블에 의존 — 테이블 없이 코드가 먼저 배포되면
--     토큰 등록/리뷰 푸시 경로가 500. 단, 리뷰 생성은 fire-and-forget이라
--     고객 응답에는 영향 없음)
--
-- ⚠️ 이미 적용됐는지 먼저 확인 (있으면 이 스크립트 건너뛸 것):
--   SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
--   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'owner_push_tokens';

CREATE TABLE IF NOT EXISTS `owner_push_tokens` (
    `id` VARCHAR(255) NOT NULL,
    `store_id` VARCHAR(255) NOT NULL,
    `token` VARCHAR(500) NOT NULL,
    `platform` VARCHAR(20) NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX `uniq_owner_push_token` (`token`),
    INDEX `idx_owner_push_store` (`store_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `owner_push_tokens_ibfk_1` FOREIGN KEY (`store_id`)
        REFERENCES `stores` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
