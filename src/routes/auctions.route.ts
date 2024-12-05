import {
  cancelAuction,
  getAuctionDetails,
  getAuctionParticipants,
  getBids,
  getBidsSnapshot,
  inviteParticipant,
  joinAuction,
  kickParticipant,
  leaveAuction,
  placeBid,
  queryAuctions,
  registerAuction,
  searchInviteUsers,
  setInterested,
  unsetInterested
} from '@/controllers/auctions.controller';
import { Router } from 'express';

const router = Router();
export const auctionsRoute = router;

router.route('/').get(queryAuctions).post(registerAuction);
router.get('/:id', getAuctionDetails);
router.put('/:id/cancel', cancelAuction);

router.get('/:id/participants', getAuctionParticipants);
router.put('/:id/join', joinAuction);
router.put('/:id/leave', leaveAuction);
router.put('/:auctionId/invite/:userId', inviteParticipant);
router.get('/:id/search-invite', searchInviteUsers);
router.put('/:auctionId/kick/:userId', kickParticipant);

router.route('/:id/bids').get(getBids).post(placeBid);
router.get('/:id/bids-snapshot', getBidsSnapshot);

router.route('/:id/interested').post(setInterested).delete(unsetInterested);
