import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
      })
    };
  }
);

export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = typeof participants.$inferInsert;
export const selectParticipantsSnapshot = {
  userId: participants.userId,
  auctionId: participants.auctionId
};
