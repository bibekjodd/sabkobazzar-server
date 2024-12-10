import { createId } from '@paralleldrive/cuid2';
import { getTableColumns } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createSelectSchema } from 'drizzle-zod';

export const users = sqliteTable(
  'users',
  (t) => ({
    id: t.text().notNull().$defaultFn(createId),
    name: t.text({ length: 30 }).notNull(),
    email: t.text({ length: 50 }).notNull(),
    role: t
      .text({ enum: ['user', 'admin'] })
      .notNull()
      .default('user'),
    image: t.text({ length: 300 }),
    phone: t.integer(),
    lastOnline: t
      .text('last_online')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    lastNotificationReadAt: t
      .text('last_notification_read_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    totalUnreadNotifications: integer('total_unread_notifications').notNull().default(0),
    createdAt: t
      .text('created_at')
      .notNull()
      .$default(() => new Date().toISOString())
  }),

  (users) => [
    primaryKey({ name: 'users_pkey', columns: [users.id] }),
    uniqueIndex('idx_email_users').on(users.email),
    index('idx_last_online_users').on(users.lastOnline)
  ]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export const selectUserSnapshot = getTableColumns(users);
export const selectUserSchema = createSelectSchema(users);
export const responseUserSchema = selectUserSchema;
export type ResponseUser = User;
