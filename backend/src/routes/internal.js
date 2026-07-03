import express from 'express';
import { validateDownloadToken } from '../controllers/internalController.js';

// Internal routes used by infrastructure such as reverse proxies.
const router = express.Router();

router.get('/validate-token', validateDownloadToken);

export default router;
