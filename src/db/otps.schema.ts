import { foreignKey, primaryKey, sqliteTable } from 'drizzle-orm/sqlite-core';
import { users } from './users.schema';

export const otps = sqliteTable(
  'otps',
  (t) => ({
    userId: t.text('user_id').notNull(),
    otp: t.text('otp', { length: 6 }).notNull(),
    createdAt: t
      .text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    expiresAt: t.text('expires_at').notNull(),
    type: t.text({ enum: ['account-verification', 'reset-password'] }).notNull()
  }),
  (otps) => [
    primaryKey({ name: 'otps_pkey', columns: [otps.userId, otps.type] }),
    foreignKey({ name: 'fk_user_id', columns: [otps.userId], foreignColumns: [users.id] })
  ]
);
