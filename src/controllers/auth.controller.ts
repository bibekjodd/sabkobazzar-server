import { db } from '@/db';
import { otps } from '@/db/otps.schema';
import { User, users } from '@/db/users.schema';
import { registerUserSchema } from '@/dtos/auth.dto';
import { forgotPasswordSchema, resetPasswordSchema, updatePasswordSchema } from '@/dtos/users.dto';
import { MILLIS } from '@/lib/constants';
import {
  BadRequestException,
  InternalServerException,
  NotFoundException,
  UnauthorizedException
} from '@/lib/exceptions';
import { sendMail } from '@/lib/send-mail';
import { comparePassword, generateOtp, hashPassword } from '@/lib/utils';
import { handleAsync } from '@/middlewares/handle-async';
import { and, eq } from 'drizzle-orm';

export const registerUser = handleAsync<unknown, { user: User }>(async (req, res) => {
  const data = registerUserSchema.parse(req.body);
  let [user] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);

  if (user && user.authSource !== 'credentials')
    throw new BadRequestException(
      `You are previously logged in with ${user.authSource}! Try logging from ${user.authSource}`
    );
  if (user) throw new BadRequestException('User with the same email already exists');

  const password = await hashPassword(data.password);
  user = await db
    .insert(users)
    .values({ ...data, password, authSource: 'credentials' })
    .returning()
    .execute()
    .then((res) => res[0]);

  if (!user) throw new InternalServerException();
  user.password = null;

  req.logIn(user, () => {
    res.status(201).json({ user });
  });
});

export const logout = handleAsync(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();

  req.logOut(() => {
    res.json({ message: 'Logged out successfully' });
  });
});

export const updatePassword = handleAsync(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  if (req.user.authSource !== 'credentials')
    throw new BadRequestException(
      `User is previously logged in from ${users.authSource}! and is not allowed to update the password`
    );

  const { oldPassword, newPassword } = updatePasswordSchema.parse(req.body);
  const currentPasswordHash = await db
    .select({ password: users.password })
    .from(users)
    .where(eq(users.id, req.user.id))
    .execute()
    .then(([user]) => user?.password);

  const isValidPassword = await comparePassword(oldPassword, currentPasswordHash!);
  if (!isValidPassword) throw new BadRequestException('Passwords does not match');

  const newPasswordHash = await hashPassword(newPassword);
  await db.update(users).set({ password: newPasswordHash }).where(eq(users.id, req.user.id));

  return res.json({ message: 'Password changed successfully' });
});

export const forgotPassword = handleAsync(async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user) throw new NotFoundException(`User with email ${email} does not exist`);
  if (user.authSource !== 'credentials')
    throw new BadRequestException(
      `User is previously logged in from ${user.authSource} and is not allowed to reset password`
    );

  const [currentOtp] = await db
    .select()
    .from(otps)
    .where(and(eq(otps.userId, user.id), eq(otps.type, 'reset-password')))
    .limit(1);

  if (currentOtp && currentOtp.expiresAt > new Date().toISOString())
    throw new BadRequestException('Otp is already sent to mail!');

  const otp = generateOtp();
  sendMail({
    mail: email,
    subject: 'Password reset OTP for sabkobazzar',
    text: `<strong>${otp}</strong> is your password reset otp. Use it within 1 minute before it expires`
  });

  await db
    .insert(otps)
    .values({
      otp,
      userId: user.id,
      type: 'reset-password',
      expiresAt: new Date(Date.now() + MILLIS.MINUTE).toISOString(),
      createdAt: new Date().toISOString()
    })
    .onConflictDoUpdate({
      target: [otps.userId, otps.type],
      set: {
        otp,
        expiresAt: new Date(Date.now() + MILLIS.MINUTE).toISOString(),
        createdAt: new Date().toISOString()
      }
    });

  return res.json({ message: 'Password reset otp sent to mail successfully' });
});

export const resetPassword = handleAsync<unknown, { user: User }>(async (req, res) => {
  const { otp, email, password } = resetPasswordSchema.parse(req.body);

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (user && user.authSource !== 'credentials')
    throw new BadRequestException(
      `User is previously logged in from ${user.authSource} and is not allowed to reset password`
    );

  if (!user) throw new NotFoundException(`User with email ${email} does not exist`);

  const [currentOtp] = await db
    .select()
    .from(otps)
    .where(and(eq(otps.userId, user.id), eq(otps.type, 'reset-password')))
    .limit(1);

  if (!currentOtp || currentOtp.expiresAt < new Date().toISOString() || currentOtp.otp !== otp)
    throw new BadRequestException('Invalid otp or otp has already expired');

  const hashedPassword = await hashPassword(password);
  const [updatedUser] = await Promise.all([
    db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, user.id))
      .returning()
      .execute()
      .then((res) => res[0]),
    db
      .delete(otps)
      .where(and(eq(otps.userId, user.id), eq(otps.type, 'reset-password')))
      .execute()
  ]);
  if (!updatedUser) throw new InternalServerException();

  req.login({ ...updatedUser, password: null }, () => {
    res.json({ user: req.user! });
  });
});
