import { createId } from '@paralleldrive/cuid2';
import { getTableColumns } from 'drizzle-orm';
import { foreignKey, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { responseUserSchema, users } from './users.schema';

export const auctions = sqliteTable(
  'auctions',
  {
    id: text('id').notNull().$defaultFn(createId),
    title: text('title', { length: 200 }).notNull(),
    description: text('description', { length: 1000 }),
    productTitle: text('product_title', { length: 200 }).notNull(),
    category: text('category', { enum: ['electronics', 'realestate', 'arts', 'others'] })
      .notNull()
      .default('others'),
    brand: text('product_brand', { length: 50 }),
    banner: text('banner', { length: 300 }),
    productImages: text('product_images', { mode: 'json' }).$type<string[]>(),
    lot: integer('lot').notNull(),
    condition: text('condition', { enum: ['new', 'first-class', 'repairable'] }).notNull(),
    ownerId: text('owner_id').notNull(),
    winnerId: text('winner_id'),
    startsAt: text('starts_at').notNull(),
    endsAt: text('ends_at').notNull(),
    isInviteOnly: integer('is_invite_only', { mode: 'boolean' }).notNull().default(false),
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

      indexOwner: index('idx_owner_id_auctions').on(auctions.ownerId),
      indexWinner: index('idx_winner_id_auctions').on(auctions.winnerId),
      indexTitle: index('idx_title_auctions').on(auctions.title),
      indexProductTitle: index('idx_product_title_auctions').on(auctions.productTitle),
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
  isInterested: z.boolean(),
  productImages: z.array(z.string()).nullable(),
  owner: responseUserSchema,
  winner: responseUserSchema.nullable(),
  participationStatus: z.enum(['joined', 'invited', 'kicked', 'rejected']).nullable(),
  totalParticipants: z.number()
});
export type ResponseAuction = z.infer<typeof responseAuctionSchema>;
