import { db } from '@/lib/database';
import { ForbiddenException } from '@/lib/exceptions';
import { participants } from '@/schemas/participants.schema';
import { selectUserSnapshot, users } from '@/schemas/users.schema';
import { and, eq } from 'drizzle-orm';

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
