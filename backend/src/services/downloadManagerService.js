import fs from 'fs';
import path from 'path';
import prisma from '../prisma.js';
import { listUploadedFiles, findUploadedFile, getUploadedFilePath } from '../uploadStore.js';
import { signDownloadManagerToken, verifyDownloadManagerToken } from '../downloadManagerToken.js';
import { getPackageInstallSize } from './packageArchiveService.js';
import { userCanAccessVersion } from './deploymentService.js';
import { notifyAdmins } from './notificationService.js';
import { findUserByUsername } from '../repositories/userRepository.js';

const VERSION_FILE_PREFIX = 'version:';
const DEFAULT_PACKAGE_ROOT = process.platform === 'win32'
  ? 'C:\\VIZZIO\\packages'
  : '/var/vizzio/packages';
const VALID_SESSION_STATUSES = new Set(['pending', 'downloading', 'paused', 'canceled', 'failed', 'completed']);
const STOPPED_SESSION_STATUSES = new Set(['paused', 'canceled', 'failed']);

// Download-manager logic used by the launcher.
// Parses the single-range form used by the launcher. Multi-range responses are
// intentionally unsupported because each download stream owns one chunk.
export function parseRangeHeader(rangeHeader, fileSize) {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) return { invalid: true };

  let start = match[1] === '' ? null : Number(match[1]);
  let end = match[2] === '' ? null : Number(match[2]);

  if (start === null && end === null) return { invalid: true };
  if (start === null) {
    const suffixLength = end;
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return { invalid: true };
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    if (!Number.isInteger(start) || start < 0) return { invalid: true };
    end = end === null ? fileSize - 1 : end;
  }

  if (!Number.isInteger(end) || end < start || start >= fileSize) return { invalid: true };
  return { start, end: Math.min(end, fileSize - 1) };
}

export async function getDownloadablesForUser(user) {
  const uploads = listUploadedFiles();
  const role = String(user?.role || '').toLowerCase();
  // Uploaded packages are always visible to admins; normal users only see
  // released deployment versions that their group membership allows.
  const uploadItems = await Promise.all(uploads.map(async (upload) => ({
    deploymentId: null,
    deploymentName: upload.title || upload.originalName,
    versionId: `upload:${upload.fileId}`,
    versionNumber: 'Uploaded package',
    releaseType: 'package',
    status: 'released',
    fileId: upload.fileId,
    fileName: upload.originalName,
    size: upload.size,
    installSize: await getInstallSizeForUpload(upload.fileId),
    checksum: upload.checksum || null,
    available: true,
  })));

  const where = role === 'admin'
    ? {}
    : {
        groupAccesses: {
          some: {
            group: {
              members: {
                some: { userId: user.userId },
              },
            },
          },
        },
      };

  let deployments = [];
  try {
    deployments = await prisma.deployment.findMany({
      where,
      include: { versions: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'asc' },
    });
  } catch (error) {
    return uploadItems;
  }

  const versionItems = (await Promise.all(deployments.map(async (deployment) => {
    const versions = deployment.versions.filter((version) => !version.deletedAt && version.status === 'released');
    return Promise.all(versions.map(async (version) => {
      const packageFile = await resolvePackageForVersion(uploads, version);
      return {
        deploymentId: deployment.id,
        deploymentName: deployment.name,
        description: version.description || deployment.description || null,
        deploymentDescription: deployment.description || null,
        versionDescription: version.description || null,
        versionId: version.id,
        versionNumber: version.versionNumber,
        releaseType: version.releaseType,
        status: version.status,
        fileId: packageFile?.fileId || createVersionFileId(version.id),
        fileName: packageFile?.originalName || version.fileName || path.basename(version.packagePath || ''),
        fileType: version.fileType || 'application/octet-stream',
        size: packageFile?.size || (version.packageSize ? Number(version.packageSize) : null),
        installSize: packageFile?.installSize || null,
        checksum: packageFile?.checksum || version.checksum,
        releasedAt: version.releasedAt?.toISOString() || version.createdAt.toISOString(),
        available: Boolean(packageFile),
        source: packageFile?.source || 'missing',
      };
    }));
  }))).flat();

  const matchedFileIds = new Set(versionItems.map((item) => item.fileId).filter(Boolean));
  const unmatchedUploadItems = role === 'admin'
    ? uploadItems.filter((upload) => !matchedFileIds.has(upload.fileId))
    : [];

  return [...versionItems, ...unmatchedUploadItems];
}

