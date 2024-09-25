import {
  getRecentAuctions,
  getUpcomingAuctions,
  registerAuction
} from '@/controllers/auctions.controller';
import { Router } from 'express';

const router = Router();
export const auctionsRoute = router;

router.post('/:id', registerAuction);
router.get('/upcoming', getUpcomingAuctions);
router.get('/recent', getRecentAuctions);
