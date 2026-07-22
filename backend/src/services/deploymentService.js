import {
  addDeployment,
  addDeploymentVersion,
  findDeploymentById,
  findDeploymentForUser,
  findDeployments,
  findDeploymentsForUser,
  findVersionById,
  findDeploymentVersion,
  updateDeployment,
  updateDeploymentVersion,
} from '../repositories/deploymentRepository.js';
import { inspectPackageSource } from './packageArchiveService.js';

const RELEASE_TYPES = new Set(['stable', 'beta']);
const VERSION_STATUSES = new Set(['draft', 'released', 'archived', 'deleted', 'paused', 'canceled']);

// Return deployments the current user is allowed to see.
export async function getDeploymentsForRequest(user) {
  const isAdminUser = isAdmin(user);
  const deployments = isAdminUser
    ? await findDeployments()
    : isUuid(user?.userId)
      ? await findDeploymentsForUser(user.userId)
      : [];

  return deployments.map((deployment) => toPublicDeployment(deployment, {
    admin: isAdminUser,
    releasedOnly: !isAdminUser,
  }));
}

export async function createDeployment(data, createdBy) {
  const name = data.name?.trim();
  if (!name) {
    throw new Error('Deployment name is required.');
  }

  await ensureDeploymentNameIsAvailable(name);

  const deployment = {
    name,
    description: data.description?.trim() || '',
    logoUrl: data.logoUrl?.trim() || null,
    versions: data.versions || [],
    createdBy,
  };
  return toPublicDeployment(await addDeployment(deployment));
}

export async function editDeployment(deploymentId, data) {
  const deployment = await findDeploymentById(deploymentId);
  if (!deployment) return null;

  const updates = {};
  if (data.name !== undefined) {
    const name = data.name?.trim();
    if (!name) throw new Error('Deployment name is required.');
    await ensureDeploymentNameIsAvailable(name, deploymentId);
    updates.name = name;
  }
  if (data.description !== undefined) {
    updates.description = data.description?.trim() || '';
  }
  if (data.logoUrl !== undefined) {
    updates.logoUrl = data.logoUrl?.trim() || null;
  }

  if (Object.keys(updates).length === 0) throw new Error('No deployment changes were provided.');
  return toPublicDeployment(await updateDeployment(deploymentId, updates), { admin: true });
}

export async function registerVersion(deploymentId, data, userId) {
  const deployment = await findDeploymentById(deploymentId);
  if (!deployment) return null;

  const versionNumber = data.versionNumber?.trim();
  const description = data.description?.trim() || null;
  const packagePath = data.packagePath?.trim();
  const releaseType = String(data.releaseType || 'stable').toLowerCase();
  const status = String(data.status || 'draft').toLowerCase();

  if (!versionNumber) throw new Error('Version number is required.');
  if (!packagePath) throw new Error('Package source path is required.');
  if (!RELEASE_TYPES.has(releaseType)) throw new Error('Release type must be stable or beta.');
  if (!VERSION_STATUSES.has(status)) throw new Error('Invalid version status.');

  const packageInfo = await inspectPackageSource({
    packagePath,
    sourceType: data.sourceType,
    deploymentName: deployment.name,
    versionNumber,
    deploymentId,
    createArchive: true,
  });

  try {
    return toPublicVersion(await addDeploymentVersion(deploymentId, {
      versionNumber,
      description,
      releaseType,
      status,
      packagePath: packageInfo.packagePath,
      fileName: packageInfo.fileName,
      fileType: packageInfo.fileType,
      packageSize: packageInfo.packageSize,
      checksum: packageInfo.checksum,
      releasedAt: status === 'released' ? new Date() : null,
      releasedBy: status === 'released' && isUuid(userId) ? userId : null,
    }), { admin: true });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new Error('That version is already registered for this deployment.');
    }
    throw error;
  }
}

export async function validatePackage(data) {
  const packageInfo = await inspectPackageSource({ ...data, createArchive: false });
  return {
    packageSource: packageInfo.packageSource,
    packagePath: packageInfo.packagePath,
    fileName: packageInfo.fileName,
    fileType: packageInfo.fileType,
    packageSize: packageInfo.packageSize?.toString() || '',
    checksum: packageInfo.checksum || '',
    batchScriptName: packageInfo.batchScriptName || '',
  };
}

