import {
  getProfile,
  getUserDetails,
  queryUsers,
  requestAccountVerificationOtp,
  updateProfile,
  verifyUser
} from '@/controllers/users.controller';
import { Router } from 'express';

const router = Router();
export const usersRoute = router;

router.route('/').get(queryUsers);
router.route('/profile').get(getProfile).put(updateProfile);
router.get('/verify', requestAccountVerificationOtp);
router.put('/verify', verifyUser);

router.route('/:id').get(getUserDetails);
