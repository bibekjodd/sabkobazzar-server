import { addProductSchema, queryProductsSchema, updateProductSchema } from '@/dtos/products.dto';
import { db } from '@/lib/database';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException
} from '@/lib/exceptions';
import { handleAsync } from '@/middlewares/handle-async';
import { addProductNotification } from '@/notifications/products.notification';
import { auctions } from '@/schemas/auctions.schema';
import { interests } from '@/schemas/interests.schema';
import { products, ResponseProduct, selectProductSnapshot } from '@/schemas/products.schema';
import { selectUserSnapshot, users } from '@/schemas/users.schema';
import { and, desc, eq, gt, gte, like, lt, lte, sql } from 'drizzle-orm';

export const addProduct = handleAsync<unknown, { product: ResponseProduct; message: string }>(
  async (req, res) => {
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
    return res.status(201).json({
      product: { ...addedProduct, owner: req.user, isInterested: false },
      message: 'Product added successfully'
    });
  }
);

export const queryProducts = handleAsync<unknown, { products: ResponseProduct[] }>(
  async (req, res) => {
    const { cursor, limit, category, pricelte, pricegte, title, owner } = queryProductsSchema.parse(
      req.query
    );

    const result = await db
      .select({
        ...selectProductSnapshot,
        owner: selectUserSnapshot,
        isInterested: sql<boolean>`${interests.productId}`
      })
      .from(products)
      .innerJoin(users, eq(products.ownerId, users.id))
      .leftJoin(
        interests,
        and(eq(products.id, interests.productId), eq(interests.userId, req.user?.id || ''))
      )
      .where(
        and(
          title ? like(products.title, `%${title}%`) : undefined,
          category ? eq(products.category, category) : undefined,
          pricelte ? lte(products.price, pricelte) : undefined,
          pricegte ? gte(products.price, pricegte) : undefined,
          lt(products.addedAt, cursor),
          owner ? eq(products.ownerId, owner) : undefined
        )
      )
      .orderBy((t) => desc(t.addedAt))
      .limit(limit);

    const finalResult = result.map((item) => ({ ...item, isInterested: !!item.isInterested }));
    return res.json({ products: finalResult });
  }
);

export const getProductDetails = handleAsync<{ id: string }, { product: ResponseProduct }>(
  async (req, res) => {
    const productId = req.params.id;
    const [product] = await db
      .select({
        ...selectProductSnapshot,
        owner: selectUserSnapshot,
        isInterested: sql<boolean>`${interests.productId}`
      })
      .from(products)
      .innerJoin(users, eq(products.ownerId, users.id))
      .leftJoin(
        interests,
        and(eq(products.id, interests.productId), eq(interests.userId, req.user?.id || ''))
      )
      .where(eq(products.id, productId));
    if (!product) throw new NotFoundException('Product not found');
    product.isInterested = !!product.isInterested;
    return res.json({ product });
  }
);

export const updateProduct = handleAsync<
  { id: string },
  { product: ResponseProduct; message: string }
>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  const productId = req.params.id;

  const [product] = await db
    .select({ ...selectProductSnapshot, isInterested: sql<boolean>`${interests.productId}` })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.ownerId, req.user.id)))
    .leftJoin(
      interests,
      and(eq(products.id, interests.productId), eq(interests.userId, req.user.id))
    )
    .innerJoin(
      auctions,
      and(
        eq(products.id, auctions.productId),
        eq(auctions.isFinished, false),
        eq(auctions.isCancelled, false),
        gt(auctions.startsAt, new Date().toISOString())
      )
    )
    .groupBy(products.id);
  const isInterested = !!product?.isInterested;
  if (product) throw new ForbiddenException("Can't update product while auction is pending");

  const data = updateProductSchema.parse(req.body);
  const [updatedProduct] = await db
    .update(products)
    .set(data)
    .where(eq(products.id, productId))
    .returning();
  if (!updatedProduct) throw new NotFoundException('Product does not exist');
  return res.json({
    product: { ...updatedProduct, owner: req.user, isInterested },
    message: 'Product updated successfully'
  });
});
