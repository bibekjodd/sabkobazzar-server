import { createId } from '@paralleldrive/cuid2';
import { getTableColumns } from 'drizzle-orm';
import { integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { createSelectSchema } from 'drizzle-zod';

export const users = sqliteTable(
  'users',
  {
    id: text('id').notNull().$defaultFn(createId),
    name: text('name', { length: 30 }).notNull(),
    email: text('email', { length: 50 }).notNull(),
    role: text('role', { enum: ['user', 'admin'] })
      .notNull()
      .default('user'),
    image: text('image', { length: 300 }),
    phone: integer('phone'),
    lastOnline: text('last_online')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    lastNotificationReadAt: text('last_notification_read_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    totalUnreadNotifications: integer('total_unread_notifications').notNull().default(0)
  },
  function constraints(users) {
    return {
      primaryKey: primaryKey({ name: 'users_pkey', columns: [users.id] }),
      uniqueEmail: unique('uk_email').on(users.email)
    };
  }
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export const selectUserSnapshot = getTableColumns(users);
export const selectUserSchema = createSelectSchema(users);
export const responesUserSchema = selectUserSchema;
export type ResponseUser = User;
