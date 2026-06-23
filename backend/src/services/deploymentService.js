import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  addDeployment,
  addDeploymentVersion,
  findDeploymentById,
  findDeploymentForUser,
  findDeployments,
  findDeploymentsForUser,
  findVersionById,
  findDeploymentVersion,
  updateDeploymentVersion,
} from '../repositories/deploymentRepository.js';

const RELEASE_TYPES = new Set(['stable', 'beta']);
const VERSION_STATUSES = new Set(['draft', 'released', 'archived', 'deleted']);
const DEFAULT_PACKAGE_ROOT = '/var/vizzio/packages';

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
    }), { admin: true });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new Error('That version is already registered for this deployment.');
    }
    throw error;
  }
}

export async function validatePackage(data) {
  const packageRoot = path.resolve(process.env.PACKAGE_ROOT || DEFAULT_PACKAGE_ROOT);
  const rawPackagePath = String(data.packagePath || '').trim();

  if (!rawPackagePath) throw new Error('Server package path is required.');

  const resolvedPath = path.resolve(rawPackagePath);
  const relativePath = path.relative(packageRoot, resolvedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Package must be inside ${packageRoot}.`);
  }

  const stat = await fs.promises.stat(resolvedPath).catch(() => null);
  if (!stat) throw new Error('Package file was not found.');
  if (stat.isDirectory()) throw new Error('Package path must point to a file, not a directory.');

  return {
    fileName: path.basename(resolvedPath),
    fileType: inferFileType(resolvedPath),
    packageSize: String(stat.size),
    checksum: await sha256File(resolvedPath),
  };
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
    releaseType: version.releaseType,
    status: version.status,
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

function isAdmin(user) {
  return String(user?.role || '').toLowerCase() === 'admin';
}

function inferFileType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const types = {
    '.zip': 'application/zip',
    '.7z': 'application/x-7z-compressed',
    '.rar': 'application/vnd.rar',
    '.exe': 'application/vnd.microsoft.portable-executable',
    '.msi': 'application/x-msi',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
  };
  return types[extension] || 'application/octet-stream';
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', resolve);
  });
  return hash.digest('hex');
}