export async function changeVersion(deploymentId, versionId, data, userId) {
  const version = await findDeploymentVersion(deploymentId, versionId);
  if (!version) return null;

  const updates = {};
  if (data.description !== undefined) {
    updates.description = data.description?.trim() || null;
  }

  if (data.releaseType !== undefined) {
    const releaseType = String(data.releaseType).toLowerCase();
    if (!RELEASE_TYPES.has(releaseType)) throw new Error('Release type must be stable or beta.');
    updates.releaseType = releaseType;
  }

  if (data.status !== undefined) {
    const status = String(data.status).toLowerCase();
    if (!VERSION_STATUSES.has(status)) throw new Error('Invalid version status.');
    updates.status = status;
    if (status === 'released') {
      updates.releasedAt = new Date();
      updates.releasedBy = isUuid(userId) ? userId : version.releasedBy;
    } else if (status === 'draft') {
      updates.releasedAt = null;
      updates.releasedBy = null;
    }
  }

  if (Object.keys(updates).length === 0) throw new Error('No version changes were provided.');
  return toPublicVersion(await updateDeploymentVersion(versionId, updates));
}

export async function updateDeploymentRunState(deploymentId, action) {
  const deployment = await findDeploymentById(deploymentId);
  if (!deployment) return null;

  const status = String(action || '').toLowerCase() === 'cancel' ? 'canceled' : 'paused';
  const activeVersion = (deployment.versions || []).find((version) => version.status === 'released');
  if (!activeVersion) {
    const error = new Error('Deployment does not have a running version.');
    error.status = 409;
    throw error;
  }

  await updateDeploymentVersion(activeVersion.id, { status });
  return toPublicDeployment(await findDeploymentById(deploymentId), { admin: true });
}

export async function deleteVersion(versionId, userId) {
  const version = await findVersionById(versionId);
  if (!version) return null;

  return toPublicVersion(await updateDeploymentVersion(versionId, {
    status: 'deleted',
    deletedAt: new Date(),
    deletedBy: isUuid(userId) ? userId : null,
  }), { admin: true });
}

export async function getDeploymentDetails(deploymentId, user) {
  const admin = isAdmin(user);
  const deployment = admin
    ? await findDeploymentById(deploymentId)
    : isUuid(user?.userId)
      ? await findDeploymentForUser(deploymentId, user.userId)
      : null;

  if (!deployment) return null;
  return toPublicDeployment(deployment, { admin, releasedOnly: !admin });
}

export async function userCanAccessDeployment(user, deploymentId) {
  if (isAdmin(user)) return true;
  if (!isUuid(user?.userId) || !isUuid(deploymentId)) return false;
  return Boolean(await findDeploymentForUser(deploymentId, user.userId));
}

export async function userCanAccessVersion(user, versionId) {
  if (!isUuid(versionId)) return false;

  const version = await findVersionById(versionId);
  if (!version || version.deletedAt || version.status === 'deleted') return false;
  if (isAdmin(user)) return true;
  if (version.status !== 'released') return false;

  return userCanAccessDeployment(user, version.deploymentId);
}

function toPublicDeployment(deployment, options = {}) {
  const versions = (deployment.versions || [])
    .filter((version) => !version.deletedAt && version.status !== 'deleted')
    .filter((version) => !options.releasedOnly || version.status === 'released')
    .map((version) => toPublicVersion(version, options));

  return {
    id: deployment.id,
    name: deployment.name,
    description: deployment.description,
    logoUrl: deployment.logoUrl,
    versions,
    users: deployment.users || 0,
    created: deployment.createdAt.toISOString().slice(0, 10),
  };
}

function toPublicVersion(version, options = {}) {
  const publicVersion = {
    id: version.id,
    versionNumber: version.versionNumber,
    description: version.description || null,
    releaseType: version.releaseType,
    status: version.status,
    packageSource: classifyPackageSource(version.packagePath),
    fileName: version.fileName,
    fileType: version.fileType,
    packageSize: version.packageSize?.toString() || null,
    checksum: version.checksum,
    createdAt: version.createdAt.toISOString(),
    releasedAt: version.releasedAt?.toISOString() || null,
  };

  if (options.admin) {
    publicVersion.packagePath = version.packagePath;
    publicVersion.deletedAt = version.deletedAt?.toISOString() || null;
    publicVersion.deletedBy = version.deletedBy || null;
  }

  return publicVersion;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

function isAdmin(user) {
  return String(user?.role || '').toLowerCase() === 'admin';
}

async function ensureDeploymentNameIsAvailable(name, currentDeploymentId = null) {
  const deployments = await findDeployments();
  const duplicate = deployments.find(
    (deployment) =>
      deployment.id !== currentDeploymentId &&
      deployment.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    throw new Error('A deployment with this name already exists.');
  }
}

function classifyPackageSource(packagePath) {
  const value = String(packagePath || '');
  if (!value) return null;
  if (value.includes('/_generated/') || value.includes('\\_generated\\')) return 'generatedArchive';
  if (/^\d+-/.test(value)) return 'upload';
  return 'serverArchive';
}
