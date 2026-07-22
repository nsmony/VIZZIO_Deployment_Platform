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
  grantDeploymentAccessByGroupId,
  getGroups,
  revokeDeploymentAccessByGroupId,
  updateGroupById,
} from '../services/groupService.js';

// HTTP handlers for user accounts and access groups.
export async function listUsers(req, res) {
  res.json({ users: await getUsers() });
}

export async function createUserHandler(req, res) {
  try {
    const result = await createUser(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(isDuplicateError(error) ? 409 : 400).json({ error: error.message });
  }
}

export async function updateUserHandler(req, res) {
  try {
    const user = await updateUserById(req.params.id, req.body);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user });
  } catch (error) {
    res.status(isDuplicateError(error) ? 409 : 400).json({ error: error.message });
  }
}

export async function deleteUserHandler(req, res) {
  const user = await deleteUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json({ user });
}

export async function disableUserHandler(req, res) {
  const user = await disableUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json({ user });
}

export async function resetPasswordHandler(req, res) {
  const result = await resetPasswordById(req.params.id, req.body?.password);
  if (!result) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json(result);
}

export async function listGroups(req, res) {
  res.json({ groups: await getGroups() });
}

export async function createGroupHandler(req, res) {
  try {
    const group = await createGroup(req.body);
    res.status(201).json({ group });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function updateGroupHandler(req, res) {
  try {
    const group = await updateGroupById(req.params.id, req.body);
    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }
    res.json({ group });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function grantGroupDeploymentAccessHandler(req, res) {
  try {
    const group = await grantDeploymentAccessByGroupId(req.params.id, req.params.deploymentId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }
    res.json({ group });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
}

export async function revokeGroupDeploymentAccessHandler(req, res) {
  try {
    const group = await revokeDeploymentAccessByGroupId(req.params.id, req.params.deploymentId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }
    res.json({ group });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
}

function isDuplicateError(error) {
  return /already exists|already taken/i.test(error.message || '');
}
