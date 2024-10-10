import { db } from '@/lib/database';
import { NotFoundException } from '@/lib/exceptions';
import { auctions, selectAuctionsSnapshot } from '@/schemas/auctions.schema';
import { participants } from '@/schemas/participants.schema';
import { products, selectProductSnapshot } from '@/schemas/products.schema';
import { selectUserSnapshot, User, users } from '@/schemas/users.schema';
import { eq, getTableColumns, sql } from 'drizzle-orm';
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

export const getAuctionDetailsById = async (auctionId: string) => {
  const winner = alias(users, 'winner');
  const participant = alias(users, 'participant');
  const [auction] = await db
    .select({
      participants: selectJsonArrayParticipants(),
      ...selectAuctionsSnapshot,
      product: selectProductSnapshot,
      owner: selectUserSnapshot,
      winner: getTableColumns(winner)
    })
    .from(auctions)
    .innerJoin(products, eq(auctions.productId, products.id))
    .innerJoin(users, eq(auctions.ownerId, users.id))
    .leftJoin(participants, eq(participants.auctionId, auctionId))
    .leftJoin(participant, eq(participants.userId, participant.id))
    .leftJoin(winner, eq(auctions.winnerId, winner.id))
    .groupBy(auctions.id)
    .where(eq(auctions.id, auctionId));
  if (!auction) throw new NotFoundException('Auction does not exist');
  return { ...auction, participants: JSON.parse(auction?.participants) as User[] };
};
