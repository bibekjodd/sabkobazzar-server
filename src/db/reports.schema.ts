import { imageSchema } from '@/dtos/users.dto';
import { createId } from '@paralleldrive/cuid2';
import { getTableColumns } from 'drizzle-orm';
import { foreignKey, index, primaryKey, sqliteTable } from 'drizzle-orm/sqlite-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { auctions } from './auctions.schema';
import { responseUserSchema, users } from './users.schema';

export const reports = sqliteTable(
  'reports',
  (t) => ({
    id: t.text().notNull().$defaultFn(createId),
    userId: t.text('user_id').notNull(),
    auctionId: t.text('auction_id').notNull(),
    title: t.text({ length: 100 }).notNull(),
    text: t.text({ length: 1000 }),
    response: t.text({ length: 1000 }),
    images: t.text({ mode: 'json' }).$type<string[]>(),
    createdAt: t
      .text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString())
  }),
  (reports) => [
    primaryKey({ name: 'reports_pkey', columns: [reports.id] }),
    foreignKey({
      name: 'fk_user_id',
      columns: [reports.userId],
      foreignColumns: [users.id]
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    foreignKey({
      name: 'fk_auction_id',
      columns: [reports.auctionId],
      foreignColumns: [auctions.id]
    })
      .onDelete('cascade')
      .onUpdate('cascade'),

    index('idx_user_id_reports').on(reports.userId),
    index('idx_auction_id_reports').on(reports.auctionId),
    index('idx_created_at').on(reports.createdAt)
  ]
);

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

export const selectReportsSnapshot = getTableColumns(reports);
export const selectReportSchema = createSelectSchema(reports);
export const responseReportSchema = createSelectSchema(reports).extend({
  images: z.array(imageSchema).nullable(),
  user: responseUserSchema
});
export type ResponseReport = z.infer<typeof responseReportSchema>;
