import {
  addGroup,
  addGroupDeploymentAccess,
  findGroupById,
  findGroups,
  removeGroupDeploymentAccess,
  updateGroup,
} from '../repositories/groupRepository.js';
import { findDeployments } from '../repositories/deploymentRepository.js';

// Business rules for access groups and deployment permissions.
export function getGroups() {
  return findGroups().then((groups) => groups.map(toPublicGroup));
}

export async function createGroup(data) {
  const name = data.name?.trim();
  if (!name) {
    throw new Error('Group name is required.');
  }

  const groups = await findGroups();
  const duplicate = groups.some((group) => group.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    throw new Error('A group with this name already exists.');
  }

  return toPublicGroup(await addGroup({
    name,
    deploymentIds: await normalizeDeploymentIds(data.deploymentIds),
  }));
}

export async function updateGroupById(id, updates) {
  const group = await findGroupById(id);
  if (!group) {
    return null;
  }

  const nextUpdates = {};
  if (updates.name !== undefined) {
    const name = updates.name.trim();
    if (!name) {
      throw new Error('Group name is required.');
    }

    const groups = await findGroups();
    const duplicate = groups.some(
      (item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      throw new Error('A group with this name already exists.');
    }

    nextUpdates.name = name;
  }

  if (updates.deploymentIds !== undefined) {
    nextUpdates.deploymentIds = await normalizeDeploymentIds(updates.deploymentIds);
  }

  const updatedGroup = await updateGroup(id, nextUpdates);
  return toPublicGroup(updatedGroup);
}

export async function grantDeploymentAccessByGroupId(id, deploymentId) {
  const group = await findGroupById(id);
  if (!group) {
    return null;
  }

  const normalizedDeploymentId = await normalizeSingleDeploymentId(deploymentId);
  const existingAccess = (group.deploymentAccesses || []).some(
    (access) => access.deploymentId === normalizedDeploymentId
  );
  if (existingAccess) {
    const error = new Error('This group already has access to that deployment.');
    error.status = 409;
    throw error;
  }

  return toPublicGroup(await addGroupDeploymentAccess(id, normalizedDeploymentId));
}

export async function revokeDeploymentAccessByGroupId(id, deploymentId) {
  const group = await findGroupById(id);
  if (!group) {
    return null;
  }

  const normalizedDeploymentId = String(deploymentId || '').trim();
  const existingAccess = (group.deploymentAccesses || []).some(
    (access) => access.deploymentId === normalizedDeploymentId
  );
  if (!existingAccess) {
    const error = new Error('No active access record was found for that deployment.');
    error.status = 404;
    throw error;
  }

  return toPublicGroup(await removeGroupDeploymentAccess(id, normalizedDeploymentId));
}

async function normalizeDeploymentIds(deploymentIds) {
  if (!Array.isArray(deploymentIds)) {
    return [];
  }

  const deployments = await findDeployments();
  const validIds = new Set(deployments.map((deployment) => deployment.id));
  return [
    ...new Set(
      deploymentIds
        .map((id) => String(id).trim())
        .filter((id) => id && validIds.has(id))
    ),
  ];
}

async function normalizeSingleDeploymentId(deploymentId) {
  const [normalizedDeploymentId] = await normalizeDeploymentIds([deploymentId]);
  if (!normalizedDeploymentId) {
    const error = new Error('Deployment not found.');
    error.status = 404;
    throw error;
  }
  return normalizedDeploymentId;
}

function toPublicGroup(group) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    deploymentIds: (group.deploymentAccesses || []).map((access) => access.deploymentId),
    created: group.createdAt.toISOString().slice(0, 10),
    createdAt: group.createdAt,
  };
}
