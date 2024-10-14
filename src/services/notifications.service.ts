import { db } from '@/lib/database';
import { onReceivedNotification } from '@/lib/events';
import { InsertNotification, notifications } from '@/schemas/notifications.schema';
import { users } from '@/schemas/users.schema';
import { eq, sql } from 'drizzle-orm';

export const addNotification = async (...data: InsertNotification[]) => {
  const notificationsToUpdate: { userId: string; count: number }[] = [];
  for (const notification of data) {
    const existingNotification = notificationsToUpdate.find(
      (n) => n.userId === notification.userId
    );
    if (existingNotification) existingNotification.count++;
    else notificationsToUpdate.push({ userId: notification.userId, count: 1 });
  }

  for (const notification of notificationsToUpdate) {
    db.update(users)
      .set({
        totalUnreadNotifications: sql`${users.totalUnreadNotifications}+${notification.count}`
      })
      .where(eq(users.id, notification.userId))
      .execute();
  }

  return db
    .insert(notifications)
    .values(data)
    .returning()
    .execute()
    .then((result) => {
      for (const notification of result) {
        onReceivedNotification(notification.userId, { notification });
      }
      return result;
    });
};
