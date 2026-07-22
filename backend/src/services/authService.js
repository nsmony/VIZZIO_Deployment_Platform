import bcrypt from 'bcrypt';
import { signToken } from '../auth.js';
import { addUser, findUserByUsername, findUserByUsernameOrEmail, updateUser, updateUserLastLogin } from '../repositories/userRepository.js';

// Demo users are useful for local development and can be disabled by env.
const mockUsers = [
  {
    username: 'admin',
    email: 'admin@demo.vizzio.local',
    displayName: 'Administrator',
    passwordHash: bcrypt.hashSync('password', 12),
    role: 'admin',
  },
  {
    username: 'user',
    email: 'user@demo.vizzio.local',
    displayName: 'Demo User',
    passwordHash: bcrypt.hashSync('password', 12),
    role: 'user',
  },
];

// Validate credentials and return a signed API token.
export async function authenticateUser(username, password) {
  const normalizedUsername = username.trim();
  const demoUsersEnabled = String(process.env.ENABLE_DEMO_USERS || 'true').toLowerCase() !== 'false';
  const demoUser = demoUsersEnabled
    ? mockUsers.find((item) => item.username.toLowerCase() === normalizedUsername.toLowerCase())
    : null;
  if (demoUser) {
    const validDemoPassword = await bcrypt.compare(password, demoUser.passwordHash);
    if (!validDemoPassword) {
      return null;
    }

    const persistedDemoUser = await ensureDemoUserRecord(demoUser);
    const demoRole = persistedDemoUser.role.toLowerCase();
    await updateUserLastLogin(persistedDemoUser.id);
    const demoToken = signToken({ userId: persistedDemoUser.id, username: persistedDemoUser.username, role: demoRole });
    return {
      token: demoToken,
      user: {
        id: persistedDemoUser.id,
        username: persistedDemoUser.username,
        email: persistedDemoUser.email,
        role: demoRole,
      },
    };
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

async function ensureDemoUserRecord(demoUser) {
  const existing = await findUserByUsername(demoUser.username);
  if (!existing) {
    return addUser({
      username: demoUser.username,
      email: demoUser.email,
      displayName: demoUser.displayName,
      role: normalizeRole(demoUser.role),
      isActive: true,
      passwordHash: demoUser.passwordHash,
      groups: [],
    });
  }

  const updates = {};
  if (existing.email !== demoUser.email) {
    updates.email = demoUser.email;
  }
  if ((existing.displayName || '') !== demoUser.displayName) {
    updates.displayName = demoUser.displayName;
  }
  if ((existing.role || '').toLowerCase() !== demoUser.role.toLowerCase()) {
    updates.role = normalizeRole(demoUser.role);
  }
  if (existing.isActive !== true) {
    updates.isActive = true;
  }

  if (Object.keys(updates).length === 0) {
    return existing;
  }

  return updateUser(existing.id, updates);
}

function normalizeRole(role) {
  return String(role || '').toLowerCase() === 'admin' ? 'Admin' : 'User';
}
