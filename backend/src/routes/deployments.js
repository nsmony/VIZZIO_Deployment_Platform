import express from 'express';

const router = express.Router();

router.get('/', async (req, res) => {
  // TODO: Query deployments available to the authenticated user.
  res.json({ message: 'Deployment listing placeholder', user: req.user });
});

router.post('/versions', async (req, res) => {
  // TODO: Accept a new deployment version registration request.
  res.json({ message: 'New deployment version endpoint placeholder' });
});

router.post('/token', async (req, res) => {
  // TODO: Generate a short-lived download token for the requested build file.
  res.json({ message: 'Download token placeholder' });
});

export default router;
