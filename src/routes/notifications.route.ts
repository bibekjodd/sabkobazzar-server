import { getNotifications, readNotifications } from '@/controllers/notifications.controller';
import { Router } from 'express';

const router = Router();
export const notificationsRoute = router;

router.route('/').get(getNotifications);
router.route('/read').put(readNotifications);
