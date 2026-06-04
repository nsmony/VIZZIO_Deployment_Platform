import bcrypt from 'bcrypt';
import { signToken } from '../auth.js';

const mockUsers = [
  {
    id: 'admin-1',
    username: 'admin',
    passwordHash: bcrypt.hashSync('password', 10),
    role: 'admin',
  },
];

export async function authenticateUser(username, password) {
  const user = mockUsers.find((item) => item.username === username);
  if (!user) {
    return null;
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return null;
  }

  const token = signToken({ userId: user.id, username: user.username, role: user.role });
  return { token, user: { id: user.id, username: user.username, role: user.role } };
}
