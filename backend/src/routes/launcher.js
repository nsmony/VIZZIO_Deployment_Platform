import express from 'express';
import { checkLauncherUpdate } from '../controllers/launcherController.js';

const router = express.Router();

router.get('/update', checkLauncherUpdate);

export default router;
