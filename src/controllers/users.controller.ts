import { db } from '@/db';
import { notifications } from '@/db/notifications.schema';
import { otps } from '@/db/otps.schema';
import { ResponseUser, selectUserSnapshot, User, users } from '@/db/users.schema';
import { queryUsersSchema, updateProfileSchema, verifyUserAccountSchema } from '@/dtos/users.dto';
import { MILLIS } from '@/lib/constants';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@/lib/exceptions';
import { sendMail } from '@/lib/send-mail';
import { generateOtp } from '@/lib/utils';
import { handleAsync } from '@/middlewares/handle-async';
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
  const query = queryUsersSchema.parse(req.query);

  const offset = (query.page - 1) * query.limit;
  const result = await db
    .select()
    .from(users)
    .where(
      and(
        query.q
          ? or(like(users.name, `%${query.q}%`), like(users.email, `%${query.q}%`))
          : undefined,
        req.user?.id ? ne(users.id, req.user.id) : undefined,
        query.email ? eq(users.email, query.email) : undefined,
        query.role ? eq(users.role, query.role) : undefined
      )
    )
    .limit(query.limit)
    .offset(offset)
    .orderBy((t) => desc(t.name));

  return res.json({ users: result });
});

export const requestAccountVerificationOtp = handleAsync(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  if (req.user.isVerified) throw new BadRequestException('User is already verified');

  const [currentOtp] = await db
    .select()
    .from(otps)
    .where(and(eq(otps.userId, req.user.id), eq(otps.type, 'account-verification')));

  if (currentOtp && currentOtp.expiresAt > new Date().toISOString())
    return res.json({ message: 'Account verification otp is already sent to your mail' });

  const otp = generateOtp();

  await Promise.all([
    sendMail({
      mail: req.user.email,
      subject: `Your account verification OTP for sabkobazzar`,
      text: `<strong>${otp}</strong> is your otp. Use it within a minute before it expires!`
    }),
    db
      .insert(otps)
      .values({
        otp,
        userId: req.user.id,
        expiresAt: new Date(Date.now() + MILLIS.MINUTE).toISOString(),
        type: 'account-verification'
      })
      .onConflictDoUpdate({
        target: [otps.userId, otps.type],
        set: {
          otp,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + MILLIS.MINUTE).toISOString()
        }
      })
  ]);

  return res.json({ message: 'Otp has been sent to your mail' });
});

export const verifyUserAccount = handleAsync(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  if (req.user.isVerified) throw new BadRequestException('User is already verified');
  const { otp } = verifyUserAccountSchema.parse(req.body);

  const [currentOtp] = await db.select().from(otps).where(eq(otps.userId, req.user.id)).limit(1);
  if (!currentOtp || currentOtp.otp !== otp || currentOtp.expiresAt < new Date().toISOString())
    throw new BadRequestException('Invalid otp');

  await Promise.all([
    db.update(users).set({ isVerified: true }).where(eq(users.id, req.user.id)).execute(),
    db
      .delete(otps)
      .where(and(eq(otps.userId, req.user.id), eq(otps.type, 'account-verification')))
      .execute()
  ]);

  return res.json({ message: 'User verified successfully' });
});
