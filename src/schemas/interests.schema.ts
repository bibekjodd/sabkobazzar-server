import { foreignKey, index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { products } from './products.schema';
import { users } from './users.schema';

export const interests = sqliteTable(
  'interests',
  {
    productId: text('product_id').notNull(),
    userId: text('user_id').notNull(),
    at: text('at')
      .notNull()
      .$defaultFn(() => new Date().toISOString())
  },
  function constraints(interests) {
    return {
      primaryKey: primaryKey({
        name: 'interests_pkey',
        columns: [interests.productId, interests.userId]
      }),
      productReference: foreignKey({
        name: 'fk_product_id',
        columns: [interests.productId],
        foreignColumns: [products.id]
      })
        .onDelete('cascade')
        .onUpdate('cascade'),
      userReference: foreignKey({
        name: 'fk_user_id',
        columns: [interests.userId],
        foreignColumns: [users.id]
      })
        .onDelete('cascade')
        .onUpdate('cascade'),

      indexProduct: index('idx_product_id_interests').on(interests.productId),
      indexUser: index('idx_user_id_intersts').on(interests.userId)
    };
  }
);
