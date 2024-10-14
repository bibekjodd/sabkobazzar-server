import { sendMail, SendMailOptions } from '@/lib/send-mail';
import { formatDate } from '@/lib/utils';
import { InsertNotification } from '@/schemas/notifications.schema';
import { addNotification } from '@/services/notifications.service';

export const registerAuctionNotification = async ({
  user,
  auction
}: {
  user: {
    id: string;
    name: string;
    email: string;
  };
  auction: {
    id: string;
    title: string;
    startsAt: string;
  };
}) => {
  const title = `Product registered for the auction`;
  const description = `Auction - ${auction.title} is scheduled for ${formatDate(auction.startsAt)}`;
  const message = `Hey ${user.name}, ${description}`;

  await Promise.all([
    sendMail({ mail: user.email, subject: title, text: message }),
    addNotification({
      title,
      description,
      entity: 'auctions',
      params: auction.id,
      userId: user.id,
      type: 'register'
    })
  ]);
};

export const cancelAuctionNotifications = async ({
  auction,
  users
}: {
  auction: { id: string; startsAt: string; title: string };
  users: { id: string; name: string; email: string }[];
}) => {
  const notificationsData: InsertNotification[] = [];
  const mailData: SendMailOptions[] = [];

  for (const user of users) {
    const title = `Auction cancelled`;
    const description = `Auction  - ${auction.title} which was scheduled for ${formatDate(auction.startsAt)} is cancelled`;
    const message = `Hey ${user.name}, ${description}`;
    notificationsData.push({
      entity: 'auctions',
      title,
      userId: user.id,
      type: 'cancel',
      params: auction.id,
      description
    });
    mailData.push({ mail: user.email, subject: title, text: message });
  }

  await Promise.all([sendMail(...mailData), addNotification(...notificationsData)]);
};

export const auctionParticipantNotification = async ({
  user,
  auction,
  type
}: {
  user: {
    id: string;
    name: string;
    email: string;
  };
  auction: { id: string; title: string; startsAt: string };
  type: 'join' | 'kick' | 'leave' | 'invite';
}) => {
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
  if (type === 'invite') {
    title = 'Invited to join the auction';
    description = `You have been invited to the auction - ${auction.title} which is scheduled for ${formatDate(auction.startsAt)}`;
    message = `Hey ${user.name}, ${description}`;
  }

  await Promise.all([
    type !== 'leave' && sendMail({ mail: user.email, subject: title, text: message }),
    addNotification({
      entity: 'auctions',
      params: auction.id,
      title,
      userId: user.id,
      description,
      type
    })
  ]);
};
