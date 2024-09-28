import { db } from '@/lib/database';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException
} from '@/lib/exceptions';
import { handleAsync } from '@/middlewares/handle-async';
import { participantNotification } from '@/notifications/participants.notification';
import { auctions, selectAuctionsSnapshot } from '@/schemas/auctions.schema';
import { participants } from '@/schemas/participants.schema';
import { products, selectProductSnapshot } from '@/schemas/products.schema';
import { selectUserSnapshot, users } from '@/schemas/users.schema';
import { and, eq, sql } from 'drizzle-orm';

export const fetchParticipants = handleAsync<{ id: string }>(async (req, res) => {
  const auctionId = req.params.id;
  const result = await db
    .select({ ...selectUserSnapshot })
    .from(participants)
    .where(eq(participants.auctionId, auctionId))
    .innerJoin(users, eq(participants.userId, users.id))
    .groupBy(participants.auctionId, participants.userId);

  return res.json({ participants: result });
});

export const joinAuction = handleAsync<{ id: string }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  if (req.user.role === 'admin') throw new ForbiddenException("Admins can't join the auction");

  const auctionId = req.params.id;
  const [auction] = await db
    .select({
      ...selectAuctionsSnapshot,
      totalParticipants: sql<number>`count(${participants.userId})`,
      product: selectProductSnapshot
    })
    .from(auctions)
    .innerJoin(participants, eq(auctions.id, participants.auctionId))
    .innerJoin(products, eq(auctions.productId, products.id))
    .where(eq(auctions.id, auctionId))
    .groupBy(auctions.id);

  if (!auction) throw new NotFoundException('Auction does not exist');
  if (auction.isCancelled) throw new BadRequestException('Auction is already cancelled');
  if (auction.isFinished) throw new BadRequestException('Auction is aleady completed');

  if (auction.totalParticipants >= auction.maxBidders)
    throw new BadRequestException('Auction has already reached the max participants limit');

  await db.insert(participants).values({ userId: req.user.id, auctionId });
  participantNotification({
    auction: auction,
    product: auction.product,
    type: 'join',
    user: req.user
  });

  return res.json({ message: 'Joined auction successfully' });
});

export const leaveAuction = handleAsync<{ id: string }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  if (req.user.role === 'admin') throw new ForbiddenException("Admins can't perform this action");

  const auctionId = req.params.id;
  const [auction] = await db
    .select({ ...selectAuctionsSnapshot })
    .from(participants)
    .innerJoin(
      auctions,
      and(eq(participants.userId, req.user.id), eq(participants.auctionId, auctionId))
    );

  if (!auction) throw new NotFoundException('Auction does not exist');
  if (auction.isCancelled) throw new BadRequestException('Auction is already cancelled');
  if (auction.isFinished) throw new BadRequestException('Auction is already completed');

  const startTime = new Date(auction.startsAt).getTime();
  const sixHoursFromNow = Date.now() + 6 * 60 * 60 * 1000;
  if (sixHoursFromNow > startTime)
    throw new ForbiddenException("Can't leave auction before 6 hours of starting");

  await db
    .delete(participants)
    .where(and(eq(auctions.id, auctionId), eq(participants.userId, req.user.id)));
  return res.json({ message: 'Left auction successfully' });
});

export const kickParticipant = handleAsync<{ auctionId: string; userId: string }>(
  async (req, res) => {
    if (!req.user) throw new UnauthorizedException();

    const auctionId = req.params.auctionId;
    const userId = req.params.userId;

    const participantPromise = db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .execute()
      .then((res) => res[0]);
    const auctionResultPromise = db
      .select({ ...selectAuctionsSnapshot, product: selectProductSnapshot })
      .from(auctions)
      .innerJoin(products, eq(auctions.productId, products.id))
      .where(
        and(
          eq(auctions.id, auctionId),
          eq(auctions.isFinished, false),
          eq(auctions.isCancelled, false)
        )
      )
      .groupBy(auctions.id)
      .execute()
      .then((res) => res[0]);

    const [participant, auction] = await Promise.all([participantPromise, auctionResultPromise]);

    if (!participant) throw new NotFoundException('Participant does not exist');
    if (!auction) throw new NotFoundException('Auction does not exist');
    const isStarted = Date.now() >= new Date(auction.startsAt).getTime();
    if (isStarted) throw new ForbiddenException("Can't kick bidder after the auction has started");

    if (!(req.user.role === 'admin' || req.user.id === auction.ownerId))
      throw new ForbiddenException('Only admin or product owner can kick the participant');

    await db
      .delete(participants)
      .where(and(eq(participants.auctionId, auctionId), eq(participants.userId, userId)));
    participantNotification({ auction, product: auction.product, type: 'kick', user: participant });

    return res.json({ message: 'Kicked participant successfully' });
  }
);
