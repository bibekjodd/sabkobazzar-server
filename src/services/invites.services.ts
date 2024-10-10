import { db } from '@/lib/database';
import { BadRequestException, ForbiddenException, NotFoundException } from '@/lib/exceptions';
import { auctions } from '@/schemas/auctions.schema';
import { invites } from '@/schemas/invites.schema';
import { User, users } from '@/schemas/users.schema';
import { eq } from 'drizzle-orm';

import { Auction } from '@/schemas/auctions.schema';

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
