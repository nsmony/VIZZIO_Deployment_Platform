import {
  addDeployment,
  addDeploymentVersion,
  findDeploymentById,
  findDeployments,
  findDeploymentVersion,
  updateDeploymentVersion,
} from '../repositories/deploymentRepository.js';

const RELEASE_TYPES = new Set(['stable', 'beta']);
const VERSION_STATUSES = new Set(['draft', 'released', 'archived']);

export function getDeployments() {
  return findDeployments().then((deployments) => deployments.map(toPublicDeployment));
}

export async function createDeployment(data, createdBy) {
  if (!data.name?.trim()) {
    throw new Error('Deployment name is required.');
  }

  const deployment = {
    name: data.name.trim(),
    description: data.description?.trim() || '',
    logoUrl: data.logoUrl?.trim() || null,
    versions: data.versions || [],
    createdBy,
  };
  return toPublicDeployment(await addDeployment(deployment));
}

export async function registerVersion(deploymentId, data) {
  const deployment = await findDeploymentById(deploymentId);
  if (!deployment) return null;

  const versionNumber = data.versionNumber?.trim();
  const packagePath = data.packagePath?.trim();
  const releaseType = String(data.releaseType || 'stable').toLowerCase();
  const packageSize = parsePackageSize(data.packageSize);

  if (!versionNumber) throw new Error('Version number is required.');
  if (!packagePath) throw new Error('Release folder is required.');
  if (!RELEASE_TYPES.has(releaseType)) throw new Error('Release type must be stable or beta.');

  try {
    return toPublicVersion(await addDeploymentVersion(deploymentId, {
      versionNumber,
      releaseType,
      status: 'draft',
      packagePath,
      fileName: data.fileName?.trim() || null,
      fileType: data.fileType?.trim() || null,
      packageSize,
      checksum: data.checksum?.trim() || null,
    }));
  } catch (error) {
    if (error.code === 'P2002') {
      throw new Error('That version is already registered for this deployment.');
    }
    throw error;
  }
}

export async function changeVersion(deploymentId, versionId, data, userId) {
  const version = await findDeploymentVersion(deploymentId, versionId);
  if (!version) return null;

  const updates = {};
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

function toPublicDeployment(deployment) {
  return {
    id: deployment.id,
    name: deployment.name,
    description: deployment.description,
    logoUrl: deployment.logoUrl,
    versions: (deployment.versions || []).map(toPublicVersion),
    users: deployment.users || 0,
    created: deployment.createdAt.toISOString().slice(0, 10),
  };
}

function toPublicVersion(version) {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    releaseType: version.releaseType,
    status: version.status,
    packagePath: version.packagePath,
    fileName: version.fileName,
    fileType: version.fileType,
    packageSize: version.packageSize?.toString() || null,
    checksum: version.checksum,
    createdAt: version.createdAt.toISOString(),
    releasedAt: version.releasedAt?.toISOString() || null,
  };
}

function parsePackageSize(value) {
  if (value === undefined || value === null || value === '') return null;

  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error('Package size must be a whole number of bytes.');
  }

  const size = BigInt(normalized);
  if (size < 0n) throw new Error('Package size cannot be negative.');
  return size;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}
