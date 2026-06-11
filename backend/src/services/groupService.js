import {
  addGroup,
  findGroupById,
  findGroups,
  updateGroup,
} from '../repositories/groupRepository.js';
import { findDeployments } from '../repositories/deploymentRepository.js';

export function getGroups() {
  return findGroups();
}

export function createGroup(data) {
  const name = data.name?.trim();
  if (!name) {
    throw new Error('Group name is required.');
  }

  const duplicate = findGroups().some((group) => group.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    throw new Error('A group with this name already exists.');
  }

  return addGroup({
    id: `g${findGroups().length + 1}`,
    name,
    deploymentIds: normalizeDeploymentIds(data.deploymentIds),
    created: new Date().toISOString().slice(0, 10),
  });
}

export function updateGroupById(id, updates) {
  const group = findGroupById(id);
  if (!group) {
    return null;
  }

  const nextUpdates = {};
  if (updates.name !== undefined) {
    const name = updates.name.trim();
    if (!name) {
      throw new Error('Group name is required.');
    }

    const duplicate = findGroups().some(
      (item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      throw new Error('A group with this name already exists.');
    }

    nextUpdates.name = name;
  }

  if (updates.deploymentIds !== undefined) {
    nextUpdates.deploymentIds = normalizeDeploymentIds(updates.deploymentIds);
  }

  return updateGroup(id, nextUpdates);
}

function normalizeDeploymentIds(deploymentIds) {
  if (!Array.isArray(deploymentIds)) {
    return [];
  }

  const validIds = new Set(findDeployments().map((deployment) => deployment.id));
  return [
    ...new Set(
      deploymentIds
        .map((id) => String(id).trim())
        .filter((id) => id && validIds.has(id))
    ),
  ];
}
