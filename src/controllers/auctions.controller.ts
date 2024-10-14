import {
  fetchBidsQuerySchema,
  placeBidSchema,
  queryAuctionsSchema,
  registerAuctionSchema,
  searchInviteUsersSchema
} from '@/dtos/auctions.dto';
import { db } from '@/lib/database';
import { onBid } from '@/lib/events';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException
} from '@/lib/exceptions';
import { handleAsync } from '@/middlewares/handle-async';
import {
  auctionParticipantNotification,
  cancelAuctionNotifications,
  registerAuctionNotification
} from '@/notifications/auctions.notifications';
import { auctions, ResponseAuction, selectAuctionsSnapshot } from '@/schemas/auctions.schema';
import { bids, ResponseBid, selectBidSnapshot } from '@/schemas/bids.schema';
import { interests } from '@/schemas/interests.schema';
import { participants, ParticipationStatus } from '@/schemas/participants.schema';
import { products, selectProductSnapshot } from '@/schemas/products.schema';
import { ResponseUser, selectUserSnapshot, User, users } from '@/schemas/users.schema';
import {
  auctionDetails,
  findAuctionParticipants,
  inviteParticipantToAuction
} from '@/services/auctions.services';
import { and, asc, desc, eq, gt, like, lt, lte, max, ne, or, sql } from 'drizzle-orm';
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
  registerAuctionNotification({
    auction: registeredAuction,
    user: req.user
  });
  const [owner] = await db.select().from(users).where(eq(users.id, registeredAuction.ownerId));
  return res.status(201).json({
    message: 'Product registered for auction successfully',
    auction: {
      ...registeredAuction,
      owner: owner!,
      product,
      winner: null,
      participationStatus: null,
      totalParticipants: 0
    }
  });
});

export const getAuctionDetails = handleAsync<{ id: string }, { auction: ResponseAuction }>(
  async (req, res) => {
    const auctionId = req.params.id;
    const auction = await auctionDetails({ auctionId, userId: req.user?.id || '' });
    return res.json({ auction });
  }
);

export const cancelAuction = handleAsync<{ id: string }, { message: string }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();

  const auctionId = req.params.id;
  const auction = await auctionDetails({ auctionId: auctionId, userId: req.user.id });

  if (!auction) throw new NotFoundException('Auction does not exist');
  if (auction.isFinished) throw new BadRequestException('Auction is already finished');
  if (auction.isCancelled) throw new BadRequestException('Auction is already cancelled');

  if (!(auction.ownerId === req.user.id || req.user.role === 'admin'))
    throw new ForbiddenException('Only product owner or admin can cancel the auction');

  await db.update(auctions).set({ isCancelled: true }).where(eq(auctions.id, auctionId));
  findAuctionParticipants(auction.id).then((result) => {
    cancelAuctionNotifications({
      auction,
      users: [req.user!, ...result]
    });
  });
  return res.json({ message: 'Auction cancelled successfully' });
});

export const queryAuctions = handleAsync<unknown, { auctions: ResponseAuction[] }>(
  async (req, res) => {
    const { cursor, limit, owner, product, order } = queryAuctionsSchema.parse(req.query);
    const participant = alias(participants, 'participant');
    const result = await db
      .select({
        ...selectAuctionsSnapshot,
        owner: selectUserSnapshot,
        product: { ...selectProductSnapshot, isInterested: sql<boolean>`${interests.productId}` },
        participationStatus: participant.status,
        totalParticipants: sql<number>`sum(case when ${participants.status}='joined' then 1 else 0 end)`
      })
      .from(auctions)
      .where(
        and(
          order === 'asc' ? gt(auctions.startsAt, cursor) : lt(auctions.startsAt, cursor),
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
      .leftJoin(
        participant,
        and(eq(auctions.id, participant.auctionId), eq(participant.userId, req.user?.id || ''))
      )
      .groupBy(auctions.id)
      .limit(limit)
      .orderBy((t) => (order === 'asc' ? asc(t.startsAt) : desc(t.startsAt)));

    const finalResult: ResponseAuction[] = result.map((item) => ({
      ...item,
      winner: null,
      product: { ...item.product, isInterested: !!item.product.isInterested }
    }));
    return res.json({ auctions: finalResult });
  }
);

export const fetchParticipants = handleAsync<{ id: string }, { participants: ResponseUser[] }>(
  async (req, res) => {
    const auctionId = req.params.id;
    const result = await findAuctionParticipants(auctionId);
    return res.json({ participants: result });
  }
);

export const joinAuction = handleAsync<
  { id: string },
  { auction: ResponseAuction; message: string }
>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  if (req.user.role === 'admin') throw new ForbiddenException("Admins can't join the auction");

  const auctionId = req.params.id;
  const auction = await auctionDetails({ auctionId, userId: req.user.id });

  if (!auction) throw new NotFoundException('Auction does not exist');
  if (auction.ownerId === req.user.id)
    throw new ForbiddenException('Now allowed to join the auction hosted by self');

  if (auction.participationStatus === 'joined')
    throw new BadRequestException('You have already joined the auction');
  if (auction.participationStatus === 'kicked')
    throw new BadRequestException('You are already kicked from the auction');
  if (auction.isInviteOnly && auction.participationStatus === 'rejected')
    throw new BadRequestException('You have already rejected the invitation');
  if (auction.isInviteOnly && auction.participationStatus !== 'invited')
    throw new BadRequestException('Only invited users can join the auction');

  if (auction.isCancelled) throw new BadRequestException('Auction is already cancelled');
  if (auction.isFinished) throw new BadRequestException('Auction is aleady completed');
  if (Date.now() > new Date(auction.startsAt).getTime())
    throw new BadRequestException('Auction has already started');

  if (auction.totalParticipants >= auction.maxBidders)
    throw new BadRequestException('Auction has already reached the max participants limit');

  await db
    .insert(participants)
    .values({ userId: req.user.id, auctionId, status: 'joined', at: new Date().toISOString() });
  auctionParticipantNotification({
    auction: auction,
    type: 'join',
    user: req.user
  });

  return res.json({ message: 'Joined auction successfully', auction });
});

