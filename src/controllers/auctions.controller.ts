import { db } from '@/db';
import { auctions, ResponseAuction, selectAuctionsSnapshot } from '@/db/auctions.schema';
import { bids, ResponseBid, selectBidSnapshot } from '@/db/bids.schema';
import { interests } from '@/db/interests.schema';
import { participants, ParticipationStatus } from '@/db/participants.schema';
import { products, selectProductSnapshot } from '@/db/products.schema';
import { ResponseUser, selectUserSnapshot, User, users } from '@/db/users.schema';
import {
  getBidsQuerySchema,
  placeBidSchema,
  queryAuctionsSchema,
  registerAuctionSchema,
  searchInviteUsersSchema
} from '@/dtos/auctions.dto';
import { MILLIS } from '@/lib/constants';
import { onBid } from '@/lib/events';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerException,
  NotFoundException,
  UnauthorizedException
} from '@/lib/exceptions';
import { encodeCursor, formatPrice } from '@/lib/utils';
import { handleAsync } from '@/middlewares/handle-async';
import {
  auctionParticipantNotification,
  cancelAuctionNotifications,
  registerAuctionNotification
} from '@/notifications/auctions.notifications';
import {
  auctionDetails,
  findAuctionParticipants,
  inviteParticipantToAuction
} from '@/services/auctions.services';
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  gte,
  like,
  lt,
  lte,
  max,
  ne,
  or,
  SQL,
  sql
} from 'drizzle-orm';
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
    .where(
      and(
        eq(auctions.ownerId, req.user.id),
        eq(auctions.isCompleted, false),
        gt(auctions.startsAt, new Date().toISOString())
      )
    );

  if (pendingAuctions.length >= 5)
    throw new ForbiddenException(
      "Can't register auction while 5 or more auctions are already pending"
    );

  const endsAt = new Date(new Date(data.startsAt).getTime() + MILLIS.HOUR).toISOString();
  const [registeredAuction] = await db
    .insert(auctions)
    .values({ ...data, endsAt, ownerId: req.user.id, productId })
    .returning();
  if (!registeredAuction) throw new InternalServerException();

  await registerAuctionNotification({
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
  if (auction.isCompleted) throw new BadRequestException('Auction is already completed');
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

export const queryAuctions = handleAsync<
  unknown,
  { cursor: string | undefined; auctions: ResponseAuction[] }
>(async (req, res) => {
  const {
    cursor,
    limit,
    owner,
    product,
    sort,
    condition,
    from,
    inviteOnly,
    status,
    to,
    unbidded,
    title
  } = queryAuctionsSchema.parse(req.query);

  const currentDate = new Date();
  let statusCondition: SQL<unknown> | undefined = undefined;
  if (status === 'cancelled') statusCondition = eq(auctions.isCancelled, true);
  else if (status === 'completed') statusCondition = eq(auctions.isCompleted, true);
  else if (status === 'pending') {
    statusCondition = and(
      eq(auctions.isCancelled, false),
      eq(auctions.isCompleted, false),
      gt(auctions.startsAt, currentDate.toISOString())
    );
  } else if (status === 'live') {
    statusCondition = and(
      eq(auctions.isCancelled, false),
      eq(auctions.isCompleted, false),
      and(
        gt(auctions.endsAt, currentDate.toISOString()),
        lt(auctions.startsAt, currentDate.toISOString())
      )
    );
  }

  let cursorCondition: SQL<unknown> | undefined = lt(
    auctions.startsAt,
    new Date(Date.now() + MILLIS.MONTH).toISOString()
  );

  if (sort === 'bid_asc' && cursor)
    cursorCondition = or(
      gt(auctions.finalBid, Number(cursor.value)),
      and(eq(auctions.finalBid, Number(cursor.value)), gt(auctions.id, cursor.id))
    );

  if (sort === 'bid_desc' && cursor)
    cursorCondition = or(
      lt(auctions.finalBid, Number(cursor.value)),
      and(eq(auctions.finalBid, Number(cursor.value)), lt(auctions.id, cursor.id))
    );

  if (sort === 'title_asc' && cursor)
    cursorCondition = or(
      gt(auctions.title, cursor.value),
      and(eq(auctions.title, cursor.value), gt(auctions.id, cursor.id))
    );

  if (sort === 'title_desc' && cursor)
    cursorCondition = or(
      lt(auctions.title, cursor.value),
      and(eq(auctions.title, cursor.value), lt(auctions.id, cursor.id))
    );

  if (sort === 'starts_at_asc' && cursor)
    cursorCondition = or(
      gt(auctions.startsAt, cursor.value),
      and(eq(auctions.startsAt, cursor.value), gt(auctions.id, cursor.id))
    );

  if ((sort === 'starts_at_desc' || !sort) && cursor)
    cursorCondition = or(
      lt(auctions.startsAt, cursor.value),
      and(eq(auctions.startsAt, cursor.value), lt(auctions.id, cursor.id))
    );

  const participant = alias(participants, 'participant');
  const winner = alias(users, 'winner');
  const result = await db
    .select({
      ...selectAuctionsSnapshot,
      owner: selectUserSnapshot,
      product: { ...selectProductSnapshot, isInterested: sql<boolean>`${interests.productId}` },
      winner: getTableColumns(winner),
      participationStatus: participant.status,
      totalParticipants: count(participants.userId)
    })
    .from(auctions)
    .where(
      and(
        title ? like(auctions.title, `%${title}%`) : undefined,
        owner ? eq(auctions.ownerId, owner) : undefined,
        product ? eq(auctions.productId, product) : undefined,
        from ? gte(auctions.startsAt, from) : undefined,
        to ? lte(auctions.startsAt, to) : undefined,
        inviteOnly === true || inviteOnly === false
          ? eq(auctions.isInviteOnly, inviteOnly)
          : undefined,
        condition ? eq(auctions.condition, condition) : undefined,
        statusCondition,
        cursorCondition,
        unbidded === true || unbidded === false ? eq(auctions.isUnbidded, unbidded) : undefined
      )
    )
    .innerJoin(products, eq(auctions.productId, products.id))
    .leftJoin(
      interests,
      and(eq(products.id, interests.productId), eq(interests.userId, req.user?.id || ''))
    )
    .innerJoin(users, eq(auctions.ownerId, users.id))
    .leftJoin(
      participants,
      and(eq(auctions.id, participants.auctionId), eq(participants.status, 'joined'))
    )
    .leftJoin(
      participant,
      and(eq(auctions.id, participant.auctionId), eq(participant.userId, req.user?.id || ''))
    )
    .leftJoin(winner, eq(auctions.winnerId, winner.id))
    .groupBy(auctions.id)
    .limit(limit)
    .orderBy((t) => {
      if (sort === 'bid_asc') return [asc(t.finalBid), asc(t.id)];
      else if (sort === 'bid_desc') return [desc(t.finalBid), desc(t.id)];
      else if (sort === 'title_asc') return [asc(t.title), asc(t.id)];
      else if (sort === 'title_desc') return [desc(t.title), desc(t.id)];
      else if (sort === 'starts_at_asc') return [asc(t.startsAt), asc(t.id)];
      return [desc(t.startsAt), desc(t.id)];
    });

  const finalResult: ResponseAuction[] = result.map((item) => ({
    ...item,
    product: { ...item.product, isInterested: !!item.product.isInterested }
  }));

  const lastResult = finalResult.at(finalResult.length - 1);
  let responseCursor: string | undefined;
  if (lastResult) {
    let cursorValue: unknown = lastResult.startsAt;
    if (sort === 'starts_at_asc' || sort === 'starts_at_desc') cursorValue = lastResult.startsAt;
    else if (sort === 'bid_asc' || sort === 'bid_desc') cursorValue = lastResult.finalBid;
    else if (sort === 'title_asc' || sort === 'title_desc') cursorValue = lastResult.title;
    responseCursor = encodeCursor({ id: lastResult.id, value: cursorValue });
  }

  return res.json({ cursor: responseCursor, auctions: finalResult });
});

export const getAuctionParticipants = handleAsync<{ id: string }, { participants: ResponseUser[] }>(
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
  if (auction.isCompleted) throw new BadRequestException('Auction is aleady completed');
  if (Date.now() > new Date(auction.startsAt).getTime())
    throw new BadRequestException('Auction has already started');

  if (auction.totalParticipants >= auction.maxBidders)
    throw new BadRequestException('Auction has already reached the max participants limit');

  if (!auction.participationStatus) {
    await db.insert(participants).values({ userId: req.user.id, auctionId, status: 'joined' });
  }
  if (auction.participationStatus === 'invited') {
    await db
      .update(participants)
      .set({ status: 'joined', at: new Date().toISOString() })
      .where(and(eq(participants.auctionId, auctionId), eq(participants.userId, req.user.id)));
  }
  await auctionParticipantNotification({
    auction: auction,
    type: 'join',
    user: req.user
  });

  return res.json({
    message: 'Joined auction successfully',
    auction: {
      ...auction,
      totalParticipants: auction.totalParticipants + 1,
      participationStatus: 'joined'
    }
  });
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
  if (auction.isCompleted) throw new BadRequestException('Auction is already completed');

  const startTime = new Date(auction.startsAt).getTime();
  const sixHoursFromNow = Date.now() + 6 * MILLIS.HOUR;
  if (sixHoursFromNow > startTime)
    throw new ForbiddenException("Can't leave auction before 6 hours of starting");

  if (Date.now() > new Date(auction.startsAt).getTime())
    throw new BadRequestException('Auction is already started');

  await db
    .delete(participants)
    .where(and(eq(participants.auctionId, auctionId), eq(participants.userId, req.user.id)));

  await auctionParticipantNotification({ auction, type: 'leave', user: req.user });
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
    await auctionParticipantNotification({ auction, type: 'invite', user: participant });

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
  await auctionParticipantNotification({ auction, type: 'kick', user: participant });

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
        endsAt: auctions.endsAt
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
          eq(auctions.isCompleted, false),
          eq(auctions.isCancelled, false),
          lte(auctions.startsAt, new Date().toISOString())
        )
      );

    if (!auction) throw new NotFoundException('Auction does not exist');

    const { amount } = placeBidSchema.parse(req.body);
    if (auction.currentBid) {
      if (amount < auction.currentBid * 1.05)
        throw new BadRequestException(
          `Bid must be at least ${formatPrice(Math.round(auction.currentBid * 1.05))}`
        );
      if (amount > auction.currentBid * 1.5)
        throw new BadRequestException(
          `Bid should not exceed ${formatPrice(Math.round(auction.currentBid * 1.5))}`
        );
    }
    if (!auction.currentBid && amount < auction.minBid)
      throw new BadRequestException(`Bid must be at least ${formatPrice(auction.minBid)}`);

    const isAuctionEnded = new Date().toISOString() > auction.endsAt;
    if (isAuctionEnded) throw new BadRequestException('Auction has already ended');

    const [bid] = await db
      .insert(bids)
      .values({ amount, auctionId, bidderId: req.user.id })
      .returning();
    if (!bid) throw new InternalServerException();

    onBid(auctionId, { bid: { ...bid, bidder: req.user } });
    return res
      .status(201)
      .json({ message: 'Bid placed successfully', bid: { ...bid, bidder: req.user } });
  }
);

