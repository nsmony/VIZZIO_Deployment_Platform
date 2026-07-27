import express from 'express';
import {
  clearAllNotificationsHandler,
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
router.delete('/all', clearAllNotificationsHandler);
router.delete('/:id', deleteNotificationHandler);

export default router;
