import {
  cancelAuction,
  getAuctionDetails,
  getRecentAuctions,
  getUpcomingAuctions,
  registerAuction
} from '@/controllers/auctions.controller';
import { Router } from 'express';

const router = Router();
export const auctionsRoute = router;

router.route('/:id').post(registerAuction).get(getAuctionDetails);
router.get('/upcoming', getUpcomingAuctions);
router.get('/recent', getRecentAuctions);
router.put('/:id/cancel', cancelAuction);
