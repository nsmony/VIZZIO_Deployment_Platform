import express from 'express';
import {
  dashboard,
  downloadLogs,
  exportDownloadLogs,
  launcherErrorReport,
  launcherErrorReports,
  notifications,
} from '../controllers/adminController.js';

// Admin dashboard, notifications, and audit log routes.
const router = express.Router();

router.get('/dashboard', dashboard);
router.get('/notifications', notifications);
router.get('/download-logs', downloadLogs);
router.get('/download-logs/export', exportDownloadLogs);
router.get('/launcher-error-reports', launcherErrorReports);
router.get('/launcher-error-reports/:reportId', launcherErrorReport);

export default router;
