import { getNotificationsQuerySchema } from '@/dtos/notifications.dto';
import { db } from '@/lib/database';
import { UnauthorizedException } from '@/lib/exceptions';
import { handleAsync } from '@/middlewares/handle-async';
import { notifications, ResponseNotification } from '@/schemas/notifications.schema';
import { users } from '@/schemas/users.schema';
import { and, desc, eq, gt, lt } from 'drizzle-orm';

export const getNotifications = handleAsync<unknown, { notifications: ResponseNotification[] }>(
  async (req, res) => {
    if (!req.user) throw new UnauthorizedException();
    const { limit, cursor } = getNotificationsQuerySchema.parse(req.query);
    const result = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, req.user.id), lt(notifications.receivedAt, cursor)))
      .orderBy((t) => desc(t.receivedAt))
      .limit(limit);
    return res.json({ notifications: result });
  }
);

export const readNotifications = handleAsync<unknown, { message: string }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();

  const currentDate = new Date().toISOString();
  await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, req.user.id), gt(notifications.receivedAt, currentDate)))
    .execute()
    .then((result) => {
      db.update(users)
        .set({
          lastNotificationReadAt: currentDate,
          totalUnreadNotifications: result.length
        })
        .where(eq(users.id, req.user?.id || ''))
        .execute();
    });

  return res.json({ message: 'Notifications read successfully' });
});
