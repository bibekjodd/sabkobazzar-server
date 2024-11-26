import { db } from '@/db';
import { auctions } from '@/db/auctions.schema';
import { interests } from '@/db/interests.schema';
import { products, ResponseProduct, selectProductSnapshot } from '@/db/products.schema';
import { selectUserSnapshot, users } from '@/db/users.schema';
import { addProductSchema, queryProductsSchema, updateProductSchema } from '@/dtos/products.dto';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException
} from '@/lib/exceptions';
import { encodeCursor } from '@/lib/utils';
import { handleAsync } from '@/middlewares/handle-async';
import { addProductNotification } from '@/notifications/products.notifications';
import { and, asc, desc, eq, gt, gte, like, lt, lte, or, SQL, sql } from 'drizzle-orm';

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

export const queryProducts = handleAsync<
  unknown,
  { cursor: string | undefined; products: ResponseProduct[] }
>(async (req, res) => {
  const parsedQueryResult = queryProductsSchema.parse(req.query);
  const { cursor, sort, limit, category, pricelte, pricegte, title, owner, interested } =
    parsedQueryResult;

  let cursorCondition: SQL<unknown> | undefined = lt(products.addedAt, new Date().toISOString());

  if ((sort === 'added_at_desc' || !sort) && cursor)
    cursorCondition = or(
      lt(products.addedAt, cursor.value),
      and(eq(products.addedAt, cursor.value), lt(products.id, cursor.id))
    );

  if (sort === 'added_at_asc' && cursor)
    cursorCondition = or(
      gt(products.addedAt, cursor.value),
      and(eq(products.addedAt, cursor.value), gt(products.id, cursor.id))
    );

  if (sort === 'title_asc' && cursor)
    cursorCondition = or(
      gt(products.title, cursor.value),
      and(eq(products.title, cursor.value), gt(products.id, cursor.id))
    );

  if (sort === 'title_desc' && cursor)
    cursorCondition = or(
      lt(products.title, cursor.value),
      and(eq(products.title, cursor.value), lt(products.id, cursor.id))
    );

  if (sort === 'price_asc' && cursor)
    cursorCondition = or(
      gt(products.price, Number(cursor.value)),
      and(eq(products.price, Number(cursor.value)), gt(products.id, cursor.id))
    );

  if (sort === 'price_desc' && cursor)
    cursorCondition = or(
      lt(products.price, Number(cursor.value)),
      and(eq(products.price, Number(cursor.value)), lt(products.id, cursor.id))
    );

  let query = db
    .select({
      ...selectProductSnapshot,
      owner: selectUserSnapshot,
      isInterested: sql<boolean>`${interests.productId}`
    })
    .from(products)
    .innerJoin(users, eq(products.ownerId, users.id))
    .where(
      and(
        title ? like(products.title, `%${title}%`) : undefined,
        category ? eq(products.category, category) : undefined,
        pricelte ? lte(products.price, pricelte) : undefined,
        pricegte ? gte(products.price, pricegte) : undefined,
        cursorCondition,
        owner ? eq(products.ownerId, owner) : undefined
      )
    )
    .orderBy((t) => {
      if (sort === 'title_asc') return [asc(t.title), asc(t.id)];
      else if (sort === 'title_desc') return [desc(t.title), desc(t.id)];
      else if (sort === 'price_asc') return [asc(t.price), asc(t.id)];
      else if (sort === 'price_desc') return [desc(t.price), desc(t.id)];
      else if (sort === 'added_at_asc') return [asc(t.addedAt), asc(t.id)];
      return [desc(t.addedAt), desc(t.id)];
    })
    .groupBy(products.id)
    .limit(limit);

  if (interested) {
    query = query.innerJoin(
      interests,
      and(eq(products.id, interests.productId), eq(interests.userId, req.user?.id || ''))
    );
  } else {
    query = query.leftJoin(
      interests,
      and(eq(products.id, interests.productId), eq(interests.userId, req.user?.id || ''))
    );
  }

  const result = await query.execute();
  const finalResult = result.map((item) => ({ ...item, isInterested: !!item.isInterested }));

  let responseCursor: string | undefined = undefined;
  const lastResult = finalResult[finalResult.length - 1];

  if (lastResult) {
    let cursorValue: unknown = lastResult.addedAt;
    if (sort === 'added_at_asc' || sort === 'added_at_desc') cursorValue = lastResult.addedAt;
    else if (sort === 'price_asc' || sort === 'price_desc') cursorValue = lastResult.price;
    else if (sort === 'title_asc' || sort === 'title_desc') cursorValue = lastResult.title;
    responseCursor = encodeCursor({ id: lastResult.id, value: cursorValue });
  }

  return res.json({ cursor: responseCursor, products: finalResult });
});

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
        eq(auctions.isCompleted, false),
        eq(auctions.isCancelled, false),
        gt(auctions.startsAt, new Date().toISOString())
      )
    )
    .groupBy(products.id);
  const isInterested = !!product?.isInterested;
  if (product)
    throw new ForbiddenException("Product can't be updated while the auction is pending");

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

export const setInterested = handleAsync<{ id: string }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  const productId = req.params.id;
  const [isSetInterested] = await db
    .insert(interests)
    .values({ productId, userId: req.user.id })
    .onConflictDoUpdate({
      target: [interests.userId, interests.productId],
      set: { at: new Date().toISOString() }
    })
    .returning();

  if (!isSetInterested) throw new NotFoundException('Product does not exist');

  return res.status(201).json({ message: 'Product set interested successfully' });
});

export const unsetInterested = handleAsync<{ id: string }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  const productId = req.params.id;
  const [isSetUnInterested] = await db
    .delete(interests)
    .where(and(eq(interests.productId, productId), eq(interests.userId, req.user.id)))
    .returning();

  if (!isSetUnInterested)
    throw new NotFoundException('Product does not exist is is already unset interested');

  return res.json({ message: 'Product unset interested successfully' });
});
