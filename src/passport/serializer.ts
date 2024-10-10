import { db } from '@/lib/database';
import { notifications } from '@/schemas/notifications.schema';
import { selectUserSnapshot, users } from '@/schemas/users.schema';
import { and, eq, gt, sql } from 'drizzle-orm';
import passport from 'passport';

export const serializer = () => {
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  passport.deserializeUser(async (id: string, done) => {
    try {
      const [user] = await db
        .select({
          ...selectUserSnapshot,
          totalUnreadNotifications: sql<number>`count(${notifications.id})`
        })
        .from(users)
        .where(eq(users.id, id))
        .leftJoin(
          notifications,
          and(
            eq(notifications.userId, users.id),
            gt(notifications.receivedAt, users.lastNotificationReadAt)
          )
        )
        .groupBy(users.id);
      return done(null, user || null);
    } catch (error) {
      return done(error, null);
    }
  });
};
