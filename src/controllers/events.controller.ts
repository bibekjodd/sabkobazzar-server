import { sendMessageSchema } from '@/dtos/events.dto';
import { onJoinedAuction, onLeftAuction, onSendMessage } from '@/lib/events';
import { UnauthorizedException } from '@/lib/exceptions';
import { handleAsync } from '@/middlewares/handle-async';
import { validateParticipant } from '@/services/participants.services';

export const joinedAuction = handleAsync<{ id: string }, { message: string }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();

  const auctionId = req.params.id;
  await validateParticipant({ userId: req.user.id, auctionId });
  onJoinedAuction(auctionId, { user: req.user });
  return res.json({ message: 'Joined auction successfully' });
});

export const leftAuction = handleAsync<{ id: string }, { message: string }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();

  const auctionId = req.params.id;
  await validateParticipant({ userId: req.user.id, auctionId });
  onLeftAuction(auctionId, { user: req.user });
  return res.json({ message: 'left auction successfully' });
});

export const sendMessage = handleAsync<{ id: string }, { message: string }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();

  const auctionId = req.params.id;
  await validateParticipant({ userId: req.user.id, auctionId });
  const { text, emoji } = sendMessageSchema.parse(req.body);
  onSendMessage(auctionId, { text, emoji });
  return res.json({ message: 'Message sent successfully' });
});
