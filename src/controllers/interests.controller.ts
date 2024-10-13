import { queryInterestsSchema } from '@/dtos/interests.dto';
import { db } from '@/lib/database';
import { NotFoundException, UnauthorizedException } from '@/lib/exceptions';
import { handleAsync } from '@/middlewares/handle-async';
import { interests } from '@/schemas/interests.schema';
import { products, ResponseProduct, selectProductSnapshot } from '@/schemas/products.schema';
import { selectUserSnapshot, users } from '@/schemas/users.schema';
import { and, eq, lt } from 'drizzle-orm';

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

export const fetchInterestedList = handleAsync<unknown, { interests: ResponseProduct[] }>(
  async (req, res) => {
    if (!req.user) throw new UnauthorizedException();

    const { limit, cursor } = queryInterestsSchema.parse(req.query);
    const result = await db
      .select({ ...selectProductSnapshot, owner: selectUserSnapshot })
      .from(interests)
      .innerJoin(products, eq(interests.productId, products.id))
      .innerJoin(users, eq(products.ownerId, users.id))
      .where(and(eq(interests.userId, req.user.id), lt(interests.at, cursor)))
      .limit(limit);

    const finalResult: ResponseProduct[] = result.map((item) => ({ ...item, isInterested: true }));
    return res.json({ interests: finalResult });
  }
);
