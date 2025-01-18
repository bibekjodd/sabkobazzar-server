import { primaryKey, sqliteTable } from 'drizzle-orm/sqlite-core';

export const kvs = sqliteTable(
  'kvs',
  (t) => ({
    key: t.text('key').notNull(),
    value: t.text('value', { mode: 'json' }).notNull(),
    createdAt: t
      .text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    expiresAt: t.text('expires_at')
  }),
  (kvs) => [primaryKey({ name: 'kvs_pkey', columns: [kvs.key] })]
);
