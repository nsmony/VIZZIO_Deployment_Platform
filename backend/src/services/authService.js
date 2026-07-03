import bcrypt from 'bcrypt';
import { signToken } from '../auth.js';
import { findUserByUsernameOrEmail, updateUserLastLogin } from '../repositories/userRepository.js';

// Demo users are useful for local development and can be disabled by env.
const mockUsers = [
  {
    id: 'admin-1',
    username: 'admin',
    passwordHash: bcrypt.hashSync('password', 12),
    role: 'admin',
  },
  {
    id: 'user-1',
    username: 'user',
    passwordHash: bcrypt.hashSync('password', 12),
    role: 'user',
  },
];

// Validate credentials and return a signed API token.
export async function authenticateUser(username, password) {
  const normalizedUsername = username.trim();
  const demoUsersEnabled = String(process.env.ENABLE_DEMO_USERS || 'true').toLowerCase() !== 'false';
  const user = demoUsersEnabled
    ? mockUsers.find((item) => item.username.toLowerCase() === normalizedUsername.toLowerCase())
    : null;
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
    const error = new Error('Your account has been disabled. Please contact your administrator.');
    error.status = 403;
    throw error;
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
