import { createId } from '@paralleldrive/cuid2';
import { foreignKey, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { products } from './products.schema';
import { users } from './users.schema';

export const auctions = sqliteTable(
  'auctions',
  {
    id: text('id').notNull().$defaultFn(createId),
    productId: text('product_id').notNull(),
    ownerId: text('owner_id').notNull(),
    winnerId: text('winner_id'),
    startsAt: text('starts_at').notNull(),
    endsAt: text('ends_at').notNull(),
    minBid: integer('min_bid').notNull(),
    finalBid: integer('final_bid'),
    minBidders: integer('min_bidders').notNull().default(2),
    maxBidders: integer('max_bidders').notNull().default(10),
    isFinished: integer('is_finished', { mode: 'boolean' }).notNull().default(false),
    isCancelled: integer('is_cancelled', { mode: 'boolean' }).notNull().default(false)
  },
  function constraints(auctions) {
    return {
      primaryKey: primaryKey({ name: 'auctions_pkey', columns: [auctions.id] }),
      productReference: foreignKey({
        name: 'fk_product_id',
        columns: [auctions.productId],
        foreignColumns: [products.id]
      }).onUpdate('cascade'),
      ownerReference: foreignKey({
        name: 'fk_owner_id',
        columns: [auctions.ownerId],
        foreignColumns: [users.id]
      }).onUpdate('cascade'),
      winnerReference: foreignKey({
        name: 'fk_winner_id',
        columns: [auctions.winnerId],
        foreignColumns: [users.id]
      }).onUpdate('cascade'),

      indexProduct: index('idx_product_id_auctions').on(auctions.productId),
      indexOwner: index('idx_owner_id_auctions').on(auctions.ownerId),
      indexWinner: index('idx_winner_id_auctions').on(auctions.winnerId)
    };
  }
);

export type Auction = typeof auctions.$inferSelect;
export type InsertAuction = typeof auctions.$inferInsert;

export const selectAuctionsSnapshot = {
  id: auctions.id,
  productId: auctions.productId,
  ownerId: auctions.ownerId,
  winnerId: auctions.winnerId,
  startsAt: auctions.startsAt,
  endsAt: auctions.endsAt,
  minBid: auctions.minBid,
  finalBid: auctions.finalBid,
  minBidders: auctions.minBidders,
  maxBidders: auctions.maxBidders,
  isFinished: auctions.isFinished,
  isCancelled: auctions.isCancelled
};
