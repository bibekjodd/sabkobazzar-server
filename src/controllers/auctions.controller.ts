import { db } from '@/db';
import { auctions, ResponseAuction, selectAuctionsSnapshot } from '@/db/auctions.schema';
import { bids, ResponseBid, selectBidSnapshot } from '@/db/bids.schema';
import { interests } from '@/db/interests.schema';
import { kvs } from '@/db/kvs.schema';
import { participants, ParticipationStatus } from '@/db/participants.schema';
import { ResponseUser, selectUserSnapshot, User, users } from '@/db/users.schema';
import {
  cancelAuctionSchema,
  getBidsQuerySchema,
  joinAutionSchema,
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
import { stripe } from '@/lib/stripe';
import { encodeCursor, formatPrice } from '@/lib/utils';
import { handleAsync } from '@/middlewares/handle-async';
import {
  findAuctionDetails,
  findAuctionParticipants,
  inviteParticipantToAuction
} from '@/services/auctions.services';
import {
  auctionParticipantNotification,
  cancelAuctionNotifications,
  registerAuctionNotification
} from '@/services/notifications.service';
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
  sql,
  SQL
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

export const registerAuction = handleAsync<unknown, { auction: ResponseAuction; message: string }>(
  async (req, res) => {
    if (!req.user) throw new UnauthorizedException();
    if (req.user.role === 'admin')
      throw new ForbiddenException('Admins are not allowed to register auction');

    const data = registerAuctionSchema.parse(req.body);

    const pendingAuctions = await db
      .select({ id: auctions.id })
      .from(auctions)
      .where(
        and(
          eq(auctions.ownerId, req.user.id),
          gt(auctions.startsAt, new Date().toISOString()),
          ne(auctions.status, 'cancelled')
        )
      )
      .limit(5)
      .execute()
      .then((res) => res.length);

    if (pendingAuctions >= 5)
      throw new ForbiddenException(
        "Can't register auction while 5 or more auctions are already pending"
      );

    const endsAt = new Date(new Date(data.startsAt).getTime() + MILLIS.HOUR).toISOString();
    const [registeredAuction] = await db
      .insert(auctions)
      .values({ ...data, endsAt, ownerId: req.user.id })
      .returning();
    if (!registeredAuction) throw new InternalServerException();

    await registerAuctionNotification({
      auction: registeredAuction,
      user: req.user
    });
    const [owner] = await db.select().from(users).where(eq(users.id, registeredAuction.ownerId));
    return res.status(201).json({
      message: 'Auction registered successfully',
      auction: {
        ...registeredAuction,
        owner: owner!,
        winner: null,
        participationStatus: null,
        totalParticipants: 0,
        isInterested: false
      }
    });
  }
);

export const getAuctionDetails = handleAsync<{ id: string }, { auction: ResponseAuction }>(
  async (req, res) => {
    const auctionId = req.params.id;
    const auction = await findAuctionDetails({ auctionId, userId: req.user?.id || '' });
    return res.json({ auction });
  }
);

export const cancelAuction = handleAsync<{ id: string }, { message: string }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();

  const auctionId = req.params.id;
  const auction = await findAuctionDetails({ auctionId: auctionId, userId: req.user.id });

  const { reason } = cancelAuctionSchema.parse(req.body);

  if (auction.status === 'completed' || auction.status === 'unbidded')
    throw new BadRequestException('Auction is already completed');
  if (auction.status === 'cancelled') throw new BadRequestException('Auction is already cancelled');

  if (!(auction.ownerId === req.user.id || req.user.role === 'admin'))
    throw new ForbiddenException('Only auction host or admin can cancel the auction');

  await db
    .update(auctions)
    .set({ status: 'cancelled', cancelReason: reason })
    .where(eq(auctions.id, auctionId));

  findAuctionParticipants(auction.id).then((result) => {
    cancelAuctionNotifications({
      auction,
      users: [auction.owner, ...result]
    });
  });
  return res.json({ message: 'Auction cancelled successfully' });
});

export const queryAuctions = handleAsync<
  unknown,
  { cursor: string | undefined; auctions: ResponseAuction[] }
