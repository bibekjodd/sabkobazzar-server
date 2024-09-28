import { joinedAuction, leftAuction, sendMessage } from '@/controllers/events.controller';
import { Router } from 'express';

const router = Router();
export const eventsRoute = router;

router.put('/auctions/:id/join', joinedAuction);
router.put('/auctions/:id/leave', leftAuction);
router.put('/auctions/:id/message', sendMessage);
