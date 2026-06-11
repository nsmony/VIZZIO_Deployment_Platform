import { authenticateUser } from '../services/authService.js';

export async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const result = await authenticateUser(username, password);
    if (!result) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
}


