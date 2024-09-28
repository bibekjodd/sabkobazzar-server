import { db } from '@/lib/database';
import { ForbiddenException } from '@/lib/exceptions';
import { participants } from '@/schemas/participants.schema';
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
