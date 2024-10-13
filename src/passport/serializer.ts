import { db } from '@/lib/database';
import { notifications } from '@/schemas/notifications.schema';
import { selectUserSnapshot, users } from '@/schemas/users.schema';
import { and, eq, gt } from 'drizzle-orm';
import passport from 'passport';

export const serializer = () => {
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  passport.deserializeUser(async (id: string, done) => {
    try {
      const userPromise = db
        .update(users)
        .set({ lastOnline: new Date().toISOString() })
        .where(eq(users.id, id))
        .returning(selectUserSnapshot)
        .execute()
        .then((result) => result[0]);
      const notificationsPromise = db
        .select()
        .from(notifications)
        .innerJoin(
          users,
          and(
            eq(notifications.userId, users.id),
            gt(notifications.receivedAt, users.lastNotificationReadAt)
          )
        )
        .where(eq(notifications.userId, id))
        .groupBy(notifications.id)
        .execute()
        .then((result) => result.length);

      const [user, totalUnreadNotifications] = await Promise.all([
        userPromise,
        notificationsPromise
      ]);

      if (!user) return done(null, null);

      return done(null, { ...user, totalUnreadNotifications });
    } catch (error) {
      return done(error, null);
    }
  });
};
