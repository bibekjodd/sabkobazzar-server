import { fetchBids, getBidsSnapshot, placeBid } from '@/controllers/bids.controller';
import { Router } from 'express';

const router = Router();
export const bidsRoute = router;

router.route('/:id').put(placeBid).get(fetchBids);
router.get('/:id/snapshot', getBidsSnapshot);
