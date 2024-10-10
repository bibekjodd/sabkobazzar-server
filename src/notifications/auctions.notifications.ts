import { sendMail } from '@/lib/send-mail';
import { formatDate } from '@/lib/utils';
import { addNotification } from '@/services/notifications.service';

type AuctionNotificationOptions = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  product: {
    id: string;
    title: string;
  };
  auction: {
    id: string;
    startsAt: string;
  };
  type: 'register' | 'cancel';
};
export const auctionNotification = async ({
  user,
  product,
  auction,
  type
}: AuctionNotificationOptions) => {
  let title = `Product registered for the auction`;
  let description = `Auction for the product - ${product.title} is scheduled at ${formatDate(auction.startsAt)}`;
  let message = `Hey ${user.name}, ${description}`;

  if (type === 'cancel') {
    title = `Auction cancelled`;
    description = `Auction for the product - ${product.title} which was scheduled at ${formatDate(auction.startsAt)} is cancelled`;
    message = `Hey ${user.name}, ${description}`;
  }

  await Promise.all([
    addNotification({
      title,
      description,
      entity: 'auctions',
      params: auction.id,
      userId: user.id,
      type
    }),
    sendMail({ mail: user.email, subject: title, text: message })
  ]);
};
