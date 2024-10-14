import { getTableColumns } from 'drizzle-orm';
import { foreignKey, index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { auctions } from './auctions.schema';
import { users } from './users.schema';

export const participants = sqliteTable(
  'participants',
  {
    userId: text('user_id').notNull(),
    auctionId: text('auction_id').notNull(),
    status: text('status', { enum: ['joined', 'invited', 'rejected', 'kicked'] })
      .notNull()
      .default('joined'),
    at: text('at')
      .notNull()
      .$defaultFn(() => new Date().toISOString())
  },
  function constraints(participants) {
    return {
      primaryKey: primaryKey({
        name: 'participants_pkey',
        columns: [participants.userId, participants.auctionId]
      }),
      auctionReference: foreignKey({
        name: 'fk_auction_id',
        columns: [participants.auctionId],
        foreignColumns: [auctions.id]
      })
        .onDelete('cascade')
        .onUpdate('cascade'),
      userReference: foreignKey({
        name: 'fk_user_id',
        columns: [participants.userId],
        foreignColumns: [users.id]
      })
        .onDelete('cascade')
        .onUpdate('cascade'),

      indexAuction: index('idx_auction_id_participants').on(participants.auctionId),
      indexUser: index('idx_user_id_participants').on(participants.userId)
    };
  }
);

export type Participant = typeof participants.$inferSelect;
export type ParticipationStatus = 'joined' | 'invited' | 'kicked' | 'rejected' | null;
export type InsertParticipant = typeof participants.$inferInsert;
export const selectParticipantSnapshot = getTableColumns(participants);
