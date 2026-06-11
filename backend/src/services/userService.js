import bcrypt from 'bcrypt';
import {
  addUser,
  deleteUser as deleteUserRepo,
  findUserById,
  findUsers,
  updateUser as updateUserRepo,
} from '../repositories/userRepository.js';

export function getUsers() {
  return findUsers().map(toPublicUser);
}

export function createUser(data) {
  const {
    name,
    email,
    role = 'User',
    status = 'Active',
    deployments = 0,
    lastLogin = 'Never',
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

  const emailExists = findUsers().some((user) => user.email.toLowerCase() === normalizedEmail.toLowerCase());
  if (emailExists) {
    throw new Error('A user with this email already exists.');
  }

  const temporaryPassword = password || generateTemporaryPassword();

  const newUser = {
    id: `u${findUsers().length + 1}`,
    name: normalizedName,
    email: normalizedEmail,
    role: ['Admin', 'User'].includes(role) ? role : 'User',
    status: ['Active', 'Inactive'].includes(status) ? status : 'Active',
    deployments,
    lastLogin,
    groups: normalizeGroups(groups),
    passwordHash: bcrypt.hashSync(temporaryPassword, 10),
    passwordUpdatedAt: new Date().toISOString(),
    passwordResetRequired: true,
  };

  return { user: toPublicUser(addUser(newUser)), temporaryPassword };
}

export function updateUserById(id, updates) {
  const user = findUserById(id);
  if (!user) {
    return null;
  }

  const nextUpdates = {};
  if (updates.name !== undefined) {
    const name = updates.name.trim();
    if (!name) {
      throw new Error('Name is required.');
    }
    nextUpdates.name = name;
  }
  if (updates.email !== undefined) {
    const email = updates.email.trim();
    if (!email) {
      throw new Error('Email is required.');
    }
    const emailExists = findUsers().some(
      (item) => item.id !== id && item.email.toLowerCase() === email.toLowerCase()
    );
    if (emailExists) {
      throw new Error('A user with this email already exists.');
    }
    nextUpdates.email = email;
  }
  if (updates.role !== undefined) {
    nextUpdates.role = ['Admin', 'User'].includes(updates.role) ? updates.role : user.role;
  }
  if (updates.status !== undefined) {
    nextUpdates.status = ['Active', 'Inactive'].includes(updates.status) ? updates.status : user.status;
  }
  if (updates.groups !== undefined) {
    nextUpdates.groups = normalizeGroups(updates.groups);
  }

  return toPublicUser(updateUserRepo(id, nextUpdates));
}

export function deleteUserById(id) {
  const user = deleteUserRepo(id);
  return user ? toPublicUser(user) : null;
}

export function disableUserById(id) {
  const user = findUserById(id);
  if (!user) {
    return null;
  }
  return toPublicUser(updateUserRepo(id, { status: 'Inactive' }));
}

export function resetPasswordById(id, password) {
  const user = findUserById(id);
  if (!user) {
    return null;
  }

  const temporaryPassword = password || generateTemporaryPassword();
  const updatedUser = updateUserRepo(id, {
    passwordHash: bcrypt.hashSync(temporaryPassword, 10),
    passwordUpdatedAt: new Date().toISOString(),
    passwordResetRequired: true,
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

function toPublicUser(user) {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}
