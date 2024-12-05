import { foreignKey, index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { auctions } from './auctions.schema';
import { users } from './users.schema';

export const interests = sqliteTable(
  'interests',
  {
    auctionId: text('auction_id').notNull(),
    userId: text('user_id').notNull(),
    at: text('at')
      .notNull()
      .$defaultFn(() => new Date().toISOString())
  },
  function constraints(interests) {
    return {
      primaryKey: primaryKey({
        name: 'interests_pkey',
        columns: [interests.auctionId, interests.userId]
      }),
      productReference: foreignKey({
        name: 'fk_auction_id',
        columns: [interests.auctionId],
        foreignColumns: [auctions.id]
      })
        .onDelete('cascade')
        .onUpdate('cascade'),
      userReference: foreignKey({
        name: 'fk_user_id',
        columns: [interests.userId],
        foreignColumns: [users.id]
      })
        .onDelete('cascade')
        .onUpdate('cascade'),

      indexProduct: index('idx_auction_id_interests').on(interests.auctionId),
      indexUser: index('idx_user_id_intersts').on(interests.userId),
      indexCreatedAt: index('idx_at_interests').on(interests.at)
    };
  }
);
