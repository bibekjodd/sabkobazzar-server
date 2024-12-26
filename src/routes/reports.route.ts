import {
  getReportDetails,
  postReport,
  queryReports,
  respondToReport
} from '@/controllers/reports.controller';
import { Router } from 'express';

const router = Router();
export const reportsRoute = router;

router.get('/', queryReports);
router.route('/:id').post(postReport).get(getReportDetails);
router.post('/:id/response', respondToReport);
