import { db } from '@/lib/database';
import { BadRequestException, ForbiddenException, NotFoundException } from '@/lib/exceptions';
import {
  Auction,
  auctions,
  ResponseAuction,
  selectAuctionsSnapshot
} from '@/schemas/auctions.schema';
import { interests } from '@/schemas/interests.schema';
import { invites } from '@/schemas/invites.schema';
import { participants } from '@/schemas/participants.schema';
import { products, selectProductSnapshot } from '@/schemas/products.schema';
import { selectUserSnapshot, User, users } from '@/schemas/users.schema';
import { and, eq, getTableColumns, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

export const selectJsonArrayParticipants = () => {
  const participant = alias(users, 'participant');
  return sql<string>`
  json_group_array(
    json_object(
      'id',${participant.id},
      'name',${participant.name},
      'email',${participant.email},
      'role',${participant.role},
      'image',${participant.image},
      'phone',${participant.phone},
      'lastOnline',${participant.lastOnline}
    ) 
  )`;
};

export const getAuctionDetailsById = async ({
  userId,
  auctionId
}: {
  userId: string;
  auctionId: string;
}): Promise<ResponseAuction> => {
  const winner = alias(users, 'winner');
  const participant = alias(users, 'participant');
  const [result] = await db
    .select({
      participants: selectJsonArrayParticipants(),
      ...selectAuctionsSnapshot,
      product: { ...selectProductSnapshot, isInterested: sql<boolean>`${interests.productId}` },
      owner: selectUserSnapshot,
      winner: getTableColumns(winner),
      isInvited: sql<boolean>`${invites.userId}`
    })
    .from(auctions)
    .innerJoin(products, eq(auctions.productId, products.id))
    .leftJoin(interests, and(eq(products.id, interests.productId), eq(interests.userId, userId)))
    .innerJoin(users, eq(auctions.ownerId, users.id))
    .leftJoin(participants, eq(participants.auctionId, auctionId))
    .leftJoin(participant, eq(participants.userId, participant.id))
    .leftJoin(winner, eq(auctions.winnerId, winner.id))
    .leftJoin(invites, and(eq(auctions.id, invites.auctionId), eq(invites.userId, userId)))
    .groupBy(auctions.id)
    .where(eq(auctions.id, auctionId));
  if (!result) throw new NotFoundException('Auction does not exist');
  const auction = { ...result, participants: JSON.parse(result.participants) as User[] };
  auction.participants = auction.participants.filter((participant) => !!participant);
  auction.isInvited = !!auction.isInvited;
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
    .where(and(eq(participants.userId, userId), eq(participants.auctionId, auctionId)));
  if (!isParticipant)
    throw new ForbiddenException(
      'User is not participant of the auction or the auction does not exist'
    );
  return !!isParticipant;
};

export const findAuctionParticipants = async (auctionId: string) => {
  const result = await db
    .select({ ...selectUserSnapshot })
    .from(participants)
    .innerJoin(users, eq(participants.userId, users.id))
    .where(eq(participants.auctionId, auctionId))
    .groupBy(participants.userId);
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
  const auctionPromise = db
    .select()
    .from(auctions)
    .where(eq(auctions.id, auctionId))
    .execute()
    .then((result) => result[0]);

  const participantPromise = db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .execute()
    .then((result) => result[0]);

  const totalInvitesPromise = db
    .select({ id: invites.auctionId })
    .from(invites)
    .where(eq(invites.auctionId, auctionId))
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
  if (totalInvites >= 50) throw new ForbiddenException("Can't invite more than 50 users");
  if (auction.isCancelled) throw new BadRequestException('Auction is already cancelled');
  if (auction.isFinished) throw new BadRequestException('Auction is already finished');
  if (auction.startsAt < new Date().toISOString())
    throw new BadRequestException("Can't invite users after the auction has started");

  await db
    .insert(invites)
    .values({ auctionId: auction.id, userId: participant.id })
    .onConflictDoUpdate({
      target: [invites.auctionId, invites.userId],
      set: { at: new Date().toISOString(), status: 'pending' }
    });

  return { auction, participant };
};
