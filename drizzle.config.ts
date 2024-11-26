import { type Config } from 'drizzle-kit';
import { env } from './src/config/env.config';

export default {
  schema: './src/db/*.schema.ts',
  dialect: 'turso',
  casing: 'snake_case',
  dbCredentials: {
    url: env.DATABASE_URL,
    authToken: env.DATABASE_AUTH_TOKEN
  }
} satisfies Config;
