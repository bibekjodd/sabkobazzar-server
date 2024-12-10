import { getFeedbacks, postFeedback } from '@/controllers/feedbacks.controller';
import { Router } from 'express';

const router = Router();
export const feedbacksRoute = router;

router.route('/').post(postFeedback).get(getFeedbacks);
