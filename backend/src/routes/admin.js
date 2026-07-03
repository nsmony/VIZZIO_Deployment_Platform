import express from 'express';
import {
  dashboard,
  downloadLogs,
  exportDownloadLogs,
  notifications,
} from '../controllers/adminController.js';

// Admin dashboard, notifications, and audit log routes.
const router = express.Router();

router.get('/dashboard', dashboard);
router.get('/notifications', notifications);
router.get('/download-logs', downloadLogs);
router.get('/download-logs/export', exportDownloadLogs);

export default router;
