import { db } from '@/lib/database';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException
} from '@/lib/exceptions';
import { handleAsync } from '@/middlewares/handle-async';
import { participantNotification } from '@/notifications/participants.notification';
import { auctions, ResponseAuction, selectAuctionsSnapshot } from '@/schemas/auctions.schema';
import { invites } from '@/schemas/invites.schema';
import { participants } from '@/schemas/participants.schema';
import { products, selectProductSnapshot } from '@/schemas/products.schema';
import { ResponseUser, users } from '@/schemas/users.schema';
import { getAuctionDetailsById } from '@/services/auctions.services';
import { inviteParticipantToAuction } from '@/services/invites.services';
import { findAuctionParticipants } from '@/services/participants.services';
import { and, eq } from 'drizzle-orm';

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
  const auction = await getAuctionDetailsById(auctionId);

  if (!auction) throw new NotFoundException('Auction does not exist');
  if (auction.ownerId === req.user.id)
    throw new ForbiddenException('Now allowed to join the auction hosted by self');

  const isJoined = auction.participants.find((user) => user.id === req.user?.id);
  if (isJoined) throw new BadRequestException('You have already joined the auction');

  if (auction.isInviteOnly) {
    const [isInvited] = await db
      .select()
      .from(invites)
      .where(and(eq(invites.auctionId, auctionId), eq(invites.userId, req.user.id)));
    if (!isInvited) throw new ForbiddenException('Only invited users can join the auction');
  }

  if (auction.isCancelled) throw new BadRequestException('Auction is already cancelled');
  if (auction.isFinished) throw new BadRequestException('Auction is aleady completed');

  if (auction.participants.length >= auction.maxBidders)
    throw new BadRequestException('Auction has already reached the max participants limit');

  await db.insert(participants).values({ userId: req.user.id, auctionId });
  auction.participants.push(req.user);
  participantNotification({
    auction: auction,
    type: 'join',
    user: req.user
  });

  return res.json({ message: 'Joined auction successfully', auction });
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
    participantNotification({ auction, type: 'invite', user: participant });

    return res.json({ message: 'User invited successfully' });
  }
);

export const leaveAuction = handleAsync<{ id: string }, { message: string }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  if (req.user.role === 'admin') throw new ForbiddenException("Admins can't perform this action");

  const auctionId = req.params.id;
  const [auction] = await db
    .select({ ...selectAuctionsSnapshot })
    .from(participants)
    .innerJoin(auctions, eq(participants.auctionId, auctions.id))
    .where(and(eq(participants.auctionId, auctionId), eq(participants.userId, req.user.id)))
    .groupBy(auctions.id);

  if (!auction) throw new NotFoundException('Auction does not exist');
  if (auction.isCancelled) throw new BadRequestException('Auction is already cancelled');
  if (auction.isFinished) throw new BadRequestException('Auction is already completed');

  const startTime = new Date(auction.startsAt).getTime();
  const sixHoursFromNow = Date.now() + 6 * 60 * 60 * 1000;
  if (sixHoursFromNow > startTime)
    throw new ForbiddenException("Can't leave auction before 6 hours of starting");

  await db
    .delete(participants)
    .where(and(eq(participants.auctionId, auctionId), eq(participants.userId, req.user.id)));

  participantNotification({ auction, type: 'leave', user: req.user });

  return res.json({ message: 'Left auction successfully' });
});

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
  participantNotification({ auction, type: 'kick', user: participant });

  return res.json({ message: 'Kicked participant successfully' });
});
