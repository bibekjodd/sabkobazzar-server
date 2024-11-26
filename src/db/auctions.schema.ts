import { createId } from '@paralleldrive/cuid2';
import { getTableColumns } from 'drizzle-orm';
import { foreignKey, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { products, selectProductSchema } from './products.schema';
import { responesUserSchema, users } from './users.schema';

export const auctions = sqliteTable(
  'auctions',
  {
    id: text('id').notNull().$defaultFn(createId),
    title: text('title', { length: 200 }).notNull(),
    description: text('description', { length: 1000 }),
    isInviteOnly: integer('is_invite_only', { mode: 'boolean' }).notNull().default(false),
    banner: text('banner', { length: 300 }),
    lot: integer('lot').notNull(),
    condition: text('condition', { enum: ['new', 'first-class', 'repairable'] }).notNull(),
    productId: text('product_id').notNull(),
    ownerId: text('owner_id').notNull(),
    winnerId: text('winner_id'),
    startsAt: text('starts_at').notNull(),
    endsAt: text('ends_at').notNull(),
    minBid: integer('min_bid').notNull(),
    finalBid: integer('final_bid'),
    minBidders: integer('min_bidders').notNull().default(2),
    maxBidders: integer('max_bidders').notNull().default(10),
    isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
    isCancelled: integer('is_cancelled', { mode: 'boolean' }).notNull().default(false),
    isUnbidded: integer('is_unbidded', { mode: 'boolean' }).notNull().default(false)
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
      indexWinner: index('idx_winner_id_auctions').on(auctions.winnerId),
      indexStartsAt: index('idx_starts_at_auctions').on(auctions.startsAt),
      indexEndsAt: index('idx_ends_at_auctions').on(auctions.endsAt)
    };
  }
);

export type Auction = typeof auctions.$inferSelect;
export type InsertAuction = typeof auctions.$inferInsert;
export const selectAuctionsSnapshot = getTableColumns(auctions);
export const selectAuctionSchema = createSelectSchema(auctions);
export const responseAuctionSchema = selectAuctionSchema.extend({
  product: selectProductSchema.extend({ isInterested: z.boolean() }),
  owner: responesUserSchema,
  winner: responesUserSchema.nullable(),
  participationStatus: z.enum(['joined', 'invited', 'kicked', 'rejected']).nullable(),
  totalParticipants: z.number()
});
export type ResponseAuction = z.infer<typeof responseAuctionSchema>;
