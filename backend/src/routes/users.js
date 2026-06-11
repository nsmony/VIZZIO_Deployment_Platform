import express from 'express';
import {
  createGroupHandler,
  createUserHandler,
  deleteUserHandler,
  disableUserHandler,
  listGroups,
  listUsers,
  resetPasswordHandler,
  updateGroupHandler,
  updateUserHandler,
} from '../controllers/userController.js';

const router = express.Router();

router.get('/', listUsers);
router.post('/', createUserHandler);
router.get('/groups', listGroups);
router.post('/groups', createGroupHandler);
router.put('/groups/:id', updateGroupHandler);
router.patch('/:id/disable', disableUserHandler);
router.post('/:id/reset-password', resetPasswordHandler);
router.put('/:id', updateUserHandler);
router.delete('/:id', deleteUserHandler);
router.get('/me', async (req, res) => {
  res.json({ user: req.user });
});

export default router;
