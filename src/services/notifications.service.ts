import { db } from '@/db';
import { InsertNotification, notifications } from '@/db/notifications.schema';
import { users } from '@/db/users.schema';
import { onReceivedNotification } from '@/lib/events';
import { sendMail, SendMailOptions } from '@/lib/send-mail';
import { formatDate } from '@/lib/utils';
import { eq, sql } from 'drizzle-orm';

export const addNotification = async (...data: InsertNotification[]) => {
  const notificationsToUpdate: { userId: string; count: number }[] = [];
  for (const notification of data) {
    const existingNotification = notificationsToUpdate.find(
      (n) => n.userId === notification.userId
    );
    if (existingNotification) existingNotification.count++;
    else notificationsToUpdate.push({ userId: notification.userId, count: 1 });
  }

  for (const notification of notificationsToUpdate) {
    db.update(users)
      .set({
        totalUnreadNotifications: sql`${users.totalUnreadNotifications}+${notification.count}`
      })
      .where(eq(users.id, notification.userId))
      .execute();
  }

  return db
    .insert(notifications)
    .values(data)
    .returning()
    .execute()
    .then((result) => {
      for (const notification of result) {
        onReceivedNotification(notification.userId, { notification });
      }
      return result;
    });
};

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
  const title = `Auction registered successfully`;
  const description = `Auction - ${auction.title} is scheduled for ${formatDate(auction.startsAt)}`;
  const message = `Hey ${user.name}, ${description}`;

  sendMail({ mail: user.email, subject: title, text: message });
  await addNotification({
    title,
    description,
    entity: 'auctions',
    params: auction.id,
    userId: user.id,
    type: 'register'
  });
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
  sendMail(...mailData);
  await addNotification(...notificationsData);
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

  if (type !== 'leave') sendMail({ mail: user.email, subject: title, text: message });
  await addNotification({
    entity: 'auctions',
    params: auction.id,
    title,
    userId: user.id,
    description,
    type
  });
};

export const receivedReportNotification = async ({
  auction,
  user
}: {
  user: {
    id: string;
    name: string;
    email: string;
  };
  auction: { id: string; title: string };
}) => {
  const title = `Received your report`;
  const description = `Your report for the auction - ${auction.title} has been received. Wait till further response from the admin`;
  const message = `Hey ${user.name}! ${description}`;

  sendMail({ mail: user.email, subject: title, text: message });
  await addNotification({
    entity: 'auctions',
    title,
    description,
    params: auction.id,
    type: 'report',
    userId: user.id
  });
};

export const reportRespondedNotification = async ({
  user,
  auction
}: {
  user: {
    id: string;
    name: string;
    email: string;
  };
  auction: { id: string; title: string };
}) => {
  const title = 'Report acknowledged';
  const description = `Your report for the auction - ${auction.title} has got a response`;
  const message = `Hey ${user.name}, ${description}`;

  sendMail({ mail: user.email, subject: title, text: message });
  await addNotification({
    entity: 'auctions',
    title,
    description,
    userId: user.id,
    params: auction.id,
    type: 'report-acknowledge'
  });
};
