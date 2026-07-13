import express from 'express';
import {
  deleteNotificationHandler,
  listNotificationsHandler,
  markAllNotificationsReadHandler,
  markNotificationReadHandler,
  unreadNotificationCountHandler,
} from '../controllers/notificationController.js';

const router = express.Router();

router.get('/', listNotificationsHandler);
router.get('/unread-count', unreadNotificationCountHandler);
router.patch('/read-all', markAllNotificationsReadHandler);
router.patch('/:id/read', markNotificationReadHandler);
router.delete('/:id', deleteNotificationHandler);

export default router;
