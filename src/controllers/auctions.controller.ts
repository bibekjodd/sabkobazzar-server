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
import { auctions, ResponseAuction, selectAuctionsSnapshot } from '@/schemas/auctions.schema';
import { interests } from '@/schemas/interests.schema';
import { invites } from '@/schemas/invites.schema';
import { participants } from '@/schemas/participants.schema';
import { products, selectProductSnapshot } from '@/schemas/products.schema';
import { selectUserSnapshot, User, users } from '@/schemas/users.schema';
import { getAuctionDetailsById, selectJsonArrayParticipants } from '@/services/auctions.services';
import { and, asc, desc, eq, getTableColumns, gt, lt, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

export const registerAuction = handleAsync<
  { id: string },
  { auction: ResponseAuction; message: string }
>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  if (req.user.role === 'admin')
    throw new ForbiddenException('Admins are not allowed to register auction');

  const data = registerAuctionSchema.parse(req.body);
  const productId = req.params.id;

  const [product] = await db
    .select({ ...selectProductSnapshot, isInterested: sql<boolean>`${interests.productId}` })
    .from(products)
    .leftJoin(
      interests,
      and(eq(products.id, interests.productId), eq(interests.userId, req.user.id))
    )
    .groupBy(products.id)
    .where(eq(products.id, productId));
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
  const [owner] = await db.select().from(users).where(eq(users.id, registeredAuction.ownerId));
  return res.status(201).json({
    message: 'Product registered for auction successfully',
    auction: {
      ...registeredAuction,
      owner: owner!,
      product,
      winner: null,
      participants: [],
      isInvited: false
    }
  });
});

export const getAuctionDetails = handleAsync<{ id: string }, { auction: ResponseAuction }>(
  async (req, res) => {
    const auctionId = req.params.id;
    const auction = await getAuctionDetailsById({ auctionId, userId: req.user?.id || '' });
    return res.json({ auction });
  }
);

export const cancelAuction = handleAsync<{ id: string }, { message: string }>(async (req, res) => {
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

export const getUpcomingAuctions = handleAsync<unknown, { auctions: ResponseAuction[] }>(
  async (req, res) => {
    const { cursor, limit, owner, product } = getUpcomingAuctionsQuerySchema.parse(req.query);
    const participant = alias(users, 'participant');
    const result = await db
      .select({
        ...selectAuctionsSnapshot,
        owner: selectUserSnapshot,
        product: { ...selectProductSnapshot, isInterested: sql<boolean>`${interests.productId}` },
        participants: selectJsonArrayParticipants(),
        isInvited: sql<boolean>`${invites.userId}`
      })
      .from(auctions)
      .where(
        and(
          gt(auctions.startsAt, cursor),
          eq(auctions.isFinished, false),
          eq(auctions.isCancelled, false),
          owner ? eq(auctions.ownerId, owner) : undefined,
          product ? eq(auctions.productId, product) : undefined
        )
      )
      .innerJoin(products, eq(auctions.productId, products.id))
      .leftJoin(
        interests,
        and(eq(products.id, interests.productId), eq(interests.userId, req.user?.id || ''))
      )
      .innerJoin(users, eq(auctions.ownerId, users.id))
      .leftJoin(participants, eq(auctions.id, participants.auctionId))
      .leftJoin(participant, eq(participants.userId, participant.id))
      .leftJoin(
        invites,
        and(eq(auctions.id, invites.auctionId), eq(invites.userId, req.user?.id || ''))
      )
      .groupBy(auctions.id)
      .limit(limit)
      .orderBy((t) => asc(t.startsAt));

    const finalResult: ResponseAuction[] = result.map((item) => ({
      ...item,
      winner: null,
      participants: (JSON.parse(item.participants) as User[]).filter(
        (participant) => !!participant.id
      ),
      isInvited: !!item.isInvited,
      product: { ...item.product, isInterested: !!item.product.isInterested }
    }));
    return res.json({ auctions: finalResult });
  }
);

export const getRecentAuctions = handleAsync<unknown, { auctions: ResponseAuction[] }>(
  async (req, res) => {
    const { limit, cursor, owner, product } = getUpcomingAuctionsQuerySchema.parse(req.query);
    const participant = alias(users, 'participant');
    const winner = alias(users, 'winner');
    const result = await db
      .select({
        ...selectAuctionsSnapshot,
        owner: selectUserSnapshot,
        product: { ...selectProductSnapshot, isInterested: sql<boolean>`${interests.productId}` },
        participants: selectJsonArrayParticipants(),
        winner: getTableColumns(winner)
      })
      .from(auctions)
      .where(
        and(
          eq(auctions.isFinished, true),
          lt(auctions.startsAt, cursor),
          owner ? eq(auctions.ownerId, owner) : undefined,
          product ? eq(auctions.productId, product) : undefined
        )
      )
      .innerJoin(products, eq(auctions.productId, products.id))
      .leftJoin(
        interests,
        and(eq(products.id, interests.productId), eq(interests.userId, req.user?.id || ''))
      )
      .innerJoin(users, eq(auctions.ownerId, users.id))
      .leftJoin(participants, eq(auctions.id, participants.auctionId))
      .leftJoin(participant, eq(participants.userId, participant.id))
      .leftJoin(winner, eq(auctions.winnerId, winner.id))
      .groupBy(auctions.id)
      .orderBy((t) => desc(t.startsAt))
      .limit(limit);

    const finalResult: ResponseAuction[] = result.map((item) => ({
      ...item,
      isInvited: false,
      participants: (JSON.parse(item.participants) as User[]).filter(
        (participant) => !!participant.id
      ),
      product: { ...item.product, isInterested: !!item.product.isInterested }
    }));
    return res.json({ auctions: finalResult });
  }
);
