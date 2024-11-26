import { db } from '@/db';
import { notifications, ResponseNotification } from '@/db/notifications.schema';
import { users } from '@/db/users.schema';
import { getNotificationsQuerySchema } from '@/dtos/notifications.dto';
import { UnauthorizedException } from '@/lib/exceptions';
import { encodeCursor } from '@/lib/utils';
import { handleAsync } from '@/middlewares/handle-async';
import { and, asc, desc, eq, gt, lt, or } from 'drizzle-orm';

export const getNotifications = handleAsync<
  unknown,
  { cursor: string | undefined; notifications: ResponseNotification[] }
>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  const { limit, cursor, sort } = getNotificationsQuerySchema.parse(req.query);
  const result = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, req.user.id),
        cursor && sort === 'desc'
          ? or(
              lt(notifications.receivedAt, cursor.value),
              and(eq(notifications.receivedAt, cursor.value), lt(notifications.id, cursor.id))
            )
          : undefined,
        cursor && sort === 'asc'
          ? or(
              gt(notifications.receivedAt, cursor.value),
              and(eq(notifications.receivedAt, cursor.value), gt(notifications.id, cursor.id))
            )
          : undefined
      )
    )
    .orderBy((t) => {
      if (sort === 'asc') return [asc(t.receivedAt), asc(t.id)];
      return [desc(t.receivedAt), desc(t.id)];
    })
    .limit(limit);

  const lastResult = result[result.length - 1];
  let cursorResponse: string | undefined = undefined;
  if (lastResult) {
    cursorResponse = encodeCursor({ id: lastResult.id, value: lastResult.receivedAt });
  }

  return res.json({ cursor: cursorResponse, notifications: result });
});

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
