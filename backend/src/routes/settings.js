import express from 'express';
import { fetchSettings, resetSettings, systemReadiness, updateSettings } from '../controllers/settingsController.js';

const router = express.Router();
router.get('/', fetchSettings);
router.get('/readiness', systemReadiness);
router.put('/', updateSettings);
router.post('/reset', resetSettings);

export default router;