export const leaveAuction = handleAsync<{ id: string }, { message: string }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  if (req.user.role === 'admin') throw new ForbiddenException("Admins can't perform this action");

  const auctionId = req.params.id;
  const [auction] = await db
    .select({ ...selectAuctionsSnapshot })
    .from(participants)
    .innerJoin(
      auctions,
      and(eq(participants.auctionId, auctions.id), eq(participants.status, 'joined'))
    )
    .where(and(eq(participants.auctionId, auctionId), eq(participants.userId, req.user.id)))
    .groupBy(auctions.id);

  if (!auction) throw new NotFoundException('Auction does not exist');
  if (auction.isCancelled) throw new BadRequestException('Auction is already cancelled');
  if (auction.isFinished) throw new BadRequestException('Auction is already completed');

  const startTime = new Date(auction.startsAt).getTime();
  const sixHoursFromNow = Date.now() + 6 * 60 * 60 * 1000;
  if (sixHoursFromNow > startTime)
    throw new ForbiddenException("Can't leave auction before 6 hours of starting");

  if (Date.now() > new Date(auction.startsAt).getTime())
    throw new BadRequestException('Auction is already started');

  await db
    .delete(participants)
    .where(and(eq(participants.auctionId, auctionId), eq(participants.userId, req.user.id)));

  auctionParticipantNotification({ auction, type: 'leave', user: req.user });
  return res.json({ message: 'Left auction successfully' });
});

export const inviteParticipant = handleAsync<{ userId: string; auctionId: string }>(
  async (req, res) => {
    if (!req.user) throw new UnauthorizedException();

    const { auctionId, userId } = req.params;
    const { auction, participant } = await inviteParticipantToAuction({
      auctionId,
      ownerId: req.user.id,
      userId
    });
    auctionParticipantNotification({ auction, type: 'invite', user: participant });

    return res.json({ message: 'User invited successfully' });
  }
);

export const kickParticipant = handleAsync<
  { auctionId: string; userId: string },
  { message: string }
>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();

  const auctionId = req.params.auctionId;
  const userId = req.params.userId;

  const participantPromise = db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .execute()
    .then((res) => res[0]);
  const auctionResultPromise = auctionDetails({ userId, auctionId });

  const [participant, auction] = await Promise.all([participantPromise, auctionResultPromise]);

  if (!participant) throw new NotFoundException('Participant does not exist');
  const isStarted = Date.now() >= new Date(auction.startsAt).getTime();
  if (isStarted) throw new ForbiddenException("Can't kick bidder after the auction has started");
  if (!(req.user.role === 'admin' || req.user.id === auction.ownerId))
    throw new ForbiddenException('Only admin or product owner can kick the participant');
  if (auction.participationStatus === 'kicked')
    throw new BadRequestException('User is already kicked from the auction');
  if (auction.participationStatus === 'rejected')
    throw new BadRequestException('User has already rejected the invitation');
  if (auction.participationStatus !== 'joined')
    throw new BadRequestException('User has not joined the auction');

  await db
    .update(participants)
    .set({ status: 'kicked' })
    .where(and(eq(participants.auctionId, auctionId), eq(participants.userId, userId)));
  auctionParticipantNotification({ auction, type: 'kick', user: participant });

  return res.json({ message: 'Kicked participant successfully' });
});

