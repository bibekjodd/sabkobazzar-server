import { createId } from '@paralleldrive/cuid2';
import { getTableColumns } from 'drizzle-orm';
import { index, primaryKey, sqliteTable } from 'drizzle-orm/sqlite-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { responseUserSchema, users } from './users.schema';

export const feedbacks = sqliteTable(
  'feedbacks',
  (t) => ({
    id: t.text().notNull().$defaultFn(createId),
    text: t.text({ length: 200 }),
    rating: t.integer().notNull(),
    userId: t.text('user_id').notNull(),
    createdAt: t
      .text('created_at')
      .notNull()
      .$default(() => new Date().toISOString())
  }),
  (feedbacks) => [
    primaryKey({ name: 'feedbacks_pkey', columns: [feedbacks.id] }),
    index('idx_user_id_feedbacks').on(users.id)
  ]
);

export type Feedback = typeof feedbacks.$inferSelect;
export type InsertFeedback = typeof feedbacks.$inferInsert;

export const selectFeedbacksSnapshot = getTableColumns(feedbacks);
export const selectFeedbackSchema = createSelectSchema(feedbacks);
export const responseFeedbackSchema = selectFeedbackSchema.extend({ user: responseUserSchema });
export type ResponseFeedback = z.infer<typeof responseFeedbackSchema>;
