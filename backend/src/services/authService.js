import bcrypt from 'bcrypt';
import { signToken } from '../auth.js';
import { findUsers } from '../repositories/userRepository.js';

const mockUsers = [
  {
    id: 'admin-1',
    username: 'admin',
    passwordHash: bcrypt.hashSync('password', 10),
    role: 'admin',
  },
  {
    id: 'user-1',
    username: 'user',
    passwordHash: bcrypt.hashSync('password', 10),
    role: 'user',
  },
];

export async function authenticateUser(username, password) {
  const user = mockUsers.find((item) => item.username === username);
  if (user) {
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return null;
    }

    const token = signToken({ userId: user.id, username: user.username, role: user.role });
    return { token, user: { id: user.id, username: user.username, role: user.role } };
  }

  const managedUser = findUsers().find(
    (item) => item.email.toLowerCase() === username.toLowerCase() && item.status === 'Active'
  );
  if (!managedUser?.passwordHash) {
    return null;
  }

  const validManagedPassword = await bcrypt.compare(password, managedUser.passwordHash);
  if (!validManagedPassword) {
    return null;
  }

  const role = managedUser.role.toLowerCase();
  const token = signToken({ userId: managedUser.id, username: managedUser.email, role });
  return {
    token,
    user: {
      id: managedUser.id,
      username: managedUser.email,
      role,
      passwordResetRequired: managedUser.passwordResetRequired,
    },
  };
}
