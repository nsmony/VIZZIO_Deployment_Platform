import express from 'express';

const router = express.Router();

router.get('/', async (req, res) => {
  // TODO: Replace with real database query and permission rules.
  res.json({ message: 'User list placeholder', user: req.user });
});

router.get('/me', async (req, res) => {
  res.json({ user: req.user });
});

export default router;
