import { createProductSchema, queryProductsSchema } from '@/dtos/products.dto';
import { db } from '@/lib/database';
import { ForbiddenException, UnauthorizedException } from '@/lib/exceptions';
import { handleAsync } from '@/middlewares/handle-async';
import { products, selectProductSnapshot } from '@/schemas/products.schema';
import { selectUserSnapshot, users } from '@/schemas/users.schema';
import { and, desc, eq, gte, like, lt, lte } from 'drizzle-orm';

export const createProduct = handleAsync(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  if (req.user.role === 'admin') throw new ForbiddenException("Admins can't add product");

  const data = createProductSchema.parse(req.body);
  const [createdProduct] = await db
    .insert(products)
    .values({ ...data, ownerId: req.user.id })
    .returning();

  return res.json({ product: createdProduct, message: 'Product added successfully' });
});

export const queryProducts = handleAsync(async (req, res) => {
  const { cursor, limit, category, pricelte, pricegte, title } = queryProductsSchema.parse(
    req.query
  );

  const result = await db
    .select({ ...selectProductSnapshot, owner: selectUserSnapshot })
    .from(products)
    .innerJoin(users, eq(products.ownerId, users.id))
    .where(
      and(
        title ? like(products.title, `%${title}%`) : undefined,
        category ? eq(products.category, category) : undefined,
        pricelte ? lte(products.price, pricelte) : undefined,
        pricegte ? gte(products.price, pricegte) : undefined,
        lt(products.addedAt, cursor)
      )
    )
    .orderBy((t) => desc(t.addedAt))
    .limit(limit);

  return res.json({ products: result });
});
