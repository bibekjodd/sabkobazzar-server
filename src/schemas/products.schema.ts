import { createId } from '@paralleldrive/cuid2';
import { foreignKey, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from './users.schema';

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
        columns: [products.id],
        foreignColumns: [users.id]
      }),
      usersIndex: index('products_idx_owner_id').on(products.ownerId)
    };
  }
);

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

export const selectProductSnapshot = {
  id: products.id,
  title: products.title,
  image: products.image,
  category: products.category,
  description: products.description,
  ownerId: products.ownerId,
  price: products.price,
  addedAt: products.addedAt
};
