import { getTableColumns } from 'drizzle-orm';
import { foreignKey, index, primaryKey, sqliteTable } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';
import { auctions } from './auctions.schema';
import { users } from './users.schema';

export const participants = sqliteTable(
  'participants',
  (t) => ({
    userId: t.text('user_id').notNull(),
    auctionId: t.text('auction_id').notNull(),
    status: t
      .text('status', { enum: ['joined', 'invited', 'rejected', 'kicked'] })
      .notNull()
      .default('joined'),
    createdAt: t
      .text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString())
  }),

  (participants) => [
    primaryKey({
      name: 'participants_pkey',
      columns: [participants.userId, participants.auctionId]
    }),
    foreignKey({
      name: 'fk_auction_id',
      columns: [participants.auctionId],
      foreignColumns: [auctions.id]
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    foreignKey({
      name: 'fk_user_id',
      columns: [participants.userId],
      foreignColumns: [users.id]
    })
      .onDelete('cascade')
      .onUpdate('cascade'),

    index('idx_auction_id_participants').on(participants.auctionId),
    index('idx_user_id_participants').on(participants.userId)
  ]
);

export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = typeof participants.$inferInsert;
export const selectParticipantSnapshot = getTableColumns(participants);
export const participationStatusSchema = z
  .enum(['joined', 'invited', 'kicked', 'rejected'])
  .nullable();
export type ParticipationStatus = z.infer<typeof participationStatusSchema>;
