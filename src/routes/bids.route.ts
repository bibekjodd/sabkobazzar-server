import { fetchBids, placeBid } from '@/controllers/bids.controller';
import { Router } from 'express';

const router = Router();
export const bidsRoute = router;

router.route('/:id').put(placeBid).get(fetchBids);
