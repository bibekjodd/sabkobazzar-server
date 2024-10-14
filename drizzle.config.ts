import { type Config } from 'drizzle-kit';
import { env } from './src/config/env.config';

export default {
  schema: './src/schemas/*.schema.ts',
  dialect: 'turso',
  dbCredentials: {
    url: env.DATABASE_URL,
    authToken: env.DATABASE_AUTH_TOKEN
  }
} satisfies Config;
