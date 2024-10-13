import { db } from '@/lib/database';
import { NotFoundException } from '@/lib/exceptions';
import { auctions, ResponseAuction, selectAuctionsSnapshot } from '@/schemas/auctions.schema';
import { interests } from '@/schemas/interests.schema';
import { invites } from '@/schemas/invites.schema';
import { participants } from '@/schemas/participants.schema';
import { products, selectProductSnapshot } from '@/schemas/products.schema';
import { selectUserSnapshot, User, users } from '@/schemas/users.schema';
import { and, eq, getTableColumns, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

export const selectJsonArrayParticipants = () => {
  const participant = alias(users, 'participant');
  return sql<string>`json_group_array(
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
  auction.participants = auction.participants.filter((participant) => !!participant.id);
  auction.isInvited = !!auction.isInvited;
  auction.product.isInterested = !!auction.product.isInterested;

  return auction;
};
