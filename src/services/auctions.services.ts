import { db } from '@/lib/database';
import { BadRequestException, ForbiddenException, NotFoundException } from '@/lib/exceptions';
import {
  Auction,
  auctions,
  ResponseAuction,
  selectAuctionsSnapshot
} from '@/schemas/auctions.schema';
import { interests } from '@/schemas/interests.schema';
import { participants } from '@/schemas/participants.schema';
import { products, selectProductSnapshot } from '@/schemas/products.schema';
import { selectUserSnapshot, User, users } from '@/schemas/users.schema';
import { and, eq, getTableColumns, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

export const auctionDetails = async ({
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
      product: { ...selectProductSnapshot, isInterested: sql<boolean>`${interests.productId}` },
      owner: selectUserSnapshot,
      winner: getTableColumns(winner),
      participationStatus: participant.status,
      totalParticipants: sql<number>`sum(case when ${participants.status}='joined' then 1 else 0 end)`
    })
    .from(auctions)
    .innerJoin(products, eq(auctions.productId, products.id))
    .leftJoin(interests, and(eq(products.id, interests.productId), eq(interests.userId, userId)))
    .innerJoin(users, eq(auctions.ownerId, users.id))
    .leftJoin(participants, eq(participants.auctionId, auctionId))
    .leftJoin(
      participant,
      and(eq(auctions.id, participant.auctionId), eq(participant.userId, userId))
    )
    .leftJoin(winner, eq(auctions.winnerId, winner.id))
    .groupBy(auctions.id)
    .where(eq(auctions.id, auctionId));
  if (!auction) throw new NotFoundException('Auction does not exist');
  auction.product.isInterested = !!auction.product.isInterested;
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
  const auctionPromise = auctionDetails({ auctionId, userId });
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
  if (auction.isCancelled) throw new BadRequestException('Auction is already cancelled');
  if (auction.isFinished) throw new BadRequestException('Auction is already finished');
  if (auction.startsAt < new Date().toISOString())
    throw new BadRequestException("Can't invite users after the auction has started");
  if (auction.participationStatus === 'invited')
    throw new BadRequestException('User is already invited');
  if (auction.participationStatus === 'rejected')
    throw new BadRequestException('User has already rejected the invitation');
  if (auction.participationStatus === 'joined')
    throw new BadRequestException('User has already joined the auction');

  await db
    .insert(participants)
    .values({
      auctionId,
      userId,
      at: new Date().toISOString(),
      status: 'invited'
    })
    .onConflictDoNothing({
      target: [participants.auctionId, participants.userId]
    });

  return { auction, participant };
};
