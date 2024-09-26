import { sendMail } from '@/lib/send-mail';
import { formatDate } from '@/lib/utils';
import { addNotification } from '@/services/notifications.service';

type ParticipantNotificationOptions = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  product: { id: string; title: string };
  auction: { id: string; startsAt: string };
  type: 'join' | 'kick';
};

export const participantNotification = async ({
  user,
  product,
  auction,
  type
}: ParticipantNotificationOptions) => {
  let title = `Joined the auction`;
  let description = `Auction for the product - ${product.title} starts at ${formatDate(auction.startsAt)}`;
  let message = `Hey ${user.name}, ${description}`;
  if (type === 'kick') {
    title = 'Removed from the auction';
    description = `You have been removed from the auction for the product - ${product.title}`;
    message = `Hey ${user.name}, ${description}`;
  }

  await Promise.all([
    addNotification({
      entity: 'auctions',
      params: auction.id,
      title,
      userId: user.id,
      description
    }),
    sendMail({ mail: user.email, subject: title, text: message })
  ]);
};
