import { SendMessageSchema } from '@/dtos/events.dto';
import { Bid } from '@/schemas/bids.schema';
import { Notification } from '@/schemas/notifications.schema';
import { User } from '../schemas/users.schema';
import { pusher } from './pusher';

const EVENTS = {
  JOINED_AUCTION: 'joined-auction',
  LEFT_AUCTION: 'left-auction',
  SENT_MESSAGE: 'sent-message',
  BID: 'bid',
  RECEIVED_NOTIFICATION: 'received-notification'
};

type JoinedAuctionResponse = {
  user: User;
};
export const onJoinedAuction = (auctionId: string, data: JoinedAuctionResponse) => {
  return pusher.trigger(auctionId, EVENTS.JOINED_AUCTION, data);
};

type LeftAuctionResponse = JoinedAuctionResponse;
export const onLeftAuction = (auctionId: string, data: LeftAuctionResponse) => {
  return pusher.trigger(auctionId, EVENTS.LEFT_AUCTION, data);
};

type SendMessageResponse = SendMessageSchema;
export const onSendMessage = (auctionId: string, data: SendMessageResponse) => {
  return pusher.trigger(auctionId, EVENTS.SENT_MESSAGE, data);
};

type BidResponse = {
  bid: Bid & { bidder: User };
};
export const onBid = (auctionId: string, data: BidResponse) => {
  return pusher.trigger(auctionId, EVENTS.BID, data);
};

type ReceivedNotificationResponse = {
  notification: Notification;
};
export const onReceivedNotification = (userId: string, data: ReceivedNotificationResponse) => {
  return pusher.trigger(userId, EVENTS.RECEIVED_NOTIFICATION, data);
};
