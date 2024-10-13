import {
  fetchInterestedList,
  setInterested,
  unsetInterested
} from '@/controllers/interests.controller';
import { Router } from 'express';

const router = Router();
export const interestsRoute = router;

router.route('/:id').post(setInterested).delete(unsetInterested);
router.get('/', fetchInterestedList);
