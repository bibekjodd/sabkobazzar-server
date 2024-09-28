import { SendMessageSchema } from '@/dtos/events.dto';
import { Bid } from '@/schemas/bids.schema';
import { User } from '../schemas/users.schema';
import { pusher } from './pusher';

export const EVENTS = {
  JOINED_AUCTION: 'joined-auction',
  LEFT_AUCTION: 'left-auction',
  SENT_MESSAGE: 'sent-message',
  BID: 'bid'
};

type JoinedAuctionResponse = {
  auctionId: string;
  user: User;
};
export const onJoinedAuction = (data: JoinedAuctionResponse) => {
  return pusher.trigger(data.auctionId, EVENTS.JOINED_AUCTION, data);
};

type LeftAuctionResponse = JoinedAuctionResponse;
export const onLeftAuction = (data: LeftAuctionResponse) => {
  return pusher.trigger(data.auctionId, EVENTS.JOINED_AUCTION, data);
};

type SendMessageResponse = SendMessageSchema & { auctionId: string };
export const onSendMessage = (data: SendMessageResponse) => {
  return pusher.trigger(data.auctionId, EVENTS.SENT_MESSAGE, data);
};

type BidResponse = {
  auctionId: string;
  bid: Bid & { bidder: User };
};
export const onBid = (data: BidResponse) => {
  return pusher.trigger(data.auctionId, EVENTS.BID, data);
};
