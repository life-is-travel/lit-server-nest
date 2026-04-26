import { reservations, storages, storages_status } from '@prisma/client';
import { StorageResponseDto } from '../dto/storage.dto';

type StorageWithReservation = storages & {
  reservations?: reservations[];
};

export const toStorageResponse = (
  storage: StorageWithReservation,
): StorageResponseDto => {
  const currentReservation = storage.reservations?.[0];
  const status = storage.status ?? storages_status.available;

  return {
    id: storage.id,
    storeId: storage.store_id,
    number: storage.number,
    type: storage.type,
    status,
    size: {
      width: storage.width,
      height: storage.height,
      depth: storage.depth,
    },
    pricing: storage.pricing,
    location: {
      floor: storage.floor,
      section: storage.section,
      row: storage.row_num,
      column: storage.column_num,
    },
    createdAt: storage.created_at,
    updatedAt: storage.updated_at,
    ...(currentReservation
      ? {
          currentReservation: {
            id: currentReservation.id,
            customerName: currentReservation.customer_name,
            customerPhone: currentReservation.customer_phone,
            startTime: currentReservation.start_time,
            endTime: currentReservation.end_time,
            status: currentReservation.status,
          },
        }
      : {}),
  };
};
