import { queryUsersSchema, updateProfileSchema } from '@/dtos/users.dto';
import { db } from '@/lib/database';
import { NotFoundException, UnauthorizedException } from '@/lib/exceptions';
import { handleAsync } from '@/middlewares/handle-async';
import { users } from '@/schemas/users.schema';
import { and, desc, eq, like, lt, or } from 'drizzle-orm';

export const getProfile = handleAsync(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  return res.json({ user: req.user });
});

export const updateProfile = handleAsync(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();

  const data = updateProfileSchema.parse(req.body);
  const [updatedUser] = await db
    .update(users)
    .set(data)
    .where(eq(users.id, req.user.id))
    .returning();
  return res.json({ user: updatedUser });
});

export const getUserDetails = handleAsync<{ id: string }>(async (req, res) => {
  const userId = req.params.id;
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new NotFoundException('User not found');
  return res.json({ user });
});

export const queryUsers = handleAsync(async (req, res) => {
  const { q, limit, cursor } = queryUsersSchema.parse(req.query);
  const result = await db
    .select()
    .from(users)
    .where(
      and(
        or(like(users.name, `%${q}%`), like(users.email, `%${q}%`)),
        cursor ? lt(users.name, cursor) : undefined
      )
    )
    .limit(limit)
    .orderBy((t) => desc(t.name));

  return res.json({ users: result });
});
