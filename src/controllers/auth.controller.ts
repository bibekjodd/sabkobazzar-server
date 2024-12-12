import { db } from '@/db';
import { User, users } from '@/db/users.schema';
import { registerUserSchema } from '@/dtos/auth.dto';
import {
  BadRequestException,
  InternalServerException,
  UnauthorizedException
} from '@/lib/exceptions';
import { hashPassword } from '@/lib/utils';
import { handleAsync } from '@/middlewares/handle-async';
import { eq } from 'drizzle-orm';

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
