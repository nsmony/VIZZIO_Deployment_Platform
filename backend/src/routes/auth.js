import express from 'express';
import { login } from '../controllers/authController.js';

// Public authentication routes.
const router = express.Router();

router.post('/login', login);

export default router;
