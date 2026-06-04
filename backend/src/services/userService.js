import {
  addUser,
  deleteUser as deleteUserRepo,
  findUserById,
  findUsers,
  updateUser as updateUserRepo,
} from '../repositories/userRepository.js';

export function getUsers() {
  return findUsers();
}

export function createUser(data) {
  const { name, email, role = 'User', status = 'Active', deployments = 0, lastLogin = 'Never', groups = [] } = data;

  if (!name || !email) {
    throw new Error('Name and email are required.');
  }

  const newUser = {
    id: `u${findUsers().length + 1}`,
    name,
    email,
    role: ['Admin', 'User'].includes(role) ? role : 'User',
    status,
    deployments,
    lastLogin,
    groups,
  };

  return addUser(newUser);
}

export function updateUserById(id, updates) {
  const user = findUserById(id);
  if (!user) {
    return null;
  }
  return updateUserRepo(id, updates);
}

export function deleteUserById(id) {
  return deleteUserRepo(id);
}
