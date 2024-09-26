import { createId } from '@paralleldrive/cuid2';
import { foreignKey, index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from './users.schema';

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').notNull().$defaultFn(createId),
    userId: text('user_id').notNull(),
    title: text('title', { length: 200 }).notNull(),
    description: text('description', { length: 400 }),
    receivedAt: text('received_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    entity: text('entity').notNull(),
    params: text('params')
  },
  function constraints(notifications) {
    return {
      primaryKey: primaryKey({ name: 'notifications_pkey', columns: [notifications.id] }),
      userReference: foreignKey({
        name: 'fk_user_id',
        columns: [notifications.userId],
        foreignColumns: [users.id]
      })
        .onDelete('cascade')
        .onUpdate('cascade'),
      userIndex: index('idx_user_id_notifications').on(notifications.userId)
    };
  }
);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

export const selectNotificationSnapshot = {
  id: notifications.id,
  title: notifications.title,
  description: notifications.description,
  receivedAt: notifications.receivedAt,
  entity: notifications.entity,
  params: notifications.params
};
