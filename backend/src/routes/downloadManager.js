import express from 'express';
import { authenticateToken, enforceMaintenanceMode } from '../middleware/authMiddleware.js';
import {
  createDownloadManagerSession,
  listDownloadManagerItems,
  streamManagedDownloadFile,
  updateDownloadManagerSession,
} from '../controllers/downloadManagerController.js';

// Launcher API routes for listing, tracking, and streaming downloads.
const router = express.Router();

router.get('/items', authenticateToken, enforceMaintenanceMode, listDownloadManagerItems);
router.post('/sessions', authenticateToken, enforceMaintenanceMode, createDownloadManagerSession);
router.patch('/sessions/:sessionId', authenticateToken, enforceMaintenanceMode, updateDownloadManagerSession);
router.get('/files/:fileId', streamManagedDownloadFile);

export default router;
