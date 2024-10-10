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

router.get('/upcoming', getUpcomingAuctions);
router.get('/recent', getRecentAuctions);
router.get('/:id', getAuctionDetails);
router.route('/:id').post(registerAuction);
router.put('/:id/cancel', cancelAuction);
