import express from 'express';
import {
  createGroupHandler,
  createUserHandler,
  deleteUserHandler,
  disableUserHandler,
  grantGroupDeploymentAccessHandler,
  listGroups,
  listUsers,
  resetPasswordHandler,
  revokeGroupDeploymentAccessHandler,
  updateGroupHandler,
  updateUserHandler,
} from '../controllers/userController.js';

// User account and group access routes.
const router = express.Router();

router.get('/', listUsers);
router.post('/', createUserHandler);
router.get('/groups', listGroups);
router.post('/groups', createGroupHandler);
router.put('/groups/:id', updateGroupHandler);
router.post('/groups/:id/deployments/:deploymentId', grantGroupDeploymentAccessHandler);
router.delete('/groups/:id/deployments/:deploymentId', revokeGroupDeploymentAccessHandler);
router.patch('/:id/disable', disableUserHandler);
router.post('/:id/reset-password', resetPasswordHandler);
router.put('/:id', updateUserHandler);
router.delete('/:id', deleteUserHandler);
router.get('/me', async (req, res) => {
  res.json({ user: req.user });
});

export default router;
