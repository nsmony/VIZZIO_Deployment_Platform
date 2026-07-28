import express from 'express';
import { changePassword, login } from '../controllers/authController.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

// Public authentication routes.
const router = express.Router();

router.post('/login', login);
router.post('/change-password', authenticateToken, requireAdmin, changePassword);

export default router;
