import express from 'express';
import {
  createUserHandler,
  deleteUserHandler,
  listUsers,
  updateUserHandler,
} from '../controllers/userController.js';

const router = express.Router();

router.get('/', listUsers);
router.post('/', createUserHandler);
router.put('/:id', updateUserHandler);
router.delete('/:id', deleteUserHandler);
router.get('/me', async (req, res) => {
  res.json({ user: req.user });
});

export default router;
