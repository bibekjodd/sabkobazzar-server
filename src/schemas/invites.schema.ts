import { foreignKey, index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { auctions } from './auctions.schema';
import { users } from './users.schema';

export const invites = sqliteTable(
  'invites',
  {
    userId: text('user_id').notNull(),
    auctionId: text('auction_id').notNull(),
    status: text('status', { enum: ['pending', 'accepted', 'rejected'] })
      .notNull()
      .default('pending'),
    at: text('at')
      .notNull()
      .$defaultFn(() => new Date().toISOString())
  },
  function constraints(invites) {
    return {
      primaryKey: primaryKey({
        name: 'invites_pkey',
        columns: [invites.userId, invites.auctionId]
      }),
      userReference: foreignKey({
        name: 'fk_user_id',
        columns: [invites.userId],
        foreignColumns: [users.id]
      })
        .onDelete('cascade')
        .onUpdate('cascade'),

      auctionReference: foreignKey({
        name: 'fk_auction_id',
        columns: [invites.auctionId],
        foreignColumns: [auctions.id]
      })
        .onDelete('cascade')
        .onUpdate('cascade'),

      userIndex: index('idx_user_id_invites').on(invites.userId),
      auctionIndex: index('idx_auction_id_invites').on(invites.auctionId)
    };
  }
);
