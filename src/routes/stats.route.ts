import { getAuctionsStats } from '@/controllers/stats.controller';
import { Router } from 'express';

const router = Router();
export const statsRoute = router;

router.get('/auctions', getAuctionsStats);
