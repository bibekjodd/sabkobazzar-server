import { env } from '@/config/env.config';
import { type Config } from 'drizzle-kit';

export default {
  schema: './src/schemas/*.schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: env.DATABASE_URL,
    token: env.DATABASE_AUTH_TOKEN,
    authToken: env.DATABASE_AUTH_TOKEN
  }
} satisfies Config;
