import { createId } from '@paralleldrive/cuid2';
import { getTableColumns } from 'drizzle-orm';
import { foreignKey, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { auctions } from './auctions.schema';
import { responesUserSchema, users } from './users.schema';

export const bids = sqliteTable(
  'bids',
  {
    id: text('id').notNull().$defaultFn(createId),
    auctionId: text('auction_id').notNull(),
    bidderId: text('bidder_id').notNull(),
    at: text('at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    amount: integer('amount').notNull()
  },
  function constraints(bids) {
    return {
      primaryKey: primaryKey({ name: 'bids_pkey', columns: [bids.id] }),
      auctionReference: foreignKey({
        name: 'fk_auction_id',
        columns: [bids.auctionId],
        foreignColumns: [auctions.id]
      })
        .onUpdate('cascade')
        .onDelete('cascade'),
      bidderReference: foreignKey({
        name: 'fk_bidder_id',
        columns: [bids.bidderId],
        foreignColumns: [users.id]
      })
        .onDelete('cascade')
        .onUpdate('cascade'),
      indexAuction: index('idx_auction_id_bids').on(bids.auctionId)
    };
  }
);

export type Bid = typeof bids.$inferSelect;
export type InsertBid = typeof bids.$inferInsert;
export const selectBidSnapshot = getTableColumns(bids);
export const selectBidSchema = createSelectSchema(bids);
export const responseBidSchema = selectBidSchema.extend({ bidder: responesUserSchema });
export type ResponseBid = z.infer<typeof responseBidSchema>;