export const getBids = handleAsync<
  { id: string },
  { cursor: string | undefined; bids: ResponseBid[] }
>(async (req, res) => {
  const auctionId = req.params.id;
  const { cursor, limit, sort } = getBidsQuerySchema.parse(req.query);
  const result = await db
    .select({ ...selectBidSnapshot, bidder: selectUserSnapshot })
    .from(bids)
    .innerJoin(users, eq(bids.bidderId, users.id))
    .groupBy(bids.id)
    .where(
      and(
        eq(bids.auctionId, auctionId),
        cursor && sort === 'asc'
          ? or(gt(bids.at, cursor.value), and(eq(bids.at, cursor.value), gt(bids.id, cursor.id)))
          : undefined,
        cursor && sort === 'desc'
          ? or(lt(bids.at, cursor.value), and(eq(bids.at, cursor.value), lt(bids.id, cursor.id)))
          : undefined
      )
    )
    .orderBy((t) => {
      if (sort === 'asc') return [asc(t.at), asc(t.id)];
      return [desc(t.at), desc(t.id)];
    })
    .limit(limit);

  let responseCursor: string | undefined = undefined;
  const lastResult = result[result.length - 1];
  if (lastResult) responseCursor = encodeCursor({ id: lastResult.id, value: lastResult.at });

  return res.json({ cursor: responseCursor, bids: result });
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
      .leftJoin(bids, and(eq(bids.bidderId, users.id), eq(bids.auctionId, participants.auctionId)))
      .groupBy(participants.userId)
      .where(eq(participants.auctionId, auctionId))
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
