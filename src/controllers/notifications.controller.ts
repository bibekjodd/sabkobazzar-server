import { getNotificationsQuerySchema } from '@/dtos/notifications.dto';
import { db } from '@/lib/database';
import { BadRequestException, UnauthorizedException } from '@/lib/exceptions';
import { handleAsync } from '@/middlewares/handle-async';
import { notifications, ResponseNotification } from '@/schemas/notifications.schema';
import { users } from '@/schemas/users.schema';
import { and, desc, eq, lt } from 'drizzle-orm';

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

  const [user] = await db
    .update(users)
    .set({ lastNotificationReadAt: new Date().toISOString() })
    .where(eq(users.id, req.user.id))
    .returning();

  if (!user) throw new BadRequestException('Could not update notification reads');

  return res.json({ message: 'Notifications read successfully' });
});
