import { createId } from '@paralleldrive/cuid2';
import { getTableColumns } from 'drizzle-orm';
import { foreignKey, index, primaryKey, sqliteTable } from 'drizzle-orm/sqlite-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { responseUserSchema, users } from './users.schema';

export const auctions = sqliteTable(
  'auctions',
  (t) => ({
    id: t.text().notNull().$defaultFn(createId),
    title: t.text({ length: 200 }).notNull(),
    description: t.text({ length: 1000 }),
    productTitle: t.text('product_title', { length: 200 }).notNull(),
    category: t
      .text({ enum: ['electronics', 'realestate', 'arts', 'others'] })
      .notNull()
      .default('others'),
    brand: t.text('product_brand', { length: 50 }),
    banner: t.text({ length: 300 }),
    productImages: t.text('product_images', { mode: 'json' }).$type<string[]>(),
    lot: t.integer().notNull(),
    condition: t.text({ enum: ['new', 'first-class', 'repairable'] }).notNull(),
    ownerId: t.text('owner_id').notNull(),
    winnerId: t.text('winner_id'),
    startsAt: t.text('starts_at').notNull(),
    endsAt: t.text('ends_at').notNull(),
    isInviteOnly: t.integer('is_invite_only', { mode: 'boolean' }).notNull().default(false),
    minBid: t.integer('min_bid').notNull(),
    finalBid: t.integer('final_bid'),
    minBidders: t.integer('min_bidders').notNull().default(2),
    maxBidders: t.integer('max_bidders').notNull().default(10),
    status: t.text({ enum: ['pending', 'cancelled', 'completed', 'unbidded'] }).default('pending'),
    cancelReason: t.text('cancel_reason', { length: 200 }),
    createdAt: t
      .text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString())
  }),

  (auctions) => [
    primaryKey({ name: 'auctions_pkey', columns: [auctions.id] }),
    foreignKey({
      name: 'fk_owner_id',
      columns: [auctions.ownerId],
      foreignColumns: [users.id]
    }).onUpdate('cascade'),
    foreignKey({
      name: 'fk_winner_id',
      columns: [auctions.winnerId],
      foreignColumns: [users.id]
    }).onUpdate('cascade'),

    index('idx_owner_id_auctions').on(auctions.ownerId),
    index('idx_winner_id_auctions').on(auctions.winnerId),
    index('idx_title_auctions').on(auctions.title),
    index('idx_product_title_auctions').on(auctions.productTitle),
    index('idx_starts_at_auctions').on(auctions.startsAt),
    index('idx_ends_at_auctions').on(auctions.endsAt)
  ]
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
