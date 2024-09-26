import { foreignKey, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { auctions } from './auctions.schema';
import { users } from './users.schema';

export const participants = sqliteTable(
  'participants',
  {
    userId: text('user_id').notNull(),
    auctionId: text('auction_id').notNull()
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
        .onUpdate('cascade')
    };
  }
);

export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = typeof participants.$inferInsert;
export const selectParticipantSnapshot = {
  userId: participants.userId,
  auctionId: participants.auctionId
};
