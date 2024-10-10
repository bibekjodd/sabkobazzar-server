import { sendMail } from '@/lib/send-mail';
import { formatDate } from '@/lib/utils';
import { addNotification } from '@/services/notifications.service';

type ParticipantNotificationOptions = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  auction: { id: string; title: string; startsAt: string };
  type: 'join' | 'kick' | 'leave';
};

export const participantNotification = async ({
  user,
  auction,
  type
}: ParticipantNotificationOptions) => {
  let title = `Joined the auction`;
  let description = `Auction - ${auction.title} starts at ${formatDate(auction.startsAt)}`;
  let message = `Hey ${user.name}, ${description}`;
  if (type === 'kick') {
    title = 'Removed from the auction';
    description = `You have been removed from the auction - ${auction.title} which was scheduled for ${formatDate(auction.startsAt)}`;
    message = `Hey ${user.name}, ${description}`;
  }
  if (type === 'leave') {
    title = 'Left from the auction';
    description = `You have left the auction - ${auction.title} which was scheduled for ${formatDate(auction.startsAt)}`;
  }

  await Promise.all([
    addNotification({
      entity: 'auctions',
      params: auction.id,
      title,
      userId: user.id,
      description,
      type
    }),
    type !== 'leave' && sendMail({ mail: user.email, subject: title, text: message })
  ]);
};
