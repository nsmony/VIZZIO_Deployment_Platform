import {
  createUser,
  deleteUserById,
  getUsers,
  updateUserById,
} from '../services/userService.js';

export async function listUsers(req, res) {
  res.json({ users: getUsers() });
}

export async function createUserHandler(req, res) {
  try {
    const user = createUser(req.body);
    res.status(201).json({ user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function updateUserHandler(req, res) {
  try {
    const user = updateUserById(req.params.id, req.body);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function deleteUserHandler(req, res) {
  const user = deleteUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json({ user });
}
