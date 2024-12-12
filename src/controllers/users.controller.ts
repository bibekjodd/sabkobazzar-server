import { db } from '@/db';
import { notifications } from '@/db/notifications.schema';
import { otps } from '@/db/otps.schema';
import { ResponseUser, selectUserSnapshot, User, users } from '@/db/users.schema';
import { queryUsersSchema, updateProfileSchema, verifyUserSchema } from '@/dtos/users.dto';
import { MILLIS } from '@/lib/constants';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@/lib/exceptions';
import { sendMail } from '@/lib/send-mail';
import { handleAsync } from '@/middlewares/handle-async';
import { randomInt } from 'crypto';
import { and, desc, eq, gt, like, ne, or } from 'drizzle-orm';

export const getProfile = handleAsync<unknown, { user: User }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  return res.json({ user: req.user });
});

export const updateProfile = handleAsync<unknown, { user: User }>(async (req, res) => {
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
        gt(notifications.createdAt, req.user.lastNotificationReadAt)
      )
    )
    .execute()
    .then((result) => result.length);
  return res.json({ user: { ...updatedUser!, totalUnreadNotifications } });
});

export const getUserDetails = handleAsync<{ id: string }, { user: ResponseUser }>(
  async (req, res) => {
    const userId = req.params.id;
    const [user] = await db
      .select({ ...selectUserSnapshot })
      .from(users)
      .where(eq(users.id, userId));
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
    .where(
      and(
        q ? or(like(users.name, `%${q}%`), like(users.email, `%${q}%`)) : undefined,
        req.user?.id ? ne(users.id, req.user.id) : undefined
      )
    )
    .limit(limit)
    .offset(offset)
    .orderBy((t) => desc(t.name));

  return res.json({ users: result });
});

export const requestOtp = handleAsync(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  if (req.user.isVerified) throw new BadRequestException('User is already verified');

  const [currentOtp] = await db.select().from(otps).where(eq(otps.userId, req.user.id));
  if (currentOtp && currentOtp.createdAt > new Date(Date.now() - MILLIS.MINUTE).toISOString())
    throw new BadRequestException('Otp is already sent to your mail');

  const otp = randomInt(100_000, 999_999).toString();

  sendMail({
    mail: req.user.email,
    subject: `Your account verification OTP for sabkobazzar`,
    text: `<strong>${otp}</strong> is your otp. Use it within a minute before it expires!`
  });
  await db
    .insert(otps)
    .values({ otp, userId: req.user.id })
    .onConflictDoUpdate({
      target: [otps.userId],
      set: {
        otp,
        createdAt: new Date().toISOString()
      }
    });

  return res.json({ message: 'Otp has been sent to your mail' });
});

export const verifyUser = handleAsync(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  if (req.user.isVerified) throw new BadRequestException('User is already verified');
  const { otp } = verifyUserSchema.parse(req.body);

  const [currentOtp] = await db.select().from(otps).where(eq(otps.userId, req.user.id)).limit(1);
  if (
    !currentOtp ||
    currentOtp.otp !== otp ||
    new Date(Date.now() - MILLIS.MINUTE).toISOString() > currentOtp.createdAt
  )
    throw new BadRequestException('Invalid otp');

  await Promise.all([
    db.update(users).set({ isVerified: true }).where(eq(users.id, req.user.id)).execute(),
    db.delete(otps).where(eq(otps.userId, req.user.id)).execute()
  ]);

  return res.json({ message: 'User verified successfully' });
});
