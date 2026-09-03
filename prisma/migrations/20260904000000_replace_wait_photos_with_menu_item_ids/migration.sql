-- AlterTable
ALTER TABLE `store_settings` DROP COLUMN `reservation_wait_photos`;
ALTER TABLE `store_settings` ADD COLUMN `reservation_wait_menu_item_ids` JSON NULL AFTER `store_photos`;