>(async (req, res) => {
  const query = queryAuctionsSchema.parse(req.query);

  if (query.resource === 'self' && !req.user) throw new UnauthorizedException();

  const currentDate = new Date();
  let statusCondition: SQL<unknown> | undefined = undefined;
  if (query.status === 'cancelled' || query.status === 'completed')
    statusCondition = eq(auctions.status, query.status);
  else if (query.status === 'pending')
    statusCondition = and(
      eq(auctions.status, 'pending'),
      gt(auctions.startsAt, currentDate.toISOString())
    );
  else if (query.status === 'live') {
    statusCondition = and(
      ne(auctions.status, 'cancelled'),
      and(
        gt(auctions.endsAt, currentDate.toISOString()),
        lt(auctions.startsAt, currentDate.toISOString())
      )
    );
  }

  let cursorCondition: SQL<unknown> | undefined = undefined;

  if (query.sort === 'bid_asc' && query.cursor)
    cursorCondition = or(
      gt(auctions.finalBid, Number(query.cursor.value)),
      and(eq(auctions.finalBid, Number(query.cursor.value)), gt(auctions.id, query.cursor.id))
    );

  if (query.sort === 'bid_desc' && query.cursor)
    cursorCondition = or(
      lt(auctions.finalBid, Number(query.cursor.value)),
      and(eq(auctions.finalBid, Number(query.cursor.value)), lt(auctions.id, query.cursor.id))
    );

  if (query.sort === 'title_asc' && query.cursor)
    cursorCondition = or(
      gt(auctions.title, query.cursor.value),
      and(eq(auctions.title, query.cursor.value), gt(auctions.id, query.cursor.id))
    );

  if (query.sort === 'title_desc' && query.cursor)
    cursorCondition = or(
      lt(auctions.title, query.cursor.value),
      and(eq(auctions.title, query.cursor.value), lt(auctions.id, query.cursor.id))
    );

  if (query.sort === 'starts_at_asc' && query.cursor)
    cursorCondition = or(
      gt(auctions.startsAt, query.cursor.value),
      and(eq(auctions.startsAt, query.cursor.value), gt(auctions.id, query.cursor.id))
    );

  if ((query.sort === 'starts_at_desc' || !query.sort) && query.cursor)
    cursorCondition = or(
      lt(auctions.startsAt, query.cursor.value),
      and(eq(auctions.startsAt, query.cursor.value), lt(auctions.id, query.cursor.id))
    );

  const participant = alias(participants, 'participant');
  const winner = alias(users, 'winner');
  const result = await db
    .select({
      ...selectAuctionsSnapshot,
      owner: selectUserSnapshot,
      winner: getTableColumns(winner),
      participationStatus: participant.status,
      totalParticipants: count(participants.userId),
      isInterested: sql<boolean>`${interests.auctionId}`
    })
    .from(auctions)
    .where(
      and(
        query.title
          ? or(
              like(auctions.title, `%${query.title}%`),
              like(auctions.title, auctions.productTitle)
            )
          : undefined,
        query.owner ? eq(auctions.ownerId, query.owner) : undefined,
        query.category ? eq(auctions.category, query.category) : undefined,
        query.from ? gte(auctions.startsAt, query.from) : undefined,
        query.to ? lte(auctions.startsAt, query.to) : undefined,
        query.inviteOnly === true || query.inviteOnly === false
          ? eq(auctions.isInviteOnly, query.inviteOnly)
          : undefined,
        query.condition ? eq(auctions.condition, query.condition) : undefined,
        statusCondition,
        cursorCondition,
        query.unbidded === true || query.unbidded === false
          ? eq(auctions.status, 'unbidded')
          : undefined,
        query.resource === 'self' ? eq(auctions.ownerId, req.user?.id || '') : undefined
      )
    )
    .leftJoin(
      interests,
      and(eq(auctions.id, interests.auctionId), eq(interests.userId, req.user?.id || ''))
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
    .limit(query.limit)
    .orderBy((t) => {
      if (query.sort === 'bid_asc') return [asc(t.finalBid), asc(t.id)];
      else if (query.sort === 'bid_desc') return [desc(t.finalBid), desc(t.id)];
      else if (query.sort === 'title_asc') return [asc(t.title), asc(t.id)];
      else if (query.sort === 'title_desc') return [desc(t.title), desc(t.id)];
      else if (query.sort === 'starts_at_asc') return [asc(t.startsAt), asc(t.id)];
      return [desc(t.startsAt), desc(t.id)];
    });

  const finalResult: ResponseAuction[] = result.map((auction) => ({
    ...auction,
    isInterested: !!auction.isInterested
  }));

  const lastResult = finalResult.at(finalResult.length - 1);
  let cursor: string | undefined;
  if (lastResult) {
    let cursorValue: unknown = lastResult.startsAt;
    if (query.sort === 'starts_at_asc' || query.sort === 'starts_at_desc')
      cursorValue = lastResult.startsAt;
    else if (query.sort === 'bid_asc' || query.sort === 'bid_desc')
      cursorValue = lastResult.finalBid;
    else if (query.sort === 'title_asc' || query.sort === 'title_desc')
      cursorValue = lastResult.title;
    cursor = encodeCursor({ id: lastResult.id, value: cursorValue });
  }

  return res.json({ cursor, auctions: finalResult });
});

export const getAuctionParticipants = handleAsync<{ id: string }, { participants: ResponseUser[] }>(
  async (req, res) => {
    const auctionId = req.params.id;
    const result = await findAuctionParticipants(auctionId);
    return res.json({ participants: result });
  }
);

export type CheckoutMetadata = {
  userId: string;
  auctionId: string;
};
export const joinAuction = handleAsync<{ id: string }, { checkoutSessionId: string }>(
  async (req, res) => {
    if (!req.user) throw new UnauthorizedException();
    if (req.user.role === 'admin') throw new ForbiddenException("Admins can't join the auction");

    const auctionId = req.params.id;
    const { successUrl, cancelUrl } = joinAutionSchema.parse(req.body);

    const auctionCheckoutSessionKey = `auction-${auctionId}-checkout-session`;

    const [auction, sessionInfo] = await Promise.all([
      findAuctionDetails({ auctionId, userId: req.user.id }),

      db
        .select()
        .from(kvs)
        .where(eq(kvs.key, auctionCheckoutSessionKey))
        .limit(1)
        .execute()
        .then((res) => res[0])
    ]);

    if (!auction) throw new NotFoundException('Auction does not exist');
    if (auction.ownerId === req.user.id)
      throw new ForbiddenException('User is is the host of the auction');
    if (auction.participationStatus === 'joined')
      throw new BadRequestException('You have already joined the auction');
    if (auction.participationStatus === 'kicked')
      throw new BadRequestException('You are already kicked from the auction');
    if (auction.isInviteOnly && auction.participationStatus === 'rejected')
      throw new BadRequestException('You have already rejected the invitation');
    if (auction.isInviteOnly && auction.participationStatus !== 'invited')
      throw new BadRequestException('Only invited users can join the auction');

    if (auction.status === 'cancelled')
      throw new BadRequestException('Auction is already cancelled');
    if (auction.status === 'completed')
      throw new BadRequestException('Auction is aleady completed');
    if (Date.now() > new Date(auction.startsAt).getTime())
      throw new BadRequestException('Auction has already started');

    if (auction.totalParticipants >= auction.maxBidders)
      throw new BadRequestException('Auction has already reached the max participants limit');

    if (sessionInfo) {
      let previousCheckoutSessionId = undefined as string | undefined;
      if (typeof sessionInfo.value === 'object' && sessionInfo.value) {
        // @ts-expect-error ...
        previousCheckoutSessionId = sessionInfo.value.checkoutSessionId;
      }

      // expire checkout older than a minute
      if (
        previousCheckoutSessionId &&
        sessionInfo.createdAt <= new Date(Date.now() - MILLIS.MINUTE).toISOString()
      )
        await stripe.checkout.sessions.expire(previousCheckoutSessionId).catch(() => {});

      // check new checkout
      if (
        previousCheckoutSessionId &&
        sessionInfo.createdAt > new Date(Date.now() - MILLIS.MINUTE).toISOString() &&
        auction.totalParticipants >= auction.maxBidders - 1
      ) {
        await db.delete(kvs).where(eq(kvs.key, auctionCheckoutSessionKey)).execute();
        throw new BadRequestException('Auction has already reached the max participants limit');
      }
    }

    let images: string[] | undefined = undefined;
    for (const image of [auction.banner, ...(auction.productImages || [])]) {
      if (!image) continue;
      if (!images) images = [image];
      else images.push(image);
    }
    if (images?.length === 0) images = undefined;

    const checkoutSession = await stripe.checkout.sessions.create({
      metadata: { auctionId, userId: req.user.id } satisfies CheckoutMetadata,
      customer_email: req.user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'npr',
            unit_amount: auction.minBid * 30,
            product_data: {
              name: auction.title,
              description: 'Pay 30% fee before joining the auction',
              images
            }
          }
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      mode: 'payment'
    });

    await db
      .insert(kvs)
      .values({ key: auctionCheckoutSessionKey, value: { checkoutSessionId: checkoutSession.id } })
      .onConflictDoUpdate({
        target: [kvs.key],
        set: {
          createdAt: new Date().toISOString(),
          value: { checkoutSessionId: checkoutSession.id }
        }
      });

    return res.json({ checkoutSessionId: checkoutSession.id });
  }
);

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
  if (auction.status === 'cancelled') throw new BadRequestException('Auction is already cancelled');
  if (auction.status === 'completed') throw new BadRequestException('Auction is already completed');

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
  const auctionResultPromise = findAuctionDetails({ userId, auctionId });

  const [participant, auction] = await Promise.all([participantPromise, auctionResultPromise]);

  if (!participant) throw new NotFoundException('Participant does not exist');
  const isStarted = Date.now() >= new Date(auction.startsAt).getTime();
  if (isStarted) throw new ForbiddenException("Can't kick bidder after the auction has started");
  if (!(req.user.role === 'admin' || req.user.id === auction.ownerId))
    throw new ForbiddenException('Only admin or auction host can kick the participant');
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
          ne(auctions.status, 'completed'),
          ne(auctions.status, 'cancelled'),
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
  const query = getBidsQuerySchema.parse(req.query);
  const result = await db
    .select({ ...selectBidSnapshot, bidder: selectUserSnapshot })
    .from(bids)
    .innerJoin(users, eq(bids.bidderId, users.id))
    .groupBy(bids.id)
    .where(
      and(
        eq(bids.auctionId, auctionId),
        query.cursor && query.sort === 'asc'
          ? or(
              gt(bids.createdAt, query.cursor.value),
              and(eq(bids.createdAt, query.cursor.value), gt(bids.id, query.cursor.id))
            )
          : undefined,
        query.cursor && query.sort === 'desc'
          ? or(
              lt(bids.createdAt, query.cursor.value),
              and(eq(bids.createdAt, query.cursor.value), lt(bids.id, query.cursor.id))
            )
          : undefined
      )
    )
    .orderBy((t) => {
      if (query.sort === 'asc') return [asc(t.createdAt), asc(t.id)];
      return [desc(t.createdAt), desc(t.id)];
    })
    .limit(query.limit);

  let cursor: string | undefined = undefined;
  const lastResult = result[result.length - 1];
  if (lastResult) cursor = encodeCursor({ id: lastResult.id, value: lastResult.createdAt });

  return res.json({ cursor, bids: result });
});

