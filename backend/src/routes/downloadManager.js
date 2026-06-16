import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
  createDownloadManagerSession,
  listDownloadManagerItems,
  streamManagedDownloadFile,
  updateDownloadManagerSession,
} from '../controllers/downloadManagerController.js';

const router = express.Router();

router.get('/items', authenticateToken, listDownloadManagerItems);
router.post('/sessions', authenticateToken, createDownloadManagerSession);
router.patch('/sessions/:sessionId', authenticateToken, updateDownloadManagerSession);
router.get('/files/:fileId', streamManagedDownloadFile);

export default router;
