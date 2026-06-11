import express from 'express';
import {
  createUserHandler,
  deleteUserHandler,
  listUsers,
  updateUserHandler,
} from '../controllers/userController.js';
import { sendInvite, verifyInvite, completeInvite } from '../controllers/inviteController.js';

const router = express.Router();

router.get('/', listUsers);
router.post('/', createUserHandler);
router.put('/:id', updateUserHandler);
router.delete('/:id', deleteUserHandler);
router.get('/me', async (req, res) => {
  res.json({ user: req.user });
});

// Invite flow
router.post('/invite', sendInvite);
router.get('/invite/verify', verifyInvite);
router.post('/invite/complete', completeInvite);

export default router;
