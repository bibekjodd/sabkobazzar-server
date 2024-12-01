import { getAuctionsStats, getProductsStats } from '@/controllers/stats.controller';
import { Router } from 'express';

const router = Router();
export const statsRoute = router;

router.get('/auctions', getAuctionsStats);
router.get('/products', getProductsStats);
