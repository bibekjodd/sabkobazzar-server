import { fetchBidsQuerySchema, placeBidSchema } from '@/dtos/bids.dto';
import { db } from '@/lib/database';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException
} from '@/lib/exceptions';
import { handleAsync } from '@/middlewares/handle-async';
import { auctions } from '@/schemas/auctions.schema';
import { bids, selectBidSnapshot } from '@/schemas/bids.schema';
import { participants } from '@/schemas/participants.schema';
import { selectUserSnapshot, users } from '@/schemas/users.schema';
import { and, asc, desc, eq, gt, gte, lt, max } from 'drizzle-orm';

export const placeBid = handleAsync<{ id: string }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  if (req.user.role === 'admin') throw new ForbiddenException("Admins can't place the bid");

  const auctionId = req.params.id;
  const [auction] = await db
    .select({ currentBid: max(bids.amount), minBid: auctions.minBid, startsAt: auctions.startsAt })
    .from(auctions)
    .innerJoin(
      participants,
      and(eq(auctions.id, participants.auctionId), eq(participants.userId, req.user.id))
    )
    .innerJoin(bids, eq(auctions.id, bids.auctionId))
    .where(
      and(
        eq(auctions.id, auctionId),
        eq(auctions.isFinished, false),
        eq(auctions.isCancelled, false),
        gte(auctions.startsAt, new Date().toISOString())
      )
    )
    .groupBy(auctions.id);

  if (!auction) throw new NotFoundException('Auction does not exist');

  const { amount } = placeBidSchema.parse(req.body);
  const currentBid = auction.currentBid || auction.minBid;
  if (amount < currentBid) throw new BadRequestException(`Bid must be higher than ${currentBid}`);
  const isAuctionEnded = Date.now() + 60 * 60 * 1000 > new Date(auction.startsAt).getTime();
  if (isAuctionEnded) throw new BadRequestException('Auction is already ended');

  await db.insert(bids).values({ amount, auctionId, bidderId: req.user.id });
  return res.json({ message: 'Bid placed successfully' });
});

export const fetchBids = handleAsync<{ id: string }>(async (req, res) => {
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