export const getBidsSnapshot = handleAsync<{ id: string }, { bids: ResponseBid[] }>(
  async (req, res) => {
    const auctionId = req.params.id;

    const result = await db
      .select({
        ...selectBidSnapshot,
        bidder: selectUserSnapshot,
        amount: max(bids.amount),
        at: max(bids.createdAt)
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
      createdAt: item.at || new Date().toISOString(),
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

  const query = searchInviteUsersSchema.parse(req.query);
  const offset = (query.page - 1) * query.limit;
  const result = await db
    .select({ ...selectUserSnapshot, status: participants.status })
    .from(users)
    .leftJoin(
      participants,
      and(eq(participants.auctionId, auctionId), eq(participants.userId, users.id))
    )
    .limit(query.limit)
    .offset(offset)
    .where(
      and(
        query.q
          ? or(like(users.name, `%${query.q}%`), like(users.email, `%${query.q}%`))
          : undefined,
        ne(users.id, req.user.id)
      )
    )
    .groupBy(users.id);
  return res.json({ users: result });
});

export const setInterested = handleAsync<{ id: string }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  const auctionId = req.params.id;
  const [isSetInterested] = await db
    .insert(interests)
    .values({ auctionId, userId: req.user.id })
    .onConflictDoUpdate({
      target: [interests.userId, interests.auctionId],
      set: { createdAt: new Date().toISOString() }
    })
    .returning();

  if (!isSetInterested) throw new NotFoundException('Auction does not exist');

  return res.status(201).json({ message: 'Auction set interested successfully' });
});

export const unsetInterested = handleAsync<{ id: string }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  const auctionId = req.params.id;
  const [isSetUnInterested] = await db
    .delete(interests)
    .where(and(eq(interests.auctionId, auctionId), eq(interests.userId, req.user.id)))
    .returning();

  if (!isSetUnInterested)
    throw new NotFoundException('Auction does not exist is is already unset interested');

  return res.json({ message: 'Auction unset interested successfully' });
});
