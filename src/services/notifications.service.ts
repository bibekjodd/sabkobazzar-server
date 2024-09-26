import { db } from '@/lib/database';
import { InsertNotification, notifications } from '@/schemas/notifications.schema';

export const addNotification = async (...data: InsertNotification[]) => {
  return db.insert(notifications).values(data);
};
