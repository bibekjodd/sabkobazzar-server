import { addProductSchema, queryProductsSchema } from '@/dtos/products.dto';
import { db } from '@/lib/database';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException
} from '@/lib/exceptions';
import { handleAsync } from '@/middlewares/handle-async';
import { addProductNotification } from '@/notifications/products.notification';
import { products, selectProductSnapshot } from '@/schemas/products.schema';
import { selectUserSnapshot, users } from '@/schemas/users.schema';
import { and, desc, eq, gte, like, lt, lte } from 'drizzle-orm';

export const addProduct = handleAsync(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  if (req.user.role === 'admin') throw new ForbiddenException("Admins can't add product");

  const data = addProductSchema.parse(req.body);
  const [addedProduct] = await db
    .insert(products)
    .values({ ...data, ownerId: req.user.id })
    .returning();

  if (!addedProduct) throw new BadRequestException('Could not add product at the moment');
  addProductNotification({
    user: req.user,
    product: addedProduct
  });
  return res.status(201).json({ product: addedProduct, message: 'Product added successfully' });
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

export const getProductDetails = handleAsync<{ id: string }>(async (req, res) => {
  const productId = req.params.id;
  const [product] = await db
    .select({ ...selectProductSnapshot, owner: selectUserSnapshot })
    .from(products)
    .innerJoin(users, eq(products.ownerId, users.id))
    .where(eq(products.id, productId));
  if (!product) throw new NotFoundException('Product not found');

  return res.json({ product });
});