export const placeBid = handleAsync<{ id: string }, { bid: ResponseBid; message: string }>(
  async (req, res) => {
    if (!req.user) throw new UnauthorizedException();
    if (req.user.role === 'admin') throw new ForbiddenException("Admins can't place the bid");

    const auctionId = req.params.id;
    const [auction] = await db
      .select({
        currentBid: max(bids.amount),
        minBid: auctions.minBid,
        startsAt: auctions.startsAt
      })
      .from(auctions)
      .innerJoin(
        participants,
        and(eq(auctions.id, participants.auctionId), eq(participants.userId, req.user.id))
      )
      .leftJoin(bids, eq(bids.auctionId, auctions.id))
      .groupBy(auctions.id)
      .where(
        and(
          eq(auctions.id, auctionId),
          eq(auctions.isFinished, false),
          eq(auctions.isCancelled, false),
          lte(auctions.startsAt, new Date().toISOString())
        )
      );

    if (!auction) throw new NotFoundException('Auction does not exist');

    const { amount } = placeBidSchema.parse(req.body);
    if (auction.currentBid) {
      if (amount < auction.currentBid * 1.05)
        throw new BadRequestException(
          `Bid must be at least ${Math.round(auction.currentBid * 1.05)}`
        );
      if (amount > auction.currentBid * 1.5)
        throw new BadRequestException(
          `Bid should not exceed ${Math.round(auction.currentBid * 1.5)}`
        );
    }
    if (!auction.currentBid && amount < auction.minBid)
      throw new BadRequestException(`Bid must be at least ${auction.minBid}`);

    const isAuctionEnded = Date.now() > new Date(auction.startsAt).getTime() + 60 * 60 * 1000;
    if (isAuctionEnded) throw new BadRequestException('Auction is already ended');

    const [bid] = await db
      .insert(bids)
      .values({ amount, auctionId, bidderId: req.user.id })
      .returning();
    if (!bid) throw new BadRequestException('Could not place bid at the moment');
    onBid(auctionId, { bid: { ...bid, bidder: req.user } });
    return res
      .status(201)
      .json({ message: 'Bid placed successfully', bid: { ...bid, bidder: req.user } });
  }
);

export const fetchBids = handleAsync<{ id: string }, { bids: ResponseBid[] }>(async (req, res) => {
  const auctionId = req.params.id;
  const { cursor, limit, order } = fetchBidsQuerySchema.parse(req.query);
  const result = await db
    .select({ ...selectBidSnapshot, bidder: selectUserSnapshot })
    .from(bids)
    .innerJoin(users, eq(bids.bidderId, users.id))
    .groupBy(bids.id)
    .where(
      and(
        eq(bids.auctionId, auctionId),
        cursor && order === 'asc' ? gt(bids.at, cursor) : undefined,
        cursor && order === 'desc' ? lt(bids.at, cursor) : undefined
      )
    )
    .orderBy((t) => (order === 'asc' ? asc(t.at) : desc(t.at)))
    .limit(limit);

  return res.json({ bids: result });
});

export const getBidsSnapshot = handleAsync<{ id: string }, { bids: ResponseBid[] }>(
  async (req, res) => {
    const auctionId = req.params.id;

    const result = await db
      .select({
        ...selectBidSnapshot,
        bidder: selectUserSnapshot,
        amount: max(bids.amount),
        at: max(bids.at)
      })
      .from(participants)
      .innerJoin(users, eq(participants.userId, users.id))
      .leftJoin(bids, eq(bids.bidderId, users.id))
      .groupBy(participants.userId)
      .orderBy((t) => desc(t.amount));

    const finalResult: ResponseBid[] = result.map((item, i) => ({
      ...item,
      amount: item.amount || 0,
      at: item.at || new Date().toISOString(),
      auctionId,
      bidderId: item.bidder.id,
      id: item.id || i.toString()
    }));

    return res.json({ bids: finalResult });
  }
);

export const searchInviteUsers = handleAsync<
  { id: string },
  { users: Array<User & { status: ParticipationStatus }> }
>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  const auctionId = req.params.id;

  const { limit, page, q } = searchInviteUsersSchema.parse(req.query);
  const offset = (page - 1) * limit;
  const result = await db
    .select({ ...selectUserSnapshot, status: participants.status })
    .from(users)
    .leftJoin(
      participants,
      and(eq(participants.auctionId, auctionId), eq(participants.userId, users.id))
    )
    .limit(limit)
    .offset(offset)
    .where(
      and(
        q ? or(like(users.name, `%${q}%`), like(users.email, `%${q}%`)) : undefined,
        ne(users.id, req.user.id)
      )
    )
    .groupBy(users.id);
  return res.json({ users: result });
});
