import { foreignKey, index, primaryKey, sqliteTable } from 'drizzle-orm/sqlite-core';
import { auctions } from './auctions.schema';
import { users } from './users.schema';

export const interests = sqliteTable(
  'interests',
  (t) => ({
    auctionId: t.text('auction_id').notNull(),
    userId: t.text('user_id').notNull(),
    createdAt: t
      .text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString())
  }),

  (interests) => [
    primaryKey({
      name: 'interests_pkey',
      columns: [interests.auctionId, interests.userId]
    }),
    foreignKey({
      name: 'fk_auction_id',
      columns: [interests.auctionId],
      foreignColumns: [auctions.id]
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    foreignKey({
      name: 'fk_user_id',
      columns: [interests.userId],
      foreignColumns: [users.id]
    })
      .onDelete('cascade')
      .onUpdate('cascade'),

    index('idx_auction_id_interests').on(interests.auctionId),
    index('idx_user_id_intersts').on(interests.userId),
    index('idx_created_at_interests').on(interests.createdAt)
  ]
);
