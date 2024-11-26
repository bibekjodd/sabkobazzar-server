import { createId } from '@paralleldrive/cuid2';
import { getTableColumns } from 'drizzle-orm';
import { foreignKey, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { responesUserSchema, users } from './users.schema';

export const products = sqliteTable(
  'products',
  {
    id: text('id').notNull().$defaultFn(createId),
    title: text('title', { length: 200 }).notNull(),
    image: text('image', { length: 200 }),
    category: text('category', { enum: ['electronics', 'realestate', 'arts', 'others'] })
      .notNull()
      .default('others'),
    description: text('description', { length: 1000 }),
    ownerId: text('owner_id').notNull(),
    price: integer('price').notNull(),
    addedAt: text('added_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString())
  },
  function constraints(products) {
    return {
      primakeykey: primaryKey({ name: 'product_pkey', columns: [products.id] }),
      userReference: foreignKey({
        name: 'users_fkey',
        columns: [products.ownerId],
        foreignColumns: [users.id]
      }),
      indexOwner: index('idx_owner_id_products').on(products.ownerId),
      indexAddedAt: index('idx_added_at_products').on(products.addedAt)
    };
  }
);

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;
export const selectProductSnapshot = getTableColumns(products);
export const selectProductSchema = createSelectSchema(products);
export const responseProductSchema = selectProductSchema.extend({
  owner: responesUserSchema,
  isInterested: z.boolean()
});
export type ResponseProduct = z.infer<typeof responseProductSchema>;
