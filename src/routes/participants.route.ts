import { joinAuction, kickParticipant, leaveAuction } from '@/controllers/participants.controller';
import { Router } from 'express';

const router = Router();
export const participantsRoute = router;

router.put('/:id/join', joinAuction);
router.put('/:id/leave', leaveAuction);
router.put('/:userId/kick/:auctionId', kickParticipant);
