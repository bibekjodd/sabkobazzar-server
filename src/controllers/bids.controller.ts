import { fetchBidsQuerySchema, placeBidSchema } from '@/dtos/bids.dto';
import { db } from '@/lib/database';
import { onBid } from '@/lib/events';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException
} from '@/lib/exceptions';
import { handleAsync } from '@/middlewares/handle-async';
import { auctions } from '@/schemas/auctions.schema';
import { bids, ResponseBid, selectBidSnapshot } from '@/schemas/bids.schema';
import { participants } from '@/schemas/participants.schema';
import { selectUserSnapshot, users } from '@/schemas/users.schema';
import { and, asc, desc, eq, gt, lt, lte, max } from 'drizzle-orm';

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
    const currentBid = auction.currentBid || auction.minBid - 1;
    if (amount <= currentBid)
      throw new BadRequestException(`Bid must be higher than ${currentBid}`);
    const isAuctionEnded = Date.now() > new Date(auction.startsAt).getTime() + 60 * 60 * 1000;
    if (isAuctionEnded) throw new BadRequestException('Auction is already ended');

    const [bid] = await db
      .insert(bids)
      .values({ amount, auctionId, bidderId: req.user.id })
      .returning();
    if (!bid) throw new BadRequestException('Could not place bid at the moment');
    onBid(auctionId, { bid: { ...bid, bidder: req.user } });
    return res.json({ message: 'Bid placed successfully', bid: { ...bid, bidder: req.user } });
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
