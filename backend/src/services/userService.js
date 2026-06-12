import bcrypt from 'bcrypt';
import {
  addUser,
  deleteUser as deleteUserRepo,
  findUserByEmail,
  findUserById,
  findUsers,
  updateUser as updateUserRepo,
} from '../repositories/userRepository.js';

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

  const temporaryPassword = password || generateTemporaryPassword();

  const newUser = {
    username: normalizeUsername(username || normalizedEmail.split('@')[0]),
    email: normalizedEmail,
    displayName: normalizedName,
    role: ['Admin', 'User'].includes(role) ? role : 'User',
    isActive: status !== 'Inactive',
    groups: normalizeGroups(groups),
    passwordHash: bcrypt.hashSync(temporaryPassword, 10),
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
    nextUpdates.username = normalizeUsername(updates.username);
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
  const updatedUser = await updateUserRepo(id, {
    passwordHash: bcrypt.hashSync(temporaryPassword, 10),
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
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `Vizzio-${suffix}`;
}

function normalizeUsername(username) {
  return String(username || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function toPublicUser(user) {
  const { passwordHash, groupMemberships = [], _count, ...publicUser } = user;
  return {
    ...publicUser,
    name: user.displayName,
    status: user.isActive ? 'Active' : 'Inactive',
    groups: groupMemberships.map((membership) => membership.group.name),
    deployments: _count?.deployments || 0,
    lastLogin: 'Never',
  };
}
