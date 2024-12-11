import { postReport, queryReports, respondToReport } from '@/controllers/reports.controller';
import { Router } from 'express';

const router = Router();
export const reportsRoute = router;

router.route('/:id').post(postReport).put(respondToReport);
router.get('/', queryReports);
