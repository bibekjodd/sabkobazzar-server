import { createId } from '@paralleldrive/cuid2';
import { getTableColumns } from 'drizzle-orm';
import { foreignKey, index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
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
    params: text('params'),
    type: text('type')
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
export const selectNotificationSnapshot = getTableColumns(notifications);
export const selectNotificationSchema = createSelectSchema(notifications);
export const responseNotificationSchema = selectNotificationSchema;
export type ResponseNotification = z.infer<typeof responseNotificationSchema>;
