import { queryUsersSchema, updateProfileSchema } from '@/dtos/users.dto';
import { db } from '@/lib/database';
import { NotFoundException, UnauthorizedException } from '@/lib/exceptions';
import { handleAsync } from '@/middlewares/handle-async';
import { notifications } from '@/schemas/notifications.schema';
import { ResponseUser, UserProfile, users } from '@/schemas/users.schema';
import { and, desc, eq, gt, like, or } from 'drizzle-orm';

export const getProfile = handleAsync<unknown, { user: UserProfile }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  return res.json({ user: req.user });
});

export const updateProfile = handleAsync<unknown, { user: UserProfile }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();

  const data = updateProfileSchema.parse(req.body);
  const [updatedUser] = await db
    .update(users)
    .set(data)
    .where(eq(users.id, req.user.id))
    .returning();
  const totalUnreadNotifications = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, req.user.id),
        gt(notifications.receivedAt, req.user.lastNotificationReadAt)
      )
    )
    .execute()
    .then((result) => result.length);
  return res.json({ user: { ...updatedUser!, totalUnreadNotifications } });
});

export const getUserDetails = handleAsync<{ id: string }, { user: ResponseUser }>(
  async (req, res) => {
    const userId = req.params.id;
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new NotFoundException('User not found');
    return res.json({ user });
  }
);

export const queryUsers = handleAsync<unknown, { users: ResponseUser[] }>(async (req, res) => {
  const { q, limit, page } = queryUsersSchema.parse(req.query);
  const offset = (page - 1) * limit;
  const result = await db
    .select()
    .from(users)
    .where(q ? or(like(users.name, `%${q}%`), like(users.email, `%${q}%`)) : undefined)
    .limit(limit)
    .offset(offset)
    .orderBy((t) => desc(t.name));

  return res.json({ users: result });
});
