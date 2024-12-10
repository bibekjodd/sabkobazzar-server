import { createId } from '@paralleldrive/cuid2';
import { getTableColumns } from 'drizzle-orm';
import { foreignKey, index, primaryKey, sqliteTable } from 'drizzle-orm/sqlite-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { auctions } from './auctions.schema';
import { responseUserSchema, users } from './users.schema';

export const bids = sqliteTable(
  'bids',
  (t) => ({
    id: t.text('id').notNull().$defaultFn(createId),
    auctionId: t.text('auction_id').notNull(),
    bidderId: t.text('bidder_id').notNull(),
    createdAt: t
      .text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    amount: t.integer('amount').notNull()
  }),

  (bids) => [
    primaryKey({ name: 'bids_pkey', columns: [bids.id] }),
    foreignKey({
      name: 'fk_auction_id',
      columns: [bids.auctionId],
      foreignColumns: [auctions.id]
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      name: 'fk_bidder_id',
      columns: [bids.bidderId],
      foreignColumns: [users.id]
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    index('idx_auction_id_bids').on(bids.auctionId),
    index('idx_created_at_bids').on(bids.createdAt)
  ]
);

export type Bid = typeof bids.$inferSelect;
export type InsertBid = typeof bids.$inferInsert;
export const selectBidSnapshot = getTableColumns(bids);
export const selectBidSchema = createSelectSchema(bids);
export const responseBidSchema = selectBidSchema.extend({ bidder: responseUserSchema });
export type ResponseBid = z.infer<typeof responseBidSchema>;
