-- CreateTable
CREATE TABLE `owner_push_tokens` (
    `id` VARCHAR(255) NOT NULL,
    `store_id` VARCHAR(255) NOT NULL,
    `token` VARCHAR(500) NOT NULL,
    `platform` VARCHAR(20) NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE INDEX `uniq_owner_push_token`(`token`),
    INDEX `idx_owner_push_store`(`store_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `owner_push_tokens` ADD CONSTRAINT `owner_push_tokens_ibfk_1` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