export async function createManagedDownloadSession({ user, fileId, versionId, ipAddress, userAgent }) {
  if (!versionId) {
    const error = new Error('Version ID is required for managed downloads');
    error.status = 400;
    throw error;
  }

  const uploadOnlySession = String(versionId).startsWith('upload:');
  const persistentUserId = String(user?.userId || '').trim() || await resolvePersistentUserId(user);
  const canWriteSession = !uploadOnlySession && Boolean(persistentUserId) && Boolean(versionId);
  // Upload-only downloads do not have deployment-version records, so they use a
  // virtual session unless both IDs are real database UUIDs.
  const allowed = uploadOnlySession
    ? String(user?.role || '').toLowerCase() === 'admin'
    : await userCanAccessVersion(user, versionId);
  if (!allowed) {
    const error = new Error('You are not allowed to download this version');
    error.status = 403;
    throw error;
  }

  const file = await resolveManagedFile({ fileId, versionId });

  let session = createVirtualSession({ user, versionId });
  if (canWriteSession) {
    try {
      session = await prisma.downloadSession.create({
        data: {
          userId: persistentUserId,
          versionId,
          status: 'pending',
          progressPercentage: 0,
          downloadedSize: 0,
        },
      });

      await recordDownloadActivity({
        userId: persistentUserId,
        versionId,
        ipAddress,
        userAgent,
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[download-session-persistence]', error);
      }
    }
  }

  const token = signDownloadManagerToken({
    fileId,
    userId: user.userId,
    role: user.role,
    versionId,
    sessionId: session.id,
  });

  return {
    session: serializeSession(session),
    token,
    file: {
      fileId,
      name: file.originalName,
      size: file.size,
      installSize: file.installSize || null,
    },
  };
}

async function recordDownloadActivity({ userId, versionId, ipAddress, userAgent }) {
  if (!isUuid(versionId)) return;
  try {
    const log = await prisma.downloadLog.create({
      data: {
        userId,
        versionId,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
      include: {
        user: true,
        version: { include: { deployment: true } },
      },
    });
    await notifyAdmins({
      type: 'download',
      title: 'Download requested',
      message: `${log.user.displayName || log.user.username} requested ${log.version.deployment.name} ${log.version.versionNumber}.`,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[download-log-write]', error);
    }
    // Log creation should not prevent downloads from starting.
  }
}

export async function updateManagedDownloadSession({
  sessionId,
  user,
  status,
  downloadedSize,
  totalSize,
  ipAddress,
  userAgent,
}) {
  const nextStatus = normalizeSessionStatus(status);

  if (String(sessionId || '').startsWith('virtual:')) {
    return {
      id: sessionId,
      userId: user.userId,
      versionId: null,
      status: nextStatus || 'downloading',
      progressPercentage: totalSize && Number(totalSize) > 0
        ? Math.min(100, Math.round((Number(downloadedSize || 0) / Number(totalSize)) * 10000) / 100)
        : 0,
      downloadedSize: String(downloadedSize || 0),
      startedAt: new Date().toISOString(),
      completedAt: nextStatus === 'completed' ? new Date().toISOString() : null,
    };
  }

  const session = await prisma.downloadSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== user.userId) {
    const error = new Error('Download session not found');
    error.status = 404;
    throw error;
  }

  if (STOPPED_SESSION_STATUSES.has(session.status) && (!nextStatus || nextStatus === 'downloading')) {
    return serializeSession(session);
  }

  if (session.status === 'canceled' && nextStatus !== 'canceled') {
    return serializeSession(session);
  }

  const progressPercentage = totalSize && Number(totalSize) > 0
    ? Math.min(100, Math.round((Number(downloadedSize || 0) / Number(totalSize)) * 10000) / 100)
    : Number(session.progressPercentage);
  const currentDownloadedSize = Number(session.downloadedSize || 0);
  const nextDownloadedSize = Math.max(Number(downloadedSize || 0), currentDownloadedSize);
  const shouldComplete = nextStatus === 'completed';

  const updated = await prisma.downloadSession.update({
    where: { id: sessionId },
    data: {
      status: nextStatus || session.status,
      downloadedSize: BigInt(nextDownloadedSize),
      progressPercentage,
      completedAt: shouldComplete ? new Date() : session.completedAt,
    },
  });

  return serializeSession(updated);
}

function normalizeSessionStatus(status) {
  if (!status) return null;
  const normalized = String(status).trim().toLowerCase();
  if (normalized === 'cancelled') return 'canceled';
  if (!VALID_SESSION_STATUSES.has(normalized)) {
    const error = new Error(`Invalid download session status: ${status}`);
    error.status = 400;
    throw error;
  }
  return normalized;
}

export async function getTokenizedFileRequest({ fileId, token }) {
  const payload = validateDownloadTokenFileAccess(token, fileId);
  // A valid URL token is still rechecked against current access, so removing a
  // user from a group takes effect before the token naturally expires.
  if (isUuid(payload.versionId) && !await userCanAccessVersion(payload, payload.versionId)) {
    const error = new Error('You are not allowed to download this version');
    error.status = 403;
    throw error;
  }
  const file = await resolveManagedFile({ fileId, versionId: payload.versionId });
  const filePath = file.filePath;

  return { payload, file, filePath, stat: fs.statSync(filePath) };
}

export function validateDownloadTokenFileAccess(token, fileId) {
  const payload = verifyDownloadManagerToken(token);
  if (payload.fileId !== fileId) {
    const error = new Error('Download token does not match this file');
    error.status = 401;
    throw error;
  }
  return payload;
}

function findUploadForVersion(uploads, version) {
  const candidates = [version.packagePath, version.fileName].filter(Boolean);
  return uploads.find((upload) =>
    candidates.some((candidate) => candidate === upload.fileId || candidate === upload.originalName)
  );
}

function createVersionFileId(versionId) {
  return `${VERSION_FILE_PREFIX}${versionId}`;
}

async function resolvePackageForVersion(uploads, version) {
  const upload = findUploadForVersion(uploads, version);
  if (upload) {
    const filePath = getUploadedFilePath(upload.fileId);
    if (!filePath) return null;
    return {
      source: 'upload',
      fileId: upload.fileId,
      originalName: upload.originalName,
      size: upload.size,
      installSize: await getPackageInstallSize(filePath),
      checksum: upload.checksum || version.checksum || null,
      filePath,
    };
  }

  const serverFile = resolveServerPackageFile(version);
  if (!serverFile) return null;

  return {
    source: 'server',
    fileId: createVersionFileId(version.id),
    originalName: version.fileName || path.basename(serverFile.filePath),
    size: serverFile.stat.size,
    installSize: await getPackageInstallSize(serverFile.filePath),
    checksum: version.checksum || null,
    filePath: serverFile.filePath,
  };
}

async function resolveManagedFile({ fileId, versionId }) {
  // Prefer deployment-version metadata because released packages may live on a
  // configured package root instead of the upload scratch directory.
  if (String(versionId || '').startsWith('upload:')) {
    return resolveUploadedManagedFile(fileId);
  }

  if (!isUuid(versionId)) {
    return resolveUploadedManagedFile(fileId);
  }

  const version = await prisma.deploymentVersion.findUnique({ where: { id: versionId } });
  if (!version || version.deletedAt || version.status === 'deleted') {
    const error = new Error('Version not found');
    error.status = 404;
    throw error;
  }
  if (version.status !== 'released') {
    const error = new Error('Version is not available for download');
    error.status = 403;
    throw error;
  }

  const file = await resolvePackageForVersion(listUploadedFiles(), version);
  if (!file || !file.filePath) {
    const error = new Error('File not found at the registered server path');
    error.status = 404;
    throw error;
  }

  const allowedIds = new Set([
    file.fileId,
    version.packagePath,
    version.fileName,
  ].filter(Boolean));

  if (!allowedIds.has(fileId)) {
    const error = new Error('Requested file does not match this version');
    error.status = 401;
    throw error;
  }

  return file;
}

async function resolveUploadedManagedFile(fileId) {
  const file = findUploadedFile(fileId);
  const filePath = getUploadedFilePath(fileId);
  if (!file || !filePath) {
    const error = new Error('File not found');
    error.status = 404;
    throw error;
  }

  return {
    source: 'upload',
    fileId: file.fileId,
    originalName: file.originalName,
    size: file.size,
    installSize: await getPackageInstallSize(filePath),
    checksum: file.checksum || null,
    filePath,
  };
}

async function getInstallSizeForUpload(fileId) {
  const filePath = getUploadedFilePath(fileId);
  if (!filePath) return null;
  return getPackageInstallSize(filePath);
}

function resolveServerPackageFile(version) {
  const packagePath = String(version.packagePath || '').trim();
  if (!packagePath) return null;

  const packageRoot = path.resolve(process.env.PACKAGE_ROOT || DEFAULT_PACKAGE_ROOT);
  const candidates = [];
  if (version.fileName) {
    candidates.push(path.resolve(packagePath, version.fileName));
  }
  candidates.push(path.resolve(packagePath));

  for (const candidate of candidates) {
    try {
      const relativePath = path.relative(packageRoot, candidate);
      // Admin-provided paths must stay under PACKAGE_ROOT before the API exposes
      // them to launcher downloads.
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) continue;
      const stat = fs.statSync(candidate);
      if (stat.isFile()) {
        return { filePath: candidate, stat };
      }
    } catch (error) {
      // Missing server-staged files are reported as unavailable in the catalog.
    }
  }

  return null;
}

function serializeSession(session) {
  return {
    id: session.id,
    userId: session.userId,
    versionId: session.versionId,
    status: session.status,
    progressPercentage: Number(session.progressPercentage),
    downloadedSize: session.downloadedSize?.toString(),
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() || null,
  };
}

function createVirtualSession({ user, versionId }) {
  const now = new Date();
  return {
    id: `virtual:${Date.now()}`,
    userId: user.userId,
    versionId,
    status: 'pending',
    progressPercentage: 0,
    downloadedSize: 0,
    startedAt: now,
    completedAt: null,
  };
}

async function resolvePersistentUserId(user) {
  const tokenUserId = String(user?.userId || '').trim();
  if (isUuid(tokenUserId)) {
    return tokenUserId;
  }

  if (!user?.username) {
    return null;
  }

  const persistedUser = await findUserByUsername(String(user.username));
  const persistedUserId = String(persistedUser?.id || '').trim();
  return isUuid(persistedUserId) ? persistedUserId : null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}
