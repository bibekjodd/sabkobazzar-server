import { db } from '@/db';
import { users } from '@/db/users.schema';
import { BadRequestException, ForbiddenException } from '@/lib/exceptions';
import { comparePassword } from '@/lib/utils';
import { eq } from 'drizzle-orm';
import { Strategy } from 'passport-local';

export const LocalStrategy = new Strategy(
  { usernameField: 'email', passwordField: 'password' },
  async (username, password, done) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, username)).limit(1);
      if (!user) throw new BadRequestException('Invalid credentials');

      if (user.authSource !== 'credentials')
        throw new ForbiddenException(
          `You are previously logged in from ${user.authSource}! Try logging in from ${user.authSource}`
        );

      const isValidPassword = await comparePassword(password, user.password!);
      if (!isValidPassword) throw new BadRequestException('Invalid credentials');
      user.password = null;

      return done(null, user);
    } catch (error) {
      done(error, undefined);
    }
  }
);
