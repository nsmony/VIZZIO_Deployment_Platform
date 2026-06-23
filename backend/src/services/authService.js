import bcrypt from 'bcrypt';
import { signToken } from '../auth.js';
import { findUserByUsernameOrEmail, updateUserLastLogin } from '../repositories/userRepository.js';

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
  const normalizedUsername = username.trim();
  const user = mockUsers.find((item) => item.username.toLowerCase() === normalizedUsername.toLowerCase());
  if (user) {
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return null;
    }

    const token = signToken({ userId: user.id, username: user.username, role: user.role });
    return { token, user: { id: user.id, username: user.username, role: user.role } };
  }

  const managedUser = await findUserByUsernameOrEmail(normalizedUsername);
  if (managedUser && !managedUser.isActive) {
    return null;
  }
  if (!managedUser?.passwordHash) {
    return null;
  }

  const validManagedPassword = await bcrypt.compare(password, managedUser.passwordHash);
  if (!validManagedPassword) {
    return null;
  }

  const role = managedUser.role.toLowerCase();
  await updateUserLastLogin(managedUser.id);
  const token = signToken({ userId: managedUser.id, username: managedUser.username, role });
  return {
    token,
    user: {
      id: managedUser.id,
      username: managedUser.username,
      email: managedUser.email,
      role,
    },
  };
}
