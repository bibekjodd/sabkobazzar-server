import { getUpcomingAuctionsQuerySchema, registerAuctionSchema } from '@/dtos/auctions.dto';
import { db } from '@/lib/database';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException
} from '@/lib/exceptions';
import { handleAsync } from '@/middlewares/handle-async';
import { auctionNotification } from '@/notifications/auctions.notifications';
import { auctions, selectAuctionsSnapshot } from '@/schemas/auctions.schema';
import { products, selectProductSnapshot } from '@/schemas/products.schema';
import { selectUserSnapshot, users } from '@/schemas/users.schema';
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';

export const registerAuction = handleAsync<{ id: string }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  if (req.user.role === 'admin')
    throw new ForbiddenException('Admins are not allowed to register auction');

  const data = registerAuctionSchema.parse(req.body);
  const productId = req.params.id;

  const [product] = await db.select().from(products).where(eq(products.id, productId));
  if (!product) throw new NotFoundException('Product does not exist');
  if (product.ownerId !== req.user.id)
    throw new ForbiddenException('You can only register auction to the product owned by yourself');

  const pendingAuctions = await db
    .select({ id: auctions.id })
    .from(auctions)
    .where(and(eq(auctions.ownerId, req.user.id), eq(auctions.isFinished, false)));

  if (pendingAuctions.length >= 5)
    throw new ForbiddenException(
      "Can't register auction while 5 or more auctions are already pending"
    );

  const endsAt = new Date(new Date(data.startsAt).getTime() + 60 * 60 * 1000).toISOString();
  const [registeredAuction] = await db
    .insert(auctions)
    .values({ ...data, endsAt, ownerId: req.user.id, productId })
    .returning();
  if (!registeredAuction)
    throw new BadRequestException('Could not register product for auction at the moment');
  auctionNotification({
    auction: registeredAuction,
    product: product,
    user: req.user,
    type: 'register'
  });
  return res.status(201).json({ message: 'Product registered for auction successfully' });
});

export const getAuctionDetails = handleAsync<{ id: string }>(async (req, res) => {
  const auctionId = req.params.id;

  // todo join participants
  const [auction] = await db
    .select({
      ...selectAuctionsSnapshot,
      product: selectProductSnapshot,
      owner: selectUserSnapshot
    })
    .from(auctions)
    .innerJoin(products, eq(auctions.productId, products.id))
    .innerJoin(users, eq(auctions.ownerId, users.id))
    .where(eq(auctions.id, auctionId));
  if (!auction) throw new NotFoundException('Auction does not exist');

  return res.json({ auction });
});

export const cancelAuction = handleAsync<{ id: string }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();

  const auctionId = req.params.id;
  const [auction] = await db.select().from(auctions).where(eq(auctions.id, auctionId));

  if (!auction) throw new NotFoundException('Auction does not exist');
  if (auction.isFinished) throw new BadRequestException('Auction is already finished');
  if (auction.isCancelled) throw new BadRequestException('Auction is already cancelled');

  if (!(auction.ownerId === req.user.id || req.user.role === 'admin'))
    throw new ForbiddenException('Only product owner or admin can cancel the auction');

  await db.update(auctions).set({ isCancelled: true }).where(eq(auctions.id, auctionId));
  return res.json({ message: 'Auction cancelled successfully' });
});

export const getUpcomingAuctions = handleAsync(async (req, res) => {
  const { cursor, limit } = getUpcomingAuctionsQuerySchema.parse(req.query);

  const result = await db
    .select({
      ...selectAuctionsSnapshot,
      owner: selectUserSnapshot,
      product: selectProductSnapshot
    })
    .from(auctions)
    .where(
      and(
        gte(auctions.startsAt, cursor),
        eq(auctions.isFinished, false),
        eq(auctions.isCancelled, false)
      )
    )
    .innerJoin(products, eq(auctions.productId, products.id))
    .innerJoin(users, eq(auctions.ownerId, users.id))
    .limit(limit)
    .orderBy((t) => asc(t.startsAt));

  return res.json({ auctions: result });
});

export const getRecentAuctions = handleAsync(async (req, res) => {
  const result = await db
    .select({
      ...selectAuctionsSnapshot,
      owner: selectUserSnapshot,
      product: selectProductSnapshot
    })
    .from(auctions)
    .where(and(eq(auctions.isFinished, true), lte(auctions.endsAt, new Date().toISOString())))
    .innerJoin(products, eq(auctions.productId, products.id))
    .innerJoin(users, eq(auctions.ownerId, users.id))
    .orderBy((t) => desc(t.startsAt))
    .limit(10);

  return res.json({ auctions: result });
});
