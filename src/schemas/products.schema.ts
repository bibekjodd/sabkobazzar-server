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
    category: text('category', { enum: ['electronics', 'realestate', 'art', 'others'] })
      .notNull()
      .default('others'),
    description: text('desccription', { length: 500 }),
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
      usersIndex: index('products_idx_owner_id').on(products.ownerId)
    };
  }
);

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;
export const selectProductSnapshot = getTableColumns(products);
export const selectProductSchema = createSelectSchema(products);
export const responseProductSchema = selectProductSchema.extend({ owner: responesUserSchema });
export type ResponseProduct = z.infer<typeof responseProductSchema>;
