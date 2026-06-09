import express from 'express';
import { validateDownloadToken } from '../controllers/internalController.js';

const router = express.Router();

router.get('/validate-token', validateDownloadToken);

export default router;
