import { env } from '@/config/env.config';
import { type Config } from 'drizzle-kit';

export default {
  schema: './src/schemas/*.schema.ts',
  dialect: 'turso',
  dbCredentials: {
    url: env.DATABASE_URL,
    authToken: env.DATABASE_AUTH_TOKEN
  }
} satisfies Config;
