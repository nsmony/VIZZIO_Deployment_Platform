import express from 'express';
import bcrypt from 'bcrypt';
import { signToken } from '../auth.js';

const router = express.Router();

// NOTE: Replace this temporary mock with a real user lookup.
const mockUsers = [
  {
    id: 'admin-1',
    username: 'admin',
    passwordHash: bcrypt.hashSync('password', 10),
    role: 'admin',
  },
];

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = mockUsers.find((u) => u.username === username);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken({ userId: user.id, username: user.username, role: user.role });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

export default router;
