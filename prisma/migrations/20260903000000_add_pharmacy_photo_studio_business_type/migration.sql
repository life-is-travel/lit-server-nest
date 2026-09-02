-- AlterTable
-- business_type enum 확장: 약국/사진관 추가 (기존 값 유지, 값 추가만이라 데이터 안전)
ALTER TABLE `stores` MODIFY COLUMN `business_type` ENUM('RESTAURANT', 'CAFE', 'CONVENIENCE_STORE', 'TRAIN_STATION', 'HOTEL', 'SHOP', 'BEAUTY_SALON', 'PHARMACY', 'PHOTO_STUDIO', 'OTHER') NULL;
