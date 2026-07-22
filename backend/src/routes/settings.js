import express from 'express';
import { fetchSettings, updateSettings, resetSettings } from '../controllers/settingsController.js';

const router = express.Router();
router.get('/', fetchSettings);
router.put('/', updateSettings);
router.post('/reset', resetSettings);

export default router;
