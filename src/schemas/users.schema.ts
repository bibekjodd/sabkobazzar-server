import { createId } from '@paralleldrive/cuid2';
import { integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users',
  {
    id: text('id').notNull().$defaultFn(createId),
    name: text('name', { length: 30 }).notNull(),
    email: text('email', { length: 50 }).notNull(),
    role: text('role', { enum: ['user', 'admin'] }).default('user'),
    image: text('image', { length: 300 }),
    phone: integer('phone')
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
export const selectUserSnapshot = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  image: users.image,
  phone: users.phone
};
