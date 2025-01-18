import { env } from '@/config/env.config';
import { db } from '@/db';
import { auctions } from '@/db/auctions.schema';
import { participants } from '@/db/participants.schema';
import { users } from '@/db/users.schema';
import { BadRequestException, HttpException, InternalServerException } from '@/lib/exceptions';
import { stripe } from '@/lib/stripe';
import { handleAsync } from '@/middlewares/handle-async';
import { auctionParticipantNotification } from '@/services/notifications.service';
import { eq } from 'drizzle-orm';
import { CheckoutMetadata } from './auctions.controller';

export const joinAuctionWebhook = handleAsync(async (req, res) => {
  if (!(req.body instanceof Buffer || typeof req.body === 'string'))
    throw new BadRequestException('Invalid body provided');

  const stripeSignature = req.headers['stripe-signature'];
  if (!stripeSignature) throw new BadRequestException('Invalid stripe signature');

  const event = await stripe.webhooks.constructEventAsync(
    req.body,
    stripeSignature,
    env.STRIPE_SECRET_WEBHOOK_KEY
  );

  if (event.type !== 'checkout.session.completed')
    throw new HttpException('Method is not implemented', 501);

  const metadata = event.data.object.metadata as CheckoutMetadata;
  const { userId, auctionId } = metadata;
  const [user, auction] = await Promise.all([
    db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .execute()
      .then((res) => res[0]),
    db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .execute()
      .then((res) => res[0])
  ]);

  if (!user || !auction) throw new InternalServerException();

  await Promise.all([
    db
      .insert(participants)
      .values({ auctionId, userId, status: 'joined' })
      .onConflictDoUpdate({
        target: [participants.userId, participants.auctionId],
        set: { status: 'joined', createdAt: new Date().toISOString() }
      }),

    auctionParticipantNotification({ auction, user, type: 'join' })
  ]);

  return res.json({ message: 'Joined auction successfully' });
});
