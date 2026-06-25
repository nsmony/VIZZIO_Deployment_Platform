import bcrypt from 'bcrypt';
import {
  addUser,
  deleteUser as deleteUserRepo,
  findUserByEmail,
  findUserById,
  findUserByUsername,
  findUsers,
  updateUser as updateUserRepo,
} from '../repositories/userRepository.js';

const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 8;
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,64}$/;

export async function getUsers() {
  const users = await findUsers();
  return users.map(toPublicUser);
}

export async function createUser(data) {
  const {
    name,
    username,
    email,
    role = 'User',
    status = 'Active',
    groups = [],
    password,
  } = data;

  if (!name || !email) {
    throw new Error('Name and email are required.');
  }

  const normalizedName = name.trim();
  const normalizedEmail = email.trim();

  if (!normalizedName || !normalizedEmail) {
    throw new Error('Name and email are required.');
  }

  const emailExists = await findUserByEmail(normalizedEmail);
  if (emailExists) {
    throw new Error('A user with this email already exists.');
  }

  const normalizedUsername = username
    ? normalizeUsername(username)
    : generateUsernameFromEmail(normalizedEmail);
  await ensureUsernameIsAvailable(normalizedUsername);

  const temporaryPassword = password || generateTemporaryPassword();
  validatePassword(temporaryPassword);

  const newUser = {
    username: normalizedUsername,
    email: normalizedEmail,
    displayName: normalizedName,
    role: ['Admin', 'User'].includes(role) ? role : 'User',
    isActive: status !== 'Inactive',
    groups: normalizeGroups(groups),
    passwordHash: bcrypt.hashSync(temporaryPassword, BCRYPT_COST),
  };

  return { user: toPublicUser(await addUser(newUser)), temporaryPassword };
}

export async function updateUserById(id, updates) {
  const user = await findUserById(id);
  if (!user) {
    return null;
  }

  const nextUpdates = {};
  if (updates.name !== undefined) {
    const name = updates.name.trim();
    if (!name) {
      throw new Error('Name is required.');
    }
    nextUpdates.displayName = name;
  }
  if (updates.username !== undefined) {
    const username = normalizeUsername(updates.username);
    await ensureUsernameIsAvailable(username, id);
    nextUpdates.username = username;
  }
  if (updates.displayName !== undefined) {
    const displayName = updates.displayName.trim();
    if (!displayName) {
      throw new Error('Display name is required.');
    }
    nextUpdates.displayName = displayName;
  }
  if (updates.email !== undefined) {
    const email = updates.email.trim();
    if (!email) {
      throw new Error('Email is required.');
    }
    const emailExists = await findUserByEmail(email);
    if (emailExists && emailExists.id !== id) {
      throw new Error('A user with this email already exists.');
    }
    nextUpdates.email = email;
  }
  if (updates.role !== undefined) {
    nextUpdates.role = ['Admin', 'User'].includes(updates.role) ? updates.role : user.role;
  }
  if (updates.status !== undefined) {
    nextUpdates.isActive = updates.status !== 'Inactive';
  }
  if (updates.isActive !== undefined) {
    nextUpdates.isActive = Boolean(updates.isActive);
  }
  if (updates.groups !== undefined) {
    nextUpdates.groups = normalizeGroups(updates.groups);
  }

  return toPublicUser(await updateUserRepo(id, nextUpdates));
}

export async function deleteUserById(id) {
  const user = await deleteUserRepo(id);
  return user ? toPublicUser(user) : null;
}

export async function disableUserById(id) {
  const user = await findUserById(id);
  if (!user) {
    return null;
  }
  return toPublicUser(await updateUserRepo(id, { isActive: false }));
}

export async function resetPasswordById(id, password) {
  const user = await findUserById(id);
  if (!user) {
    return null;
  }

  const temporaryPassword = password || generateTemporaryPassword();
  validatePassword(temporaryPassword);
  const updatedUser = await updateUserRepo(id, {
    passwordHash: bcrypt.hashSync(temporaryPassword, BCRYPT_COST),
  });

  return { user: toPublicUser(updatedUser), temporaryPassword };
}

function normalizeGroups(groups) {
  if (!Array.isArray(groups)) {
    return [];
  }

  return [...new Set(groups.map((group) => String(group).trim()).filter(Boolean))];
}

function generateTemporaryPassword() {
  const suffix = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `Vizzio-${suffix}`;
}

function normalizeUsername(username) {
  const value = String(username || '').trim();
  if (!USERNAME_PATTERN.test(value)) {
    throw new Error('Username must be 3-64 characters and contain only letters, numbers, and underscores.');
  }
  return value;
}

function generateUsernameFromEmail(email) {
  const base = String(email || '')
    .split('@')[0]
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalizeUsername(base || `user_${Math.random().toString(36).slice(2, 8)}`);
}

function validatePassword(password) {
  if (String(password || '').length < MIN_PASSWORD_LENGTH) {
    throw new Error('Password must be at least 8 characters long.');
  }
}

async function ensureUsernameIsAvailable(username, currentUserId = null) {
  const existing = await findUserByUsername(username);
  if (existing && existing.id !== currentUserId) {
    throw new Error('Username is already taken.');
  }
}

function toPublicUser(user) {
  const { passwordHash, groupMemberships = [], _count, ...publicUser } = user;
  return {
    ...publicUser,
    name: user.displayName,
    status: user.isActive ? 'Active' : 'Inactive',
    groups: groupMemberships.map((membership) => membership.group.name),
    deployments: _count?.deployments || 0,
    lastLoginAt: user.lastLoginAt?.toISOString() || null,
    lastLogin: user.lastLoginAt ? user.lastLoginAt.toISOString() : 'Never',
  };
}
