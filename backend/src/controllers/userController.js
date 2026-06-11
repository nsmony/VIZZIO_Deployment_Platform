import {
  createUser,
  deleteUserById,
  disableUserById,
  getUsers,
  resetPasswordById,
  updateUserById,
} from '../services/userService.js';
import {
  createGroup,
  getGroups,
  updateGroupById,
} from '../services/groupService.js';

export async function listUsers(req, res) {
  res.json({ users: getUsers() });
}

export async function createUserHandler(req, res) {
  try {
    const result = createUser(req.body);
    res.status(201).json(result);
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

export async function disableUserHandler(req, res) {
  const user = disableUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json({ user });
}

export async function resetPasswordHandler(req, res) {
  const result = resetPasswordById(req.params.id, req.body?.password);
  if (!result) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json(result);
}

export async function listGroups(req, res) {
  res.json({ groups: getGroups() });
}

export async function createGroupHandler(req, res) {
  try {
    const group = createGroup(req.body);
    res.status(201).json({ group });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function updateGroupHandler(req, res) {
  try {
    const group = updateGroupById(req.params.id, req.body);
    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }
    res.json({ group });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
