import {
  fetchParticipants,
  inviteParticipant,
  joinAuction,
  kickParticipant,
  leaveAuction
} from '@/controllers/participants.controller';
import { Router } from 'express';

const router = Router();
export const participantsRoute = router;

router.route('/:id').get(fetchParticipants);
router.put('/:id/join', joinAuction);
router.put('/:id/leave', leaveAuction);
router.put('/:userId/invite/:auctionId', inviteParticipant);
router.put('/:userId/kick/:auctionId', kickParticipant);
