import { db } from '@/db';
import { Auction, auctions, ResponseAuction, selectAuctionsSnapshot } from '@/db/auctions.schema';
import { bids } from '@/db/bids.schema';
import { interests } from '@/db/interests.schema';
import { participants } from '@/db/participants.schema';
import { selectUserSnapshot, User, users } from '@/db/users.schema';
import { BadRequestException, ForbiddenException, NotFoundException } from '@/lib/exceptions';
import { and, count, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

export const findAuctionDetails = async ({
  userId,
  auctionId
}: {
  userId: string;
  auctionId: string;
}): Promise<ResponseAuction> => {
  const winner = alias(users, 'winner');
  const participant = alias(participants, 'participant');
  const [auction] = await db
    .select({
      ...selectAuctionsSnapshot,
      owner: selectUserSnapshot,
      winner: getTableColumns(winner),
      participationStatus: participant.status,
      totalParticipants: count(participants.userId),
      isInterested: sql<boolean>`${interests.auctionId}`
    })
    .from(auctions)
    .innerJoin(users, eq(auctions.ownerId, users.id))
    .leftJoin(
      participants,
      and(eq(participants.auctionId, auctionId), eq(participants.status, 'joined'))
    )
    .leftJoin(
      participant,
      and(eq(auctions.id, participant.auctionId), eq(participant.userId, userId))
    )
    .leftJoin(winner, eq(auctions.winnerId, winner.id))
    .leftJoin(interests, and(eq(auctions.id, interests.auctionId), eq(interests.userId, userId)))
    .groupBy(auctions.id)
    .where(eq(auctions.id, auctionId));
  if (!auction) throw new NotFoundException('Auction does not exist');

  const isCompleted = auction.status !== 'cancelled' && new Date().toISOString() > auction.endsAt;
  auction.isInterested = !!auction.isInterested;

  if (isCompleted && !auction.winner && auction.status !== 'unbidded') {
    const [winner] = await db
      .select({ ...selectUserSnapshot, amount: bids.amount })
      .from(bids)
      .where(and(eq(bids.auctionId, auctionId)))
      .innerJoin(users, eq(bids.bidderId, users.id))
      .orderBy((t) => desc(t.amount))
      .limit(1);

    if (winner) {
      auction.winner = winner;
      auction.winnerId = winner.id;
      auction.finalBid = winner.amount;
      auction.status = 'completed';
      db.update(auctions)
        .set({ winnerId: winner.id, finalBid: winner.amount, status: 'completed' })
        .where(eq(auctions.id, auctionId))
        .execute();
    } else {
      auction.status = 'unbidded';
      db.update(auctions).set({ status: 'unbidded' }).where(eq(auctions.id, auctionId)).execute();
    }
  }

  return auction;
};

export const validateParticipant = async ({
  userId,
  auctionId
}: {
  userId: string;
  auctionId: string;
}) => {
  const [isParticipant] = await db
    .select()
    .from(participants)
    .where(
      and(
        eq(participants.userId, userId),
        eq(participants.auctionId, auctionId),
        eq(participants.status, 'joined')
      )
    );
  if (!isParticipant)
    throw new ForbiddenException(
      'User is not participant of the auction or the auction does not exist'
    );
  return !!isParticipant;
};

export const findAuctionParticipants = async (auctionId: string): Promise<User[]> => {
  const result = await db
    .select({ ...selectUserSnapshot })
    .from(participants)
    .innerJoin(users, eq(participants.userId, users.id))
    .where(and(eq(participants.auctionId, auctionId), eq(participants.status, 'joined')))
    .groupBy(participants.userId)
    .execute();
  return result;
};

export const inviteParticipantToAuction = async ({
  auctionId,
  userId,
  ownerId
}: {
  auctionId: string;
  userId: string;
  ownerId: string;
}): Promise<{ auction: Auction; participant: User }> => {
  if (userId === ownerId) throw new BadRequestException("Auction host can't invite themselves");

  const auctionPromise = findAuctionDetails({ auctionId, userId });
  const participantPromise = db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .execute()
    .then((result) => result[0]);

  const totalInvitesPromise = db
    .select({ id: participants.userId })
    .from(participants)
    .where(and(eq(participants.auctionId, auctionId), eq(participants.status, 'invited')))
    .execute()
    .then((result) => result.length);

  const [auction, participant, totalInvites] = await Promise.all([
    auctionPromise,
    participantPromise,
    totalInvitesPromise
  ]);

  if (!auction) throw new NotFoundException('Auction does not exist');
  if (auction.ownerId !== ownerId)
    throw new ForbiddenException('Only the auction host can invite the participant');
  if (!participant) throw new NotFoundException('User does not exist');
  if (!auction.isInviteOnly) throw new BadRequestException('The auction is public to all users');
  if (totalInvites >= 50) throw new ForbiddenException("Can't invite more than 50 users");
  if (auction.status === 'cancelled') throw new BadRequestException('Auction is already cancelled');
  if (auction.status === 'completed') throw new BadRequestException('Auction is already completed');
  if (auction.startsAt < new Date().toISOString())
    throw new BadRequestException("Can't invite users after the auction has started");
  if (auction.participationStatus === 'invited')
    throw new BadRequestException('User is already invited');
  if (auction.participationStatus === 'rejected')
    throw new BadRequestException('User has already rejected the invitation');
  if (auction.participationStatus === 'joined')
    throw new BadRequestException('User has already joined the auction');

  if (auction.participationStatus === null) {
    await db.insert(participants).values({
      auctionId,
      userId,
      createdAt: new Date().toISOString(),
      status: 'invited'
    });
  }
  if (auction.participationStatus == 'kicked') {
    await db
      .update(participants)
      .set({ status: 'invited', createdAt: new Date().toISOString() })
      .where(and(eq(participants.auctionId, auctionId), eq(participants.userId, userId)));
  }

  return { auction, participant };
};
